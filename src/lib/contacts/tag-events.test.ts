import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
}));

vi.mock('./tag-write', () => ({
  addContactTagIfAbsent: mocks.add,
}));

import { addContactTagAndDispatch } from './tag-events';

const base = {
  db: {} as never,
  accountId: 'account-1',
  contactId: 'contact-1',
  tagId: 'tag-1',
};

beforeEach(() => {
  mocks.add.mockReset();
});

describe('addContactTagAndDispatch', () => {
  it('adds a tag without dispatching automations', async () => {
    mocks.add.mockResolvedValue(true);

    await expect(addContactTagAndDispatch(base)).resolves.toEqual({
      added: true,
      dispatched: false,
    });
    expect(mocks.add).toHaveBeenCalledTimes(1);
  });

  it('returns duplicate when the tag already exists', async () => {
    mocks.add.mockResolvedValue(false);

    await expect(addContactTagAndDispatch(base)).resolves.toEqual({
      added: false,
      dispatched: false,
      reason: 'duplicate',
    });
  });
});
