import { getDb, metadataCache } from '@trakt-dashboard/db'
import { eq, and } from 'drizzle-orm'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const CACHE_TTL_HOURS = 24 * 7 // 7 days
const FETCH_TIMEOUT_MS = 15000

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error(`TMDB request timeout after ${FETCH_TIMEOUT_MS}ms`)
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

export interface TmdbShow {
  id: number
  name: string
  overview: string
  status: string
  first_air_date: string
  networks: Array<{ name: string }>
  genres: Array<{ id: number; name: string }>
  poster_path: string | null
  backdrop_path: string | null
  number_of_episodes: number
  number_of_seasons: number
  external_ids?: { imdb_id?: string; tvdb_id?: number }
  seasons: Array<{
    id: number
    season_number: number
    episode_count: number
    air_date: string
    overview: string
    poster_path: string | null
  }>
}

export interface TmdbSeason {
  id: number
  season_number: number
  episodes: Array<{
    id: number
    episode_number: number
    season_number: number
    name: string
    overview: string
    runtime: number | null
    air_date: string | null
    still_path: string | null
  }>
}

// Task 8.3: 429 retry for TMDB
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchWithTimeout(url)
    if (res.status !== 429) return res
    if (attempt === maxRetries) return res
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5')
    console.warn(`[tmdb] Rate limited, retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
    await new Promise(r => setTimeout(r, retryAfter * 1000))
  }
  throw new Error('fetchWithRetry: unreachable')
}

async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', process.env.TMDB_API_KEY!)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetchWithRetry(url.toString())
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export async function getTmdbShow(tmdbId: number): Promise<TmdbShow> {
  const db = getDb()
  const cacheKey = String(tmdbId)

  // Check cache
  const [cached] = await db.select()
    .from(metadataCache)
    .where(and(eq(metadataCache.source, 'tmdb_show'), eq(metadataCache.externalId, cacheKey)))

  if (cached) {
    const age = Date.now() - new Date(cached.cachedAt).getTime()
    if (age < CACHE_TTL_HOURS * 60 * 60 * 1000) {
      return cached.data as TmdbShow
    }
  }

  const data = await tmdbFetch<TmdbShow>(`/tv/${tmdbId}`, {
    append_to_response: 'external_ids',
  })

  await db.insert(metadataCache)
    .values({ source: 'tmdb_show', externalId: cacheKey, data, cachedAt: new Date() })
    .onConflictDoUpdate({
      target: [metadataCache.source, metadataCache.externalId],
      set: { data, cachedAt: new Date() },
    })

  return data
}

export async function getTmdbSeason(tmdbId: number, seasonNumber: number): Promise<TmdbSeason> {
  const db = getDb()
  const cacheKey = `${tmdbId}_s${seasonNumber}`

  const [cached] = await db.select()
    .from(metadataCache)
    .where(and(eq(metadataCache.source, 'tmdb_season'), eq(metadataCache.externalId, cacheKey)))

  if (cached) {
    const age = Date.now() - new Date(cached.cachedAt).getTime()
    if (age < CACHE_TTL_HOURS * 60 * 60 * 1000) {
      return cached.data as TmdbSeason
    }
  }

  const data = await tmdbFetch<TmdbSeason>(`/tv/${tmdbId}/season/${seasonNumber}`)

  await db.insert(metadataCache)
    .values({ source: 'tmdb_season', externalId: cacheKey, data, cachedAt: new Date() })
    .onConflictDoUpdate({
      target: [metadataCache.source, metadataCache.externalId],
      set: { data, cachedAt: new Date() },
    })

  return data
}

export function getTmdbImageUrl(path: string | null, size = 'w500'): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}
