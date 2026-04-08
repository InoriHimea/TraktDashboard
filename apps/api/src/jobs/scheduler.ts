import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { getDb, users } from '@trakt-dashboard/db'
import { triggerIncrementalSync } from '../services/sync.js'

let connection: IORedis | null = null
let syncQueue: Queue | null = null

// Task 2.1: Export getRedis for use in trakt.ts (distributed lock)
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

const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '15')

// Task 5.2: Export registerUserSyncJob for use after new user creation
export async function registerUserSyncJob(userId: number) {
  const queue = getSyncQueue()
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

  // Task 5.1: Register repeat jobs for all existing users instead of setInterval
  const db = getDb()
  const allUsers = await db.select({ id: users.id }).from(users)
  for (const user of allUsers) {
    await registerUserSyncJob(user.id)
  }

  console.log(`[scheduler] Incremental sync scheduled every ${intervalMinutes} minutes`)
}

export async function enqueueSyncNow(userId: number) {
  const queue = getSyncQueue()
  await queue.add('incremental-sync', { userId }, {
    priority: 1,
    removeOnComplete: 5,
  })
}
