'use client';

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { createClient } from '@/lib/supabase/client'
import { loadActivity } from '@/lib/dashboard/queries'
import type { ActivityItem } from '@/lib/dashboard/types'

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await loadActivity(createClient(), 100))
    } catch (error) {
      console.error('[activity] load failed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Recent activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Incoming WhatsApp messages and newly added contacts. Message data is retained for three days.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <ActivityFeed items={items} loading={loading} />
    </div>
  )
}
