import './load-env.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth.js'
import { showRoutes } from './routes/shows.js'
import { syncRoutes } from './routes/sync.js'
import { statsRoutes } from './routes/stats.js'
import { settingsRoutes } from './routes/settings.js'
import { authMiddleware } from './middleware/auth.js'
import { startScheduler } from './jobs/scheduler.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Public routes
app.route('/auth', authRoutes)
app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

// Protected routes
const api = new Hono()
api.use('*', authMiddleware)
api.route('/shows', showRoutes)
api.route('/sync', syncRoutes)
api.route('/stats', statsRoutes)
api.route('/settings', settingsRoutes)

app.route('/api', api)

// 404
app.notFound((c) => c.json({ error: 'not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message }, 500)
})

const port = parseInt(process.env.API_PORT || '3001')

startScheduler()

console.log(`🚀 API running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
