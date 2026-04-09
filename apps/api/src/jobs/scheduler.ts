import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { getDb, users, userSettings } from '@trakt-dashboard/db'
import { eq } from 'drizzle-orm'
import { triggerIncrementalSync } from '../services/sync.js'

let connection: IORedis | null = null
let syncQueue: Queue | null = null

export function getRedis() {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    })
  }
  return connection
}

export function getSyncQueue() {
  if (!syncQueue) {
    syncQueue = new Queue('sync', { connection: getRedis() })
  }
  return syncQueue
}

// Task 8.1: Read syncIntervalMinutes from user_settings, fallback to env/default
async function getUserSyncInterval(userId: number): Promise<number> {
  try {
    const db = getDb()
    const [row] = await db.select({ syncIntervalMinutes: userSettings.syncIntervalMinutes })
      .from(userSettings).where(eq(userSettings.userId, userId))
    if (row?.syncIntervalMinutes) return row.syncIntervalMinutes
  } catch {
    console.warn(`[scheduler] Failed to read syncIntervalMinutes for user ${userId}, using default`)
  }
  return parseInt(process.env.SYNC_INTERVAL_MINUTES || '60')
}

export async function registerUserSyncJob(userId: number) {
  const queue = getSyncQueue()
  const intervalMinutes = await getUserSyncInterval(userId)
  await queue.add(
    'incremental-sync',
    { userId },
    {
      jobId: `sync-user-${userId}`,
      repeat: { every: intervalMinutes * 60 * 1000 },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  )
  console.log(`[scheduler] Registered sync job for user ${userId} every ${intervalMinutes} minutes`)
}

export async function startScheduler() {
  const redis = getRedis()
  const queue = getSyncQueue()

  // Worker processes sync jobs
  const worker = new Worker('sync', async (job) => {
    if (job.name === 'incremental-sync') {
      const { userId } = job.data
      console.log(`[scheduler] Running incremental sync for user ${userId}`)
      await triggerIncrementalSync(userId)
    }
  }, { connection: redis, concurrency: 1 })

  worker.on('failed', (job, err) => {
    console.error(`[scheduler] Job ${job?.id} failed:`, err)
  })

  // Register repeat jobs for all existing users
  const db = getDb()
  const allUsers = await db.select({ id: users.id }).from(users)
  for (const user of allUsers) {
    await registerUserSyncJob(user.id)
  }

  console.log(`[scheduler] Scheduler started`)
}

export async function enqueueSyncNow(userId: number) {
  const queue = getSyncQueue()
  await queue.add('incremental-sync', { userId }, {
    priority: 1,
    removeOnComplete: 5,
  })
}
