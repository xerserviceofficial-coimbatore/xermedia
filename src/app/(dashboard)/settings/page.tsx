'use client';

import { Suspense, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { SettingsRail } from '@/components/settings/settings-rail';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { InboxSettings } from '@/components/settings/inbox-settings';
import { MembersTab } from '@/components/settings/members-tab';
import { ApiKeysSettings } from '@/components/settings/api-keys-settings';
import {
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = resolveSection(searchParams.get('tab'));

  const go = (next: SettingsSection) => {
    router.replace(`/settings?tab=${next}`, { scroll: false });
  };

  const panel: Record<SettingsSection, ReactNode> = {
    inbox: <InboxSettings />,
    fields: <FieldsAndTagsPanel />,
    members: <MembersTab />,
    api: <ApiKeysSettings />,
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Receive-only inbox, fields and tags, team access, and API keys.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
        <SettingsRail active={section} onSelect={go} />
        <div className="min-w-0">{panel[section]}</div>
      </div>
    </div>
  );
}
