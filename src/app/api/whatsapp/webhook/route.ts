import { after, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { decrypt } from '@/lib/whatsapp/encryption'
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe'
import { getMediaUrl } from '@/lib/whatsapp/meta-api'
import { mirrorInboundMedia } from '@/lib/whatsapp/mirror-inbound-media'
import {
  hasUsableIdentity,
  identityDisplayName,
  resolveInboundIdentity,
  type WaContactPayload,
} from '@/lib/whatsapp/wa-identity'
import { readCappedBody } from '@/lib/whatsapp/webhook-body'
import {
  verifyMetaWebhookSignature,
  verifyTokenMatches,
} from '@/lib/whatsapp/webhook-signature'

export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

interface WhatsAppMessage {
  id: string
  from?: string
  from_user_id?: string
  from_parent_user_id?: string
  timestamp: string
  type: string
  text?: { body?: string }
  image?: { id: string; mime_type?: string; caption?: string }
  video?: { id: string; mime_type?: string; caption?: string }
  document?: {
    id: string
    mime_type?: string
    filename?: string
    caption?: string
  }
  audio?: { id: string; mime_type?: string }
  sticker?: { id: string; mime_type?: string }
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
  reaction?: { message_id: string; emoji: string }
  interactive?: {
    type?: string
    button_reply?: { id?: string; title?: string }
    list_reply?: { id?: string; title?: string; description?: string }
  }
  button?: { text?: string; payload?: string }
}

interface WebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string }
        contacts?: WaContactPayload[]
        messages?: WhatsAppMessage[]
      }
    }>
  }>
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = searchParams.get('hub.verify_token')

  if (mode !== 'subscribe' || !challenge || !verifyToken) {
    return NextResponse.json(
      { error: 'Missing verification parameters' },
      { status: 400 },
    )
  }

  const { data: configs, error } = await supabaseAdmin()
    .from('whatsapp_config')
    .select('verify_token')

  if (error || !configs) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
  }

  for (const config of configs) {
    if (!config.verify_token) continue
    try {
      if (verifyTokenMatches(decrypt(config.verify_token), verifyToken)) {
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
    } catch {
      // Ignore malformed rows and continue checking the remaining config.
    }
  }

  return NextResponse.json(
    { error: 'Verification token mismatch' },
    { status: 403 },
  )
}

export async function POST(request: Request) {
  const rawBody = await readCappedBody(request)
  if (rawBody === null) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const signature = request.headers.get('x-hub-signature-256')
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn('[webhook] rejected request with invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: WebhookBody
  try {
    body = JSON.parse(rawBody) as WebhookBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  after(async () => {
    try {
      await processWebhook(body)
    } catch (error) {
      console.error(
        '[webhook] inbound processing failed:',
        error instanceof Error ? error.message : error,
      )
    }
  })

  return NextResponse.json({ status: 'received' })
}

async function processWebhook(body: WebhookBody) {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value?.messages?.length || !value.contacts?.length) continue

      const phoneNumberId = value.metadata?.phone_number_id
      if (!phoneNumberId) continue

      const { data: configs, error: configError } = await supabaseAdmin()
        .from('whatsapp_config')
        .select(
          'account_id,user_id,access_token,mirror_inbound_media,phone_number_id',
        )
        .eq('phone_number_id', phoneNumberId)

      if (configError || !configs || configs.length !== 1) {
        console.error(
          '[webhook] config lookup failed:',
          configError?.message ?? `matched ${configs?.length ?? 0} rows`,
        )
        continue
      }

      const config = configs[0]
      const accessToken = decrypt(config.access_token)

      for (let index = 0; index < value.messages.length; index += 1) {
        await processInboundMessage({
          message: value.messages[index],
          contact: value.contacts[index] ?? value.contacts[0],
          accountId: config.account_id,
          ownerUserId: config.user_id,
          accessToken,
          mirrorMedia: config.mirror_inbound_media !== false,
        })
      }
    }
  }
}

