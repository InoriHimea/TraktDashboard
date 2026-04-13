import { getDb, users, metadataCache } from '@trakt-dashboard/db'
import { eq, and } from 'drizzle-orm'
import { getRedis } from '../jobs/scheduler.js'

const FETCH_TIMEOUT_MS = 12000

// Proxy support — reads HTTP_PROXY / HTTPS_PROXY from environment
function buildFetchOptions(): RequestInit {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy
  if (!proxyUrl) return {}
  return { proxy: proxyUrl } as RequestInit & { proxy: string }
}
const BASE_FETCH_OPTIONS = buildFetchOptions()

// Reliable timeout via Promise.race (AbortController unreliable in Bun for established connections)
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[trakt] Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ])
}

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  return withTimeout(
    fetch(url, { ...BASE_FETCH_OPTIONS, ...options }),
    FETCH_TIMEOUT_MS,
    url
  )
}

export interface TraktShow {
  title: string
  year: number
  ids: { trakt: number; slug: string; tvdb: number; imdb: string; tmdb: number }
}

export interface TraktWatchedShow {
  plays: number
  last_watched_at: string
  last_updated_at: string
  reset_at: string | null
  show: TraktShow
  seasons: Array<{
    number: number
    episodes: Array<{ number: number; plays: number; last_watched_at: string }>
  }>
}

export interface TraktHistoryEntry {
  id: number
  watched_at: string
  action: string
  type: string
  episode: {
    season: number
    number: number
    title: string
    ids: { trakt: number; tvdb: number; imdb: string; tmdb: number; tvrage: number }
  }
  show: TraktShow
}

export interface TraktShowDetail {
  title: string
  year: number | null
  overview: string | null
  status: string | null
  first_aired: string | null
  network: string | null
  genres: string[]
  ids: {
    trakt: number
    slug: string
    tvdb: number | null
    imdb: string | null
    tmdb: number | null
  }
}

export interface TraktSeasonDetail {
  number: number
  episode_count: number
  first_aired: string | null
  overview: string | null
  ids: {
    trakt: number
    tvdb: number | null
    tmdb: number | null
  }
}

export interface TraktEpisodeDetail {
  number: number
  season: number
  title: string | null
  overview: string | null
  first_aired: string | null
  runtime: number | null
  ids: {
    trakt: number
    tvdb: number | null
    imdb: string | null
    tmdb: number | null
  }
}

export interface TraktShowProgress {
  aired: number
  completed: number
  last_watched_at: string | null
  reset_at: string | null
  seasons: Array<{
    number: number
    title: string
    aired: number
    completed: number
    episodes: Array<{
      number: number
      completed: boolean
      last_watched_at: string | null
    }>
  }>
  next_episode: {
    season: number
    number: number
    title: string
    ids: { trakt: number }
  } | null
}

