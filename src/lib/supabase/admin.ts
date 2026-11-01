import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Shared lazy service-role client for server-only XerMedia code. */
let adminClient: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return adminClient
}
