// API key scopes for receive-only XerMedia.
// No scope can send WhatsApp messages or launch broadcasts.

export const API_SCOPES = [
  'messages:read',
  'contacts:read',
  'contacts:write',
  'conversations:read',
  'webhooks:manage',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  'messages:read': 'Read received messages',
  'contacts:read': 'List and read contacts',
  'contacts:write': 'Create and update contacts',
  'conversations:read': 'List and read conversations',
  'webhooks:manage': 'Register and manage integration webhooks',
};

export function isApiScope(value: unknown): value is ApiScope {
  return (
    typeof value === 'string' &&
    (API_SCOPES as readonly string[]).includes(value)
  );
}

export function normalizeScopes(input: unknown): ApiScope[] | null {
  if (!Array.isArray(input)) return null;
  const out: ApiScope[] = [];
  for (const entry of input) {
    if (!isApiScope(entry)) return null;
    if (!out.includes(entry)) out.push(entry);
  }
  return out;
}

export function hasScope(
  granted: readonly string[],
  required: ApiScope,
): boolean {
  return granted.includes(required);
}
