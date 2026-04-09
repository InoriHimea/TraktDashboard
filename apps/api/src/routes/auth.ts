import { Hono } from 'hono'
import { setCookie, getCookie } from 'hono/cookie'
import { getDb, users, syncState } from '@trakt-dashboard/db'
import { eq } from 'drizzle-orm'
import { signToken, verifyToken } from '../middleware/auth.js'
import { getTraktClient } from '../services/trakt.js'
import { triggerFullSync } from '../services/sync.js'
import { registerUserSyncJob } from '../jobs/scheduler.js'

export const authRoutes = new Hono()

// GET /auth/trakt — start OAuth
authRoutes.get('/trakt', (c) => {
  const clientId = process.env.TRAKT_CLIENT_ID!
  const redirectUri = process.env.TRAKT_REDIRECT_URI!
  const url = `https://trakt.tv/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
  return c.redirect(url)
})

// GET /auth/callback — handle OAuth callback
authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) return c.json({ error: 'Missing code' }, 400)

  const clientId = process.env.TRAKT_CLIENT_ID!
  const clientSecret = process.env.TRAKT_CLIENT_SECRET!
  const redirectUri = process.env.TRAKT_REDIRECT_URI!

  // Exchange code for tokens
  const tokenRes = await fetch('https://api.trakt.tv/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return c.json({ error: 'Token exchange failed' }, 400)
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  // Fetch Trakt profile
  const profileRes = await fetch('https://api.trakt.tv/users/me', {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
    },
  })
  const profile = profileRes.ok ? await profileRes.json() as { username: string } : null

  const db = getDb()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  // Upsert user (single-user app, always id=1 for simplicity)
  const existing = await db.select().from(users).limit(1)

  let userId: number
  if (existing.length > 0) {
    await db.update(users)
      .set({
        traktAccessToken: tokens.access_token,
        traktRefreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        traktUsername: profile?.username || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id))
    userId = existing[0].id

    // Ensure syncState exists for existing users (may be missing on first run)
    await db.insert(syncState).values({ userId }).onConflictDoNothing()
    // Re-register repeat job in case it was lost after restart
    await registerUserSyncJob(userId)
  } else {
    const [newUser] = await db.insert(users).values({
      traktAccessToken: tokens.access_token,
      traktRefreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
      traktUsername: profile?.username || null,
    }).returning()
    userId = newUser.id

    // Init sync state
    await db.insert(syncState).values({ userId }).onConflictDoNothing()

    // Task 5.3: Register repeat sync job for new user
    await registerUserSyncJob(userId)
  }

  const session = await signToken(userId)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  setCookie(c, 'session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  // Kick off full sync in background
  triggerFullSync(userId).catch(console.error)

  return c.redirect(`${frontendUrl}?auth=success`)
})

// GET /auth/me — current auth status
authRoutes.get('/me', async (c) => {
  const cookieToken = getCookie(c, 'session')
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '') || cookieToken

  if (!token) return c.json({ authenticated: false, user: null })

  const userId = await verifyToken(token)
  if (!userId) return c.json({ authenticated: false, user: null })

  const db = getDb()
  const [user] = await db.select({
    id: users.id,
    traktUsername: users.traktUsername,
  }).from(users).where(eq(users.id, userId))

  return c.json({ authenticated: !!user, user: user || null })
})

// POST /auth/logout
authRoutes.post('/logout', (c) => {
  setCookie(c, 'session', '', { maxAge: 0, path: '/' })
  return c.json({ ok: true })
})
