import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from './phone-utils'

export interface ContactConsent {
  whatsapp_opted_in_at?: string | null
  whatsapp_opted_out_at?: string | null
  whatsapp_consent_source?: string | null
}

export function hasBroadcastConsent(contact: ContactConsent | null): boolean {
  return Boolean(
    contact?.whatsapp_opted_in_at &&
      contact.whatsapp_consent_source?.trim() &&
      !contact.whatsapp_opted_out_at,
  )
}

export function isWhatsAppOptOutText(text: string | null | undefined): boolean {
  return /^(stop|unsubscribe|opt\s*out)[.!\s]*$/i.test(text?.trim() ?? '')
}

/** Fail closed if the contact cannot be found or the consent read fails. */
export async function canSendBroadcastToPhone(
  db: SupabaseClient,
  accountId: string,
  phone: string,
): Promise<boolean> {
  const normalized = normalizePhone(phone)
  if (!normalized) return false
  const { data, error } = await db
    .from('contacts')
    .select('whatsapp_opted_in_at, whatsapp_opted_out_at, whatsapp_consent_source')
    .eq('account_id', accountId)
    .eq('phone_normalized', normalized)
    .maybeSingle()
  if (error) {
    console.error('[contact-consent] lookup failed:', error)
    return false
  }
  return hasBroadcastConsent(data)
}
