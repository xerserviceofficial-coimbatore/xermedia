'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, MessageSquare, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

type ActivityRow = {
  id: string;
  created_at: string;
  content_type: string;
  content_text: string | null;
  conversation: {
    contact: {
      name: string | null;
      wa_profile_name?: string | null;
      wa_username?: string | null;
      phone: string | null;
    } | null;
  } | null;
};

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await createClient()
      .from('messages')
      .select(
        'id, created_at, content_type, content_text, conversation:conversations(contact:contacts(name,wa_profile_name,wa_username,phone))',
      )
      .eq('sender_type', 'customer')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[activity] load failed:', error.message);
    } else {
      setItems((data ?? []) as unknown as ActivityRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Recent activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest incoming WhatsApp activity. Message data is retained for three days.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {!loading && items.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-muted-foreground">
            No inbound activity yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => {
              const contact = item.conversation?.contact;
              const savedName = contact?.name?.trim() || 'Unknown contact';
              const whatsappName = contact?.wa_profile_name?.trim();
              const secondary =
                whatsappName && whatsappName !== savedName
                  ? `WhatsApp: ${whatsappName}`
                  : contact?.wa_username
                    ? `@${contact.wa_username}`
                    : contact?.phone || '';
              const Icon =
                item.content_type === 'image'
                  ? ImageIcon
                  : item.content_type === 'text'
                    ? MessageSquare
                    : FileText;

              return (
                <div key={item.id} className="flex gap-3 px-5 py-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{savedName}</p>
                        {secondary ? <p className="text-xs text-muted-foreground">{secondary}</p> : null}
                      </div>
                      <time className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), 'dd MMM, h:mm a')}
                      </time>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {item.content_text?.trim() || `Received ${item.content_type}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
