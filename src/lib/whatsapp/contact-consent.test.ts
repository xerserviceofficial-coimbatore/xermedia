import { describe, expect, it } from 'vitest'
import { canSendBroadcastToPhone, hasBroadcastConsent, isWhatsAppOptOutText } from './contact-consent'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('broadcast consent', () => {
  it('requires a timestamp and an evidence source', () => {
    expect(hasBroadcastConsent(null)).toBe(false)
    expect(hasBroadcastConsent({ whatsapp_opted_in_at: '2026-10-19T00:00:00Z' })).toBe(false)
    expect(hasBroadcastConsent({
      whatsapp_opted_in_at: '2026-10-19T00:00:00Z',
      whatsapp_consent_source: 'Website form',
    })).toBe(true)
  })

  it('blocks a contact after an opt-out', () => {
    expect(hasBroadcastConsent({
      whatsapp_opted_in_at: '2026-10-19T00:00:00Z',
      whatsapp_consent_source: 'Website form',
      whatsapp_opted_out_at: '2026-10-19T01:00:00Z',
    })).toBe(false)
  })

  it('checks the account and normalized phone before approving a send', async () => {
    const filters: Record<string, string> = {}
    const query = {
      select: () => query,
      eq: (field: string, value: string) => {
        filters[field] = value
        return query
      },
      maybeSingle: async () => ({
        data: {
          whatsapp_opted_in_at: '2026-10-19T00:00:00Z',
          whatsapp_consent_source: 'Website form',
          whatsapp_opted_out_at: null,
        },
        error: null,
      }),
    }
    const db = { from: () => query } as unknown as SupabaseClient
    expect(await canSendBroadcastToPhone(db, 'account-1', '+1 (415) 555-0123')).toBe(true)
    expect(filters).toEqual({ account_id: 'account-1', phone_normalized: '14155550123' })
  })

  it('does not send when the lookup has no contact', async () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    }
    const db = { from: () => query } as unknown as SupabaseClient
    expect(await canSendBroadcastToPhone(db, 'account-1', '+14155550123')).toBe(false)
  })

  it('recognizes explicit stop requests without confusing normal messages', () => {
    expect(isWhatsAppOptOutText(' STOP ')).toBe(true)
    expect(isWhatsAppOptOutText('unsubscribe!')).toBe(true)
    expect(isWhatsAppOptOutText('opt out')).toBe(true)
    expect(isWhatsAppOptOutText('stop my print order')).toBe(false)
  })
})
