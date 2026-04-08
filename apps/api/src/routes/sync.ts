import { Hono } from 'hono'
import { getDb, syncState, watchHistory, episodes, shows, userShowProgress } from '@trakt-dashboard/db'
import { eq, desc, sql, and } from 'drizzle-orm'
import { triggerFullSync } from '../services/sync.js'
import { enqueueSyncNow } from '../jobs/scheduler.js'

export const syncRoutes = new Hono<{ Variables: { userId: number } }>()

// GET /api/sync/status
syncRoutes.get('/status', async (c) => {
  const userId = c.get('userId')
  const db = getDb()
  const [state] = await db.select().from(syncState).where(eq(syncState.userId, userId))

  return c.json({
    data: {
      status: state?.status || 'idle',
      lastSyncAt: state?.lastSyncAt?.toISOString() || null,
      currentShow: state?.currentShow || null,
      progress: state?.progress || 0,
      total: state?.total || 0,
      error: state?.error || null,
      // Task 7.4: Include failedShows in status response
      failedShows: (state?.failedShows as Array<{ tmdbId: number; title: string; error: string }>) || [],
    },
  })
})

// POST /api/sync/trigger — manual incremental sync
syncRoutes.post('/trigger', async (c) => {
  const userId = c.get('userId')
  await enqueueSyncNow(userId)
  return c.json({ ok: true, message: 'Sync queued' })
})

// POST /api/sync/full — full re-sync
syncRoutes.post('/full', async (c) => {
  const userId = c.get('userId')
  triggerFullSync(userId).catch(console.error)
  return c.json({ ok: true, message: 'Full sync started' })
})
