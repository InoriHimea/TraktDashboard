import { Hono } from 'hono'
import { getDb, movies, watchHistory, userMovieProgress } from '@trakt-dashboard/db'
import { eq, and, desc, sql, gt, like } from 'drizzle-orm'
import type { MovieProgress, MovieWatchHistoryEntry } from '@trakt-dashboard/types'

export const movieRoutes = new Hono<{ Variables: { userId: number } }>()

function parseBoundedInt(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

async function recalcMovieProgress(userId: number, movieId: number): Promise<void> {
  const db = getDb()
  const [{ count, lastWatched }] = await db
    .select({
      count: sql<number>`count(*)`,
      lastWatched: sql<Date | null>`max(watched_at)`,
    })
    .from(watchHistory)
    .where(and(
      eq(watchHistory.userId, userId),
      eq(watchHistory.movieId, movieId),
      eq(watchHistory.mediaType, 'movie'),
    ))

  await db
    .insert(userMovieProgress)
    .values({ userId, movieId, watchCount: Number(count), lastWatchedAt: lastWatched })
    .onConflictDoUpdate({
      target: [userMovieProgress.userId, userMovieProgress.movieId],
      set: { watchCount: Number(count), lastWatchedAt: lastWatched, updatedAt: new Date() },
    })
}

// GET /api/movies/progress
movieRoutes.get('/progress', async (c) => {
  const userId = c.get('userId')
  const db = getDb()
  const rawFilter = c.req.query('filter') || 'watched'
  const filter = ['watched', 'unwatched', 'all'].includes(rawFilter) ? rawFilter : 'watched'
  const search = (c.req.query('q') || '').trim()
  const limit = parseBoundedInt(c.req.query('limit'), 50, 1, 200)
  const offset = parseBoundedInt(c.req.query('offset'), 0, 0, 1_000_000)

  const whereClause = and(
    eq(userMovieProgress.userId, userId),
    search ? like(movies.title, `%${search}%`) : undefined,
    filter === 'watched' ? gt(userMovieProgress.watchCount, 0) : undefined,
    filter === 'unwatched' ? eq(userMovieProgress.watchCount, 0) : undefined,
  )

  const [{ total }] = await db.select({ total: sql<number>`count(*)` })
    .from(userMovieProgress)
    .innerJoin(movies, eq(userMovieProgress.movieId, movies.id))
    .where(whereClause)

  const rows = await db.select({
    progress: userMovieProgress,
    movie: movies,
  })
    .from(userMovieProgress)
    .innerJoin(movies, eq(userMovieProgress.movieId, movies.id))
    .where(whereClause)
    .orderBy(desc(userMovieProgress.lastWatchedAt))
    .limit(limit)
    .offset(offset)

  const result: MovieProgress[] = rows.map(row => ({
    movie: {
      id: row.movie.id,
      tmdbId: row.movie.tmdbId,
      imdbId: row.movie.imdbId ?? null,
      traktId: row.movie.traktId ?? null,
      traktSlug: row.movie.traktSlug ?? null,
      title: row.movie.title,
      overview: row.movie.overview ?? null,
      releaseDate: row.movie.releaseDate ?? null,
      runtime: row.movie.runtime ?? null,
      posterPath: row.movie.posterPath ?? null,
      backdropPath: row.movie.backdropPath ?? null,
      genres: row.movie.genres as string[],
      lastSyncedAt: row.movie.lastSyncedAt.toISOString(),
      createdAt: row.movie.createdAt.toISOString(),
    },
    watchCount: row.progress.watchCount,
    lastWatchedAt: row.progress.lastWatchedAt?.toISOString() ?? null,
  }))

  return c.json({ data: result, total: Number(total), limit, offset })
})

// GET /api/movies/:id
movieRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const movieId = parseBoundedInt(c.req.param('id'), -1, 1, Number.MAX_SAFE_INTEGER)
  if (movieId < 1) return c.json({ error: 'Invalid movie id' }, 400)
  const db = getDb()

  const [movie] = await db.select().from(movies).where(eq(movies.id, movieId))
  if (!movie) return c.json({ error: 'Movie not found' }, 404)

  const [progress] = await db.select().from(userMovieProgress)
    .where(and(eq(userMovieProgress.userId, userId), eq(userMovieProgress.movieId, movieId)))

  if (!progress) return c.json({ error: 'Movie not found' }, 404)

  const data: MovieProgress = {
    movie: {
      id: movie.id,
      tmdbId: movie.tmdbId,
      imdbId: movie.imdbId ?? null,
      traktId: movie.traktId ?? null,
      traktSlug: movie.traktSlug ?? null,
      title: movie.title,
      overview: movie.overview ?? null,
      releaseDate: movie.releaseDate ?? null,
      runtime: movie.runtime ?? null,
      posterPath: movie.posterPath ?? null,
      backdropPath: movie.backdropPath ?? null,
      genres: movie.genres as string[],
      lastSyncedAt: movie.lastSyncedAt.toISOString(),
      createdAt: movie.createdAt.toISOString(),
    },
    watchCount: progress.watchCount,
    lastWatchedAt: progress.lastWatchedAt?.toISOString() ?? null,
  }

  return c.json({ data })
})

