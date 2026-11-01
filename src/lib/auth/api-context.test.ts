import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateApiKey } from '@/lib/api-keys/keys';
import type { ApiKeyRow } from '@/lib/api-keys/store';
import { ApiError } from '@/lib/api/v1/respond';
import { __resetRateLimitForTests, RATE_LIMITS } from '@/lib/rate-limit';

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => ({ __isMockAdminClient: true }),
}));

const findActiveKeyByHash = vi.fn<(hash: string) => Promise<ApiKeyRow | null>>();
const touchLastUsed = vi.fn();
vi.mock('@/lib/api-keys/store', () => ({
  findActiveKeyByHash: (hash: string) => findActiveKeyByHash(hash),
  touchLastUsed: (id: string) => touchLastUsed(id),
}));

const { requireApiKey } = await import('./api-context');
const KEY = generateApiKey().plaintext;

function reqWith(authHeader?: string): Request {
  return new Request('https://crm.example.com/api/v1/me', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function row(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: 'key-1',
    account_id: 'acct-1',
    created_by: 'user-1',
    name: 'Test key',
    scopes: ['messages:read'],
    expires_at: null,
    revoked_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  __resetRateLimitForTests();
  findActiveKeyByHash.mockReset();
  touchLastUsed.mockReset();
});

afterEach(() => __resetRateLimitForTests());

async function expectApiError(promise: Promise<unknown>, code: string, status: number) {
  await promise.then(
    () => { throw new Error('expected API error'); },
    (error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe(code);
      expect(apiError.status).toBe(status);
    },
  );
}

describe('requireApiKey', () => {
  it('401s when no authorization header is present', async () => {
    await expectApiError(requireApiKey(reqWith()), 'unauthorized', 401);
  });

  it('401s for an unknown key', async () => {
    findActiveKeyByHash.mockResolvedValue(null);
    await expectApiError(requireApiKey(reqWith(`Bearer ${KEY}`)), 'unauthorized', 401);
  });

  it('returns context for a valid receive-only key', async () => {
    findActiveKeyByHash.mockResolvedValue(row());
    const context = await requireApiKey(reqWith(`Bearer ${KEY}`));
    expect(context.accountId).toBe('acct-1');
    expect(context.scopes).toEqual(['messages:read']);
    expect(touchLastUsed).toHaveBeenCalledWith('key-1');
  });

  it('403s when the key lacks the required read scope', async () => {
    findActiveKeyByHash.mockResolvedValue(row({ scopes: ['contacts:read'] }));
    await expectApiError(
      requireApiKey(reqWith(`Bearer ${KEY}`), 'messages:read'),
      'forbidden',
      403,
    );
  });

  it('passes when the required read scope is granted', async () => {
    findActiveKeyByHash.mockResolvedValue(row({ scopes: ['messages:read'] }));
    const context = await requireApiKey(reqWith(`Bearer ${KEY}`), 'messages:read');
    expect(context.accountId).toBe('acct-1');
  });

  it('429s once the per-key budget is exhausted', async () => {
    findActiveKeyByHash.mockResolvedValue(row());
    for (let i = 0; i < RATE_LIMITS.publicApi.limit; i += 1) {
      await requireApiKey(reqWith(`Bearer ${KEY}`));
    }
    await expectApiError(requireApiKey(reqWith(`Bearer ${KEY}`)), 'rate_limited', 429);
  });
});
