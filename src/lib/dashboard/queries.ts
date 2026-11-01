import type { SupabaseClient } from '@supabase/supabase-js'
import { groupInboundMessages } from './activity-grouping'
import type { ActivityItem } from './types'
import { getT } from '@/lib/i18n/translate'

type DB = SupabaseClient

export async function loadActivity(db: DB, limit = 50): Promise<ActivityItem[]> {
  const [msgs, contacts] = await Promise.all([
    db
      .from('messages')
      .select('id, sender_type, created_at, conversation_id, conversations(contact_id, contacts(name, phone, wa_profile_name))')
      .eq('sender_type', 'customer')
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 2, 40)),
    db
      .from('contacts')
      .select('id, name, phone, wa_profile_name, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const items: ActivityItem[] = []
  const t = getT('Dashboard.activityFeed.items')

  const inbound = (msgs.data ?? []) as unknown as Array<{
    id: string
    created_at: string
    conversation_id: string
    conversations:
      | {
          contact_id: string | null
          contacts:
            | { name: string | null; phone: string; wa_profile_name?: string | null }[]
            | { name: string | null; phone: string; wa_profile_name?: string | null }
            | null
        }[]
      | {
          contact_id: string | null
          contacts:
            | { name: string | null; phone: string; wa_profile_name?: string | null }[]
            | { name: string | null; phone: string; wa_profile_name?: string | null }
            | null
        }
      | null
  }>

  const grouped = groupInboundMessages(
    inbound.map((message) => {
      const conversation = Array.isArray(message.conversations)
        ? message.conversations[0]
        : message.conversations
      const contact = Array.isArray(conversation?.contacts)
        ? conversation?.contacts[0]
        : conversation?.contacts
      const savedName = contact?.name || contact?.phone || t('unknown')
      const whatsappName = contact?.wa_profile_name?.trim()
      return {
        id: message.id,
        conversationId: message.conversation_id,
        who:
          whatsappName && whatsappName !== savedName
            ? `${savedName} (${whatsappName})`
            : savedName,
        at: message.created_at,
      }
    }),
  )

  for (const group of grouped) {
    items.push({
      id: `msg-${group.id}`,
      kind: 'message',
      text:
        group.count > 1
          ? t('newMessages', { who: group.who, count: group.count })
          : t('newMessage', { who: group.who }),
      at: group.at,
      href: `/inbox?c=${group.conversationId}`,
    })
  }

  for (const contact of (contacts.data ?? []) as Array<{
    id: string
    name: string | null
    phone: string
    wa_profile_name?: string | null
    created_at: string
  }>) {
    const savedName = contact.name || contact.phone
    const whatsappName = contact.wa_profile_name?.trim()
    const displayName =
      whatsappName && whatsappName !== savedName
        ? `${savedName} (${whatsappName})`
        : savedName
    items.push({
      id: `contact-${contact.id}`,
      kind: 'contact',
      text: t('newContact', { name: displayName }),
      at: contact.created_at,
      href: '/contacts',
    })
  }

  return items
    .sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0))
    .slice(0, limit)
}