async function processInboundMessage(args: {
  message: WhatsAppMessage
  contact: WaContactPayload | undefined
  accountId: string
  ownerUserId: string
  accessToken: string
  mirrorMedia: boolean
}) {
  const {
    message,
    contact,
    accountId,
    ownerUserId,
    accessToken,
    mirrorMedia,
  } = args
  const db = supabaseAdmin()
  const identity = resolveInboundIdentity(message, contact)

  if (!hasUsableIdentity(identity)) return

  const { data: duplicate } = await db
    .from('messages')
    .select('id')
    .eq('message_id', message.id)
    .maybeSingle()
  if (duplicate) return

  let contactRecord: { id: string; name?: string | null } | null = null

  if (identity.waUserId) {
    const { data } = await db
      .from('contacts')
      .select('id,name')
      .eq('account_id', accountId)
      .eq('wa_user_id', identity.waUserId)
      .maybeSingle()
    contactRecord = data
  }

  if (!contactRecord && identity.phone) {
    contactRecord = (await findExistingContact(
      db,
      accountId,
      identity.phone,
    )) as { id: string; name?: string | null } | null
  }

  const identityPatch = {
    ...(identity.phone ? { phone: identity.phone } : {}),
    wa_user_id: identity.waUserId,
    wa_parent_user_id: identity.waParentUserId,
    wa_username: identity.waUsername,
    wa_profile_name: identity.name || null,
    updated_at: new Date().toISOString(),
  }

  if (contactRecord) {
    const { error } = await db
      .from('contacts')
      .update(identityPatch)
      .eq('id', contactRecord.id)
    if (error) console.error('[webhook] contact update failed:', error.message)
  } else {
    const { data, error } = await db
      .from('contacts')
      .insert({
        account_id: accountId,
        user_id: ownerUserId,
        phone: identity.phone,
        name: identityDisplayName(identity),
        wa_profile_name: identity.name || null,
        wa_user_id: identity.waUserId,
        wa_parent_user_id: identity.waParentUserId,
        wa_username: identity.waUsername,
      })
      .select('id,name')
      .single()

    if (error || !data) {
      if (isUniqueViolation(error) && identity.phone) {
        contactRecord = (await findExistingContact(
          db,
          accountId,
          identity.phone,
        )) as { id: string; name?: string | null } | null
      }
      if (!contactRecord) {
        console.error(
          '[webhook] contact create failed:',
          error?.message ?? 'unknown',
        )
        return
      }
    } else {
      contactRecord = data
    }
  }

  let { data: conversation } = await db
    .from('conversations')
    .select('id,unread_count,first_inbound_at')
    .eq('account_id', accountId)
    .eq('contact_id', contactRecord.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conversation) {
    const { data, error } = await db
      .from('conversations')
      .insert({
        account_id: accountId,
        user_id: ownerUserId,
        contact_id: contactRecord.id,
        status: 'open',
        unread_count: 0,
      })
      .select('id,unread_count,first_inbound_at')
      .single()

    if (error || !data) {
      console.error(
        '[webhook] conversation create failed:',
        error?.message ?? 'unknown',
      )
      return
    }
    conversation = data
  }

  const content = await inboundContent(message, {
    accountId,
    accessToken,
    mirrorMedia,
  })
  const createdAt = metaTimestampToIso(message.timestamp) ?? new Date().toISOString()

  const { error: insertError } = await db.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'customer',
    content_type: content.type,
    content_text: content.text,
    media_url: content.mediaUrl,
    media_type: content.mediaType,
    message_id: message.id,
    status: 'delivered',
    created_at: createdAt,
  })

  if (insertError) {
    if (!isUniqueViolation(insertError)) {
      console.error('[webhook] message insert failed:', insertError.message)
    }
    return
  }

  const { error: updateError } = await db
    .from('conversations')
    .update({
      status: 'open',
      last_message_text: content.preview,
      last_message_at: createdAt,
      first_inbound_at: conversation.first_inbound_at ?? createdAt,
      last_inbound_at: createdAt,
      unread_count: Number(conversation.unread_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  if (updateError) {
    console.error('[webhook] conversation update failed:', updateError.message)
  }
}

async function inboundContent(
  message: WhatsAppMessage,
  context: { accountId: string; accessToken: string; mirrorMedia: boolean },
): Promise<{
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location'
  text: string | null
  preview: string
  mediaUrl: string | null
  mediaType: string | null
}> {
  if (message.type === 'text') {
    const text = message.text?.body?.trim() || ''
    return {
      type: 'text',
      text,
      preview: text || 'Message',
      mediaUrl: null,
      mediaType: null,
    }
  }

  if (message.type === 'location' && message.location) {
    const text = [
      message.location.name,
      message.location.address,
      `${message.location.latitude}, ${message.location.longitude}`,
    ]
      .filter(Boolean)
      .join('\n')
    return {
      type: 'location',
      text,
      preview: 'Location',
      mediaUrl: null,
      mediaType: null,
    }
  }

  if (message.type === 'interactive') {
    const text =
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      'Interactive response'
    return {
      type: 'text',
      text,
      preview: text,
      mediaUrl: null,
      mediaType: null,
    }
  }

  if (message.type === 'button') {
    const text = message.button?.text ?? message.button?.payload ?? 'Button response'
    return {
      type: 'text',
      text,
      preview: text,
      mediaUrl: null,
      mediaType: null,
    }
  }

  if (message.type === 'reaction') {
    const text = message.reaction?.emoji
      ? `Reaction ${message.reaction.emoji}`
      : 'Reaction'
    return {
      type: 'text',
      text,
      preview: text,
      mediaUrl: null,
      mediaType: null,
    }
  }

  const media =
    message.image ??
    message.video ??
    message.document ??
    message.audio ??
    message.sticker

  if (media?.id) {
    const caption =
      'caption' in media && typeof media.caption === 'string'
        ? media.caption
        : null
    const filename =
      'filename' in media && typeof media.filename === 'string'
        ? media.filename
        : null
    let mediaUrl: string | null = `/api/whatsapp/media/${encodeURIComponent(media.id)}`
    let mediaType: string | null =
      'mime_type' in media && typeof media.mime_type === 'string'
        ? media.mime_type
        : null

    try {
      const meta = await getMediaUrl({
        mediaId: media.id,
        accessToken: context.accessToken,
      })
      mediaType = meta.mimeType || mediaType

      if (context.mirrorMedia) {
        mediaUrl =
          (await mirrorInboundMedia({
            storage: supabaseAdmin().storage,
            accountId: context.accountId,
            mediaId: media.id,
            downloadUrl: meta.url,
            accessToken: context.accessToken,
            mimeType: mediaType,
            fileSize: meta.fileSize,
            fileName: filename,
            messageTimestamp: message.timestamp,
          })) ?? mediaUrl
      }
    } catch (error) {
      console.warn(
        '[webhook] media fetch failed:',
        error instanceof Error ? error.message : error,
      )
    }

    const type =
      message.type === 'sticker'
        ? 'image'
        : message.type === 'image' ||
            message.type === 'video' ||
            message.type === 'audio' ||
            message.type === 'document'
          ? message.type
          : 'document'
    const preview = caption || filename || `Received ${type}`

    return {
      type,
      text: caption,
      preview,
      mediaUrl,
      mediaType,
    }
  }

  return {
    type: 'text',
    text: `Received ${message.type}`,
    preview: `Received ${message.type}`,
    mediaUrl: null,
    mediaType: null,
  }
}

function metaTimestampToIso(value: string): string | null {
  const seconds = Number.parseInt(value, 10)
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null
}
