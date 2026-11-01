/**
 * XerMedia can be deployed as an inbound-only WhatsApp inbox.
 *
 * Keep this check on the server as the final safety boundary. Hiding the
 * composer in the browser improves the UI, but it must never be the only
 * protection against an API route, automation, or flow sending a message.
 */
export function isReceiveOnlyMode(): boolean {
  return process.env.XERMEDIA_RECEIVE_ONLY === 'true'
}

export class ReceiveOnlyModeError extends Error {
  constructor() {
    super('XerMedia is in receive-only mode. Outbound WhatsApp messages are disabled.')
    this.name = 'ReceiveOnlyModeError'
  }
}

export function assertOutboundMessagingEnabled(): void {
  if (isReceiveOnlyMode()) {
    throw new ReceiveOnlyModeError()
  }
}
