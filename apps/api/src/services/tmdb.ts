import { getDb, metadataCache, userSettings } from '@trakt-dashboard/db'
import { eq, and } from 'drizzle-orm'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const CACHE_TTL_HOURS = 24 * 7
const FETCH_TIMEOUT_MS = 12000

// ─── Dynamic proxy (Task 6.3) ─────────────────────────────────────────────────
export async function getProxyUrl(userId?: number): Promise<string | undefined> {
  if (userId) {
    try {
      const db = getDb()
      const [row] = await db.select({ httpProxy: userSettings.httpProxy })
        .from(userSettings).where(eq(userSettings.userId, userId))
      if (row?.httpProxy) return row.httpProxy
    } catch { /* fall through */ }
  }
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY ||
    process.env.https_proxy || process.env.http_proxy || undefined
}

function buildFetchOptions(proxyUrl?: string): RequestInit {
  if (!proxyUrl) return {}
  return { proxy: proxyUrl } as RequestInit & { proxy: string }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[tmdb] Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ])
}

async function fetchWithRetry(url: string, proxyUrl?: string, maxRetries = 3): Promise<Response> {
  const options = buildFetchOptions(proxyUrl)
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await withTimeout(fetch(url, options), FETCH_TIMEOUT_MS, url)
    if (res.status !== 429) return res
    if (attempt === maxRetries) return res
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5')
    console.warn(`[tmdb] Rate limited, retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`)
    await new Promise(r => setTimeout(r, retryAfter * 1000))
  }
  throw new Error('fetchWithRetry: unreachable')
}

async function tmdbFetch<T>(path: string, params?: Record<string, string>, userId?: number): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', process.env.TMDB_API_KEY!)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const proxyUrl = await getProxyUrl(userId)
  const res = await fetchWithRetry(url.toString(), proxyUrl)
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TmdbShow {
  id: number
  name: string
  original_name: string
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

// ─── Public API ───────────────────────────────────────────────────────────────

// Task 6.2: language param → separate cache key per language
export async function getTmdbShow(tmdbId: number, language?: string, userId?: number): Promise<TmdbShow> {
  const db = getDb()
  const cacheKey = language ? `${tmdbId}_${language}` : String(tmdbId)

  const [cached] = await db.select()
    .from(metadataCache)
    .where(and(eq(metadataCache.source, 'tmdb_show'), eq(metadataCache.externalId, cacheKey)))

  if (cached) {
    const age = Date.now() - new Date(cached.cachedAt).getTime()
    if (age < CACHE_TTL_HOURS * 60 * 60 * 1000) return cached.data as TmdbShow
  }

  const params: Record<string, string> = { append_to_response: 'external_ids' }
  if (language) params.language = language

  const data = await tmdbFetch<TmdbShow>(`/tv/${tmdbId}`, params, userId)

  await db.insert(metadataCache)
    .values({ source: 'tmdb_show', externalId: cacheKey, data, cachedAt: new Date() })
    .onConflictDoUpdate({
      target: [metadataCache.source, metadataCache.externalId],
      set: { data, cachedAt: new Date() },
    })

  return data
}

export async function getTmdbSeason(tmdbId: number, seasonNumber: number, language?: string, userId?: number): Promise<TmdbSeason> {
  const db = getDb()
  // Language-aware cache key — prevents stale English cache being reused for localized requests
  const cacheKey = language ? `${tmdbId}_s${seasonNumber}_${language}` : `${tmdbId}_s${seasonNumber}`

  const [cached] = await db.select()
    .from(metadataCache)
    .where(and(eq(metadataCache.source, 'tmdb_season'), eq(metadataCache.externalId, cacheKey)))

  if (cached) {
    const age = Date.now() - new Date(cached.cachedAt).getTime()
    if (age < CACHE_TTL_HOURS * 60 * 60 * 1000) return cached.data as TmdbSeason
  }

  const params: Record<string, string> = {}
  if (language) params.language = language

  const data = await tmdbFetch<TmdbSeason>(`/tv/${tmdbId}/season/${seasonNumber}`, params, userId)

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