// Task 8.1: Generic fetch with 429 retry
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchWithTimeout(url, options)
    if (res.status !== 429) return res
    if (attempt === maxRetries) return res
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5')
    console.warn(`[trakt] Rate limited, retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
    await new Promise(r => setTimeout(r, retryAfter * 1000))
  }
  // unreachable
  throw new Error('fetchWithRetry: unreachable')
}

// Task 2.2: Token refresh with Redis distributed lock
async function refreshToken(userId: number): Promise<string> {
  const redis = getRedis()
  const lockKey = `lock:token-refresh:${userId}`

  // Try to acquire lock
  for (let attempt = 0; attempt < 10; attempt++) {
    const acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX')
    if (acquired) {
      try {
        const db = getDb()
        const [user] = await db.select().from(users).where(eq(users.id, userId))
        if (!user) throw new Error('User not found')

        const res = await fetchWithRetry('https://api.trakt.tv/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refresh_token: user.traktRefreshToken,
            client_id: process.env.TRAKT_CLIENT_ID,
            client_secret: process.env.TRAKT_CLIENT_SECRET,
            redirect_uri: process.env.TRAKT_REDIRECT_URI,
            grant_type: 'refresh_token',
          }),
        })

        if (!res.ok) throw new Error('Token refresh failed')

        const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number }

        await db.update(users).set({
          traktAccessToken: data.access_token,
          traktRefreshToken: data.refresh_token,
          tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
          updatedAt: new Date(),
        }).where(eq(users.id, userId))

        return data.access_token
      } finally {
        await redis.del(lockKey)
      }
    }

    // Lock held by another process — wait and re-read token from DB
    await new Promise(r => setTimeout(r, 500))
  }

  // Another process refreshed the token; read the latest from DB
  const db = getDb()
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new Error('User not found')
  return user.traktAccessToken
}

// Cache TTLs in milliseconds
const CACHE_TTL_7D = 7 * 24 * 60 * 60 * 1000
const CACHE_TTL_24H = 24 * 60 * 60 * 1000

interface TraktWatchingResponse {
  expires_at: string
  started_at: string
  action: 'watch'
  type: 'episode'
  episode: {
    season: number
    number: number
    title: string
    runtime: number | null
    ids: { trakt: number; tvdb: number; imdb: string; tmdb: number }
  }
  show: {
    title: string
    ids: { trakt: number; slug: string; tvdb: number; imdb: string; tmdb: number }
  }
}

export function getTraktClient() {
  const clientId = process.env.TRAKT_CLIENT_ID!

  // Task 3.1: traktFetch returns data + headers for pagination support
  async function traktFetchRaw(path: string, userId: number, params?: Record<string, string>): Promise<{ data: any; headers: Headers }> {
    const db = getDb()
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) throw new Error('User not found')

    let token = user.traktAccessToken

    if (new Date(user.tokenExpiresAt) < new Date()) {
      token = await refreshToken(userId)
    }

    const url = new URL(`https://api.trakt.tv${path}`)
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

    // Task 8.2: Use fetchWithRetry
    const res = await fetchWithRetry(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`Trakt API error: ${res.status} ${await res.text()}`)
    }

    return { data: await res.json(), headers: res.headers }
  }

  async function traktFetch<T>(path: string, userId: number, params?: Record<string, string>): Promise<T> {
    const { data } = await traktFetchRaw(path, userId, params)
    return data as T
  }

  return {
    getWatchedShows: (userId: number) =>
      traktFetch<TraktWatchedShow[]>('/sync/watched/shows?extended=noseasons', userId),

    // Task 3.2: getHistory now uses traktFetchRaw (unified token refresh + 429 retry)
    getHistory: async (userId: number, startAt?: string): Promise<TraktHistoryEntry[]> => {
      const all: TraktHistoryEntry[] = []
      let page = 1

      while (true) {
        const params: Record<string, string> = { limit: '100', page: String(page) }
        if (startAt) params.start_at = startAt

        const { data, headers } = await traktFetchRaw('/sync/history/episodes', userId, params)
        all.push(...(data as TraktHistoryEntry[]))

        const pageCount = parseInt(headers.get('X-Pagination-Page-Count') || '1')
        if (page >= pageCount) break
        page++
      }

      return all
    },

    getShowProgress: (userId: number, traktId: number) =>
      traktFetch<TraktShowProgress>(`/shows/${traktId}/progress/watched`, userId),

    getWatching: async (userId: number): Promise<TraktWatchingResponse | null> => {
      const db = getDb()
      const [user] = await db.select().from(users).where(eq(users.id, userId))
      if (!user) throw new Error('User not found')

      let token = user.traktAccessToken
      if (new Date(user.tokenExpiresAt) < new Date()) {
        token = await refreshToken(userId)
      }

      const res = await fetchWithRetry('https://api.trakt.tv/users/me/watching?extended=full', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'trakt-api-version': '2',
          'trakt-api-key': clientId,
          'Content-Type': 'application/json',
        },
      })

      if (res.status === 204) return null
      if (!res.ok) throw new Error(`Trakt watching API error: ${res.status} ${await res.text()}`)
      return res.json() as Promise<TraktWatchingResponse>
    },

    getShowDetail: async (traktId: number, userId: number): Promise<TraktShowDetail> => {
      const db = getDb()
      const externalId = `trakt_show_${traktId}`
      const [cached] = await db.select().from(metadataCache)
        .where(and(eq(metadataCache.source, 'trakt_show'), eq(metadataCache.externalId, externalId)))
      if (cached && Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_7D) {
        return cached.data as TraktShowDetail
      }
      const data = await traktFetch<TraktShowDetail>(`/shows/${traktId}?extended=full`, userId)
      await db.insert(metadataCache)
        .values({ source: 'trakt_show', externalId, data, cachedAt: new Date() })
        .onConflictDoUpdate({
          target: [metadataCache.source, metadataCache.externalId],
          set: { data, cachedAt: new Date() },
        })
      return data
    },

    getSeasons: async (traktId: number, userId: number): Promise<TraktSeasonDetail[]> => {
      const db = getDb()
      const externalId = `trakt_seasons_${traktId}`
      const [cached] = await db.select().from(metadataCache)
        .where(and(eq(metadataCache.source, 'trakt_seasons'), eq(metadataCache.externalId, externalId)))
      if (cached && Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_7D) {
        return cached.data as TraktSeasonDetail[]
      }
      const data = await traktFetch<TraktSeasonDetail[]>(`/shows/${traktId}/seasons?extended=full`, userId)
      await db.insert(metadataCache)
        .values({ source: 'trakt_seasons', externalId, data, cachedAt: new Date() })
        .onConflictDoUpdate({
          target: [metadataCache.source, metadataCache.externalId],
          set: { data, cachedAt: new Date() },
        })
      return data
    },

    getEpisodes: async (traktId: number, seasonNumber: number, userId: number): Promise<TraktEpisodeDetail[]> => {
      const db = getDb()
      const externalId = `trakt_episodes_${traktId}_s${seasonNumber}`
      const [cached] = await db.select().from(metadataCache)
        .where(and(eq(metadataCache.source, 'trakt_episodes'), eq(metadataCache.externalId, externalId)))
      if (cached && Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_24H) {
        return cached.data as TraktEpisodeDetail[]
      }
      const data = await traktFetch<TraktEpisodeDetail[]>(
        `/shows/${traktId}/seasons/${seasonNumber}/episodes?extended=full`, userId
      )
      await db.insert(metadataCache)
        .values({ source: 'trakt_episodes', externalId, data, cachedAt: new Date() })
        .onConflictDoUpdate({
          target: [metadataCache.source, metadataCache.externalId],
          set: { data, cachedAt: new Date() },
        })
      return data
    },

    getEpisodeRating: async (traktId: number, season: number, episode: number, userId: number): Promise<number | null> => {
      try {
        const data = await traktFetch<{ rating: number; votes: number }>(
          `/shows/${traktId}/seasons/${season}/episodes/${episode}/ratings`,
          userId
        )
        // Convert 0-10 float to 0-100 integer
        return Math.round(data.rating * 10)
      } catch (e) {
        console.warn(`[trakt] Episode rating fetch failed for ${traktId} s${season}e${episode}:`, e)
        return null  // Degradation
      }
    },
  }
}
