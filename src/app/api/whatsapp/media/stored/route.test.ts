import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  accountId: '11111111-2222-3333-4444-555555555555' as string | null,
  downloadedPath: '' as string,
  rateLimitOk: true,
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: h.accountId ? { account_id: h.accountId } : null,
          error: null,
        }),
      }
      return query
    },
  }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        download: async (path: string) => {
          h.downloadedPath = path
          return { data: new Blob(['photo'], { type: 'image/jpeg' }), error: null }
        },
      }),
    },
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { whatsappMedia: { limit: 240, windowMs: 60_000 } },
  checkRateLimit: () => ({ success: h.rateLimitOk }),
  rateLimitResponse: () => new Response(null, { status: 429 }),
}))

import { GET } from './route'

function call(path: string) {
  return GET(new Request(`http://localhost/api/whatsapp/media/stored?path=${encodeURIComponent(path)}`))
}

beforeEach(() => {
  h.user = { id: 'user-1' }
  h.accountId = '11111111-2222-3333-4444-555555555555'
  h.downloadedPath = ''
  h.rateLimitOk = true
})

describe('private inbound media', () => {
  it('serves a file to a member of the owning account', async () => {
    const path = `account-${h.accountId}/inbound/123-image.jpg`
    const res = await call(path)
    expect(res.status).toBe(200)
    expect(h.downloadedPath).toBe(path)
    expect(res.headers.get('cache-control')).toContain('private')
    expect(await res.text()).toBe('photo')
  })

  it('rejects other accounts and traversal paths before reading storage', async () => {
    const other = await call('account-other/inbound/photo.jpg')
    const traversal = await call(`account-${h.accountId}/inbound/../photo.jpg`)
    expect(other.status).toBe(404)
    expect(traversal.status).toBe(404)
    expect(h.downloadedPath).toBe('')
  })

  it('requires a signed-in account member', async () => {
    h.user = null
    expect((await call(`account-${h.accountId}/inbound/photo.jpg`)).status).toBe(401)
    h.user = { id: 'user-1' }
    h.accountId = null
    expect((await call('account-other/inbound/photo.jpg')).status).toBe(403)
    expect(h.downloadedPath).toBe('')
  })
})
