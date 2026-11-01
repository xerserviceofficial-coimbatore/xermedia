'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Activity, BookUser, Inbox, MessageSquare } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'

type DashboardStats = {
  contacts: number
  conversations: number
  unread: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      const [{ count: contacts }, { count: conversations }, { data: unreadRows }] =
        await Promise.all([
          supabase.from('contacts').select('id', { count: 'exact', head: true }),
          supabase.from('conversations').select('id', { count: 'exact', head: true }),
          supabase.from('conversations').select('unread_count'),
        ])

      if (cancelled) return
      setStats({
        contacts: contacts ?? 0,
        conversations: conversations ?? 0,
        unread: (unreadRows ?? []).reduce(
          (sum, row) => sum + Number(row.unread_count ?? 0),
          0,
        ),
      })
    }

    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const cards = [
    {
      label: 'Contacts',
      value: stats?.contacts ?? '—',
      icon: BookUser,
      href: '/contacts',
    },
    {
      label: 'Conversations',
      value: stats?.conversations ?? '—',
      icon: MessageSquare,
      href: '/inbox',
    },
    {
      label: 'Unread',
      value: stats?.unread ?? '—',
      icon: Inbox,
      href: '/inbox?filter=unread',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          XerMedia
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Receive-only WhatsApp inbox for incoming messages and files.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <card.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/inbox"
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/40"
        >
          <Inbox className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-semibold text-foreground">Open Inbox</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Read incoming WhatsApp messages and files. Sending is disabled.
          </p>
        </Link>

        <Link
          href="/contacts"
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/40"
        >
          <BookUser className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-semibold text-foreground">Contacts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage saved contacts, fields and tags.
          </p>
        </Link>

        <Link
          href="/activity"
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/40"
        >
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="mt-3 font-semibold text-foreground">Recent activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View recent inbound activity on its own page.
          </p>
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">3-day data retention</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Incoming message records and mirrored inbound media are automatically cleaned up after three days.
        </p>
      </div>
    </div>
  )
}
