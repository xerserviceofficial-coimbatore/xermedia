import type { SupabaseClient } from '@supabase/supabase-js';

import { addContactTagIfAbsent } from './tag-write';

interface AddContactTagInput {
  db: SupabaseClient;
  accountId: string;
  contactId: string;
  tagId: string;
}

export interface AddContactTagResult {
  added: boolean;
  dispatched: false;
  reason?: 'duplicate';
}

/**
 * Receive-only XerMedia tag writer.
 *
 * Tags remain a contact-management feature, but adding a tag no longer
 * dispatches Automation triggers because Automations were removed from
 * the product. The function name is kept for route compatibility while
 * callers migrate away from the old automation-oriented terminology.
 */
export async function addContactTagAndDispatch(
  input: AddContactTagInput
): Promise<AddContactTagResult> {
  const added = await addContactTagIfAbsent(input.db, {
    accountId: input.accountId,
    contactId: input.contactId,
    tagId: input.tagId,
  });

  if (!added) {
    return { added: false, dispatched: false, reason: 'duplicate' };
  }

  return { added: true, dispatched: false };
}
