import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const afterMock = vi.hoisted(() => vi.fn())

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: afterMock,
  }
})

const SECRET = 'receive-only-test-secret'
process.env.META_APP_SECRET = SECRET

const { GET, POST } = await import('./route')

function signature(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`
}

beforeEach(() => {
  afterMock.mockReset()
  afterMock.mockImplementation((callback: () => void | Promise<void>) => {
    void callback()
  })
})

describe('receive-only WhatsApp webhook', () => {
  it('rejects webhook verification requests with missing parameters', async () => {
    const response = await GET(
      new Request('https://xermedia.test/api/whatsapp/webhook'),
    )

    expect(response.status).toBe(400)
  })

  it('rejects POST payloads with an invalid Meta signature', async () => {
    const body = JSON.stringify({ entry: [] })
    const response = await POST(
      new Request('https://xermedia.test/api/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': 'sha256=invalid',
        },
        body,
      }),
    )

    expect(response.status).toBe(401)
    expect(afterMock).not.toHaveBeenCalled()
  })

  it('acknowledges a correctly signed inbound payload and schedules processing', async () => {
    const body = JSON.stringify({ entry: [] })
    const response = await POST(
      new Request('https://xermedia.test/api/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signature(body),
        },
        body,
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'received' })
    expect(afterMock).toHaveBeenCalledTimes(1)
  })
})