// GET /api/movies/:id/history
movieRoutes.get('/:id/history', async (c) => {
  const userId = c.get('userId')
  const movieId = parseBoundedInt(c.req.param('id'), -1, 1, Number.MAX_SAFE_INTEGER)
  if (movieId < 1) return c.json({ error: 'Invalid movie id' }, 400)
  const db = getDb()

  const history = await db.select({
    id: watchHistory.id,
    movieId: watchHistory.movieId,
    watchedAt: watchHistory.watchedAt,
    source: watchHistory.source,
  })
    .from(watchHistory)
    .where(and(
      eq(watchHistory.userId, userId),
      eq(watchHistory.movieId, movieId),
      eq(watchHistory.mediaType, 'movie'),
    ))
    .orderBy(sql`watched_at DESC NULLS LAST`)

  const data: MovieWatchHistoryEntry[] = history.map(h => ({
    id: h.id,
    movieId: h.movieId!,
    watchedAt: h.watchedAt?.toISOString() ?? null,
    source: h.source,
  }))

  return c.json({ data })
})

// POST /api/movies/:id/watch
movieRoutes.post('/:id/watch', async (c) => {
  const userId = c.get('userId')
  const movieId = parseBoundedInt(c.req.param('id'), -1, 1, Number.MAX_SAFE_INTEGER)
  if (movieId < 1) return c.json({ error: 'Invalid movie id' }, 400)
  const db = getDb()

  const [movie] = await db.select().from(movies).where(eq(movies.id, movieId))
  if (!movie) return c.json({ error: 'Movie not found' }, 404)

  const body = await c.req.json()
  const watchedAt: string | null = body.watchedAt ?? null

  const [result] = await db.insert(watchHistory).values({
    userId,
    episodeId: null,
    movieId,
    mediaType: 'movie',
    watchedAt: watchedAt ? new Date(watchedAt) : null,
    source: 'manual',
  }).returning({ id: watchHistory.id })

  await recalcMovieProgress(userId, movieId)

  return c.json({ ok: true, historyId: result.id }, 201)
})

// DELETE /api/movies/:id/history/:historyId
movieRoutes.delete('/:id/history/:historyId', async (c) => {
  const userId = c.get('userId')
  const movieId = parseBoundedInt(c.req.param('id'), -1, 1, Number.MAX_SAFE_INTEGER)
  const historyId = parseBoundedInt(c.req.param('historyId'), -1, 1, Number.MAX_SAFE_INTEGER)

  if (movieId < 1 || historyId < 1) return c.json({ error: 'Invalid parameters' }, 400)
  const db = getDb()

  // Verify ownership: record must belong to this user and this movie
  const [record] = await db.select()
    .from(watchHistory)
    .where(and(
      eq(watchHistory.id, historyId),
      eq(watchHistory.userId, userId),
      eq(watchHistory.movieId, movieId),
      eq(watchHistory.mediaType, 'movie'),
    ))

  if (!record) return c.json({ error: 'History record not found' }, 404)

  await db.delete(watchHistory).where(eq(watchHistory.id, historyId))

  await recalcMovieProgress(userId, movieId)

  return c.json({ ok: true })
})
