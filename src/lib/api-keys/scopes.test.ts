import { describe, expect, it } from 'vitest';

import {
  API_SCOPES,
  hasScope,
  isApiScope,
  normalizeScopes,
} from './scopes';

describe('receive-only API key scopes', () => {
  it('contains only receive/read/contact/integration permissions', () => {
    expect(API_SCOPES).toEqual([
      'messages:read',
      'contacts:read',
      'contacts:write',
      'conversations:read',
      'webhooks:manage',
    ]);
    expect(API_SCOPES.some((scope) => scope.includes('send'))).toBe(false);
    expect(API_SCOPES.some((scope) => scope.includes('broadcast'))).toBe(false);
  });

  it('recognizes valid scopes and rejects removed outbound scopes', () => {
    expect(isApiScope('messages:read')).toBe(true);
    expect(isApiScope('contacts:write')).toBe(true);
    expect(isApiScope('messages:send')).toBe(false);
    expect(isApiScope('broadcasts:send')).toBe(false);
  });

  it('normalizes and deduplicates scope arrays', () => {
    expect(normalizeScopes(['messages:read', 'messages:read', 'contacts:read'])).toEqual([
      'messages:read',
      'contacts:read',
    ]);
    expect(normalizeScopes([])).toEqual([]);
    expect(normalizeScopes('messages:read')).toBeNull();
    expect(normalizeScopes(['messages:send'])).toBeNull();
  });

  it('checks granted scopes', () => {
    expect(hasScope(['messages:read'], 'messages:read')).toBe(true);
    expect(hasScope([], 'messages:read')).toBe(false);
  });
});
