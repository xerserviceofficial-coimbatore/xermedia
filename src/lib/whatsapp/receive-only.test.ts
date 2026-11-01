import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendTextMessage } from './meta-api'
import {
  assertOutboundMessagingEnabled,
  isReceiveOnlyMode,
  ReceiveOnlyModeError,
} from './receive-only'

describe('XerMedia receive-only mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('is disabled unless explicitly enabled', () => {
    vi.stubEnv('XERMEDIA_RECEIVE_ONLY', 'false')
    expect(isReceiveOnlyMode()).toBe(false)
    expect(() => assertOutboundMessagingEnabled()).not.toThrow()
  })

  it('blocks outbound WhatsApp calls before any network request', async () => {
    vi.stubEnv('XERMEDIA_RECEIVE_ONLY', 'true')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      sendTextMessage({
        phoneNumberId: 'phone-id',
        accessToken: 'secret-token',
        to: '919000000000',
        text: 'This must not be sent',
      }),
    ).rejects.toBeInstanceOf(ReceiveOnlyModeError)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
