'use client';

import { Archive, ShieldCheck } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SettingsPanelHead } from './settings-panel-head';

export function InboxSettings() {
  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Inbox"
        description="XerMedia is a receive-only WhatsApp inbox."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="size-4 text-primary" />
              Receive-only mode
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Staff can read incoming messages and files, but cannot reply or send WhatsApp messages from XerMedia.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Reply, reactions, templates, broadcasts, automations, flows and AI reply controls are removed from the inbox experience.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Archive className="size-4 text-primary" />
              3-day retention
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Incoming message records and mirrored inbound media are automatically cleaned up after three days.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}
