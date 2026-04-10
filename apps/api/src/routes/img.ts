import { Hono } from 'hono'
import { getDb, metadataCache } from '@trakt-dashboard/db'
import { and, eq } from 'drizzle-orm'
import { getProxyUrl } from '../services/tmdb.js'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
// Cache images for 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const imgRoutes = new Hono()

/**
 * GET /api/img/:size/:path
 * Proxy + cache TMDB images locally.
 * e.g. /api/img/w342/abc123.jpg → fetches https://image.tmdb.org/t/p/w342/abc123.jpg
 */
imgRoutes.get('/:size/:filename{.+}', async (c) => {
  const size = c.req.param('size')
  const filename = '/' + c.req.param('filename')
  const cacheKey = `${size}${filename}`

  const db = getDb()

  // Check cache
  const [cached] = await db.select()
    .from(metadataCache)
    .where(and(eq(metadataCache.source, 'tmdb_img'), eq(metadataCache.externalId, cacheKey)))

  if (cached) {
    const age = Date.now() - new Date(cached.cachedAt).getTime()
    if (age < CACHE_TTL_MS) {
      const { contentType, base64 } = cached.data as { contentType: string; base64: string }
      const buf = Buffer.from(base64, 'base64')
      return new Response(buf, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=604800, immutable',
          'X-Cache': 'HIT',
        },
      })
    }
  }

  // Fetch from TMDB
  const url = `${TMDB_IMAGE_BASE}/${size}${filename}`
  const proxyUrl = await getProxyUrl()

  let fetchOptions: RequestInit = {}
  if (proxyUrl) {
    fetchOptions = { proxy: proxyUrl } as RequestInit & { proxy: string }
  }

  let upstream: Response
  try {
    upstream = await fetch(url, fetchOptions)
  } catch (e) {
    return c.json({ error: 'Failed to fetch image' }, 502)
  }

  if (!upstream.ok) {
    return new Response(null, { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg'
  const arrayBuf = await upstream.arrayBuffer()
  const base64 = Buffer.from(arrayBuf).toString('base64')

  // Store in cache
  await db.insert(metadataCache)
    .values({ source: 'tmdb_img', externalId: cacheKey, data: { contentType, base64 }, cachedAt: new Date() })
    .onConflictDoUpdate({
      target: [metadataCache.source, metadataCache.externalId],
      set: { data: { contentType, base64 }, cachedAt: new Date() },
    })

  return new Response(Buffer.from(base64, 'base64'), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
      'X-Cache': 'MISS',
    },
  })
})
