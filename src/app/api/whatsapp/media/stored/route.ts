import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { mediaProxyHeaders } from '@/lib/media/proxy-response-headers'

const BUCKET = 'inbound-media'

export async function GET(request: Request) {
  const db = await createClient()
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = checkRateLimit(`whatsapp-media:${user.id}`, RATE_LIMITS.whatsappMedia)
  if (!limit.success) return rateLimitResponse(limit)

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profileError || !profile?.account_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const path = new URL(request.url).searchParams.get('path') ?? ''
  const prefix = `account-${profile.account_id}/inbound/`
  const fileName = path.startsWith(prefix) ? path.slice(prefix.length) : ''
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(fileName)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: blob, error } = await admin.storage.from(BUCKET).download(path)
  if (error || !blob) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return new Response(blob, {
    status: 200,
    headers: mediaProxyHeaders(fileName, blob.type),
  })
}
