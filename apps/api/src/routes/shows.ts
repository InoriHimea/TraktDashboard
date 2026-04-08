import { Hono } from 'hono'
import { getDb, shows, seasons, episodes, watchHistory, userShowProgress } from '@trakt-dashboard/db'
import { eq, and, desc, asc, sql, like, or } from 'drizzle-orm'
import type { ShowProgress, SeasonProgress, EpisodeProgress } from '@trakt-dashboard/types'

export const showRoutes = new Hono<{ Variables: { userId: number } }>()

// GET /api/shows/progress — all shows with progress for the user
showRoutes.get('/progress', async (c) => {
  const userId = c.get('userId')
  const db = getDb()
  const filter = c.req.query('filter') || 'watching' // watching | completed | all
  const search = c.req.query('q') || ''
  // Task 4.1: Pagination support
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
  const offset = parseInt(c.req.query('offset') || '0')

  const whereClause = and(
    eq(userShowProgress.userId, userId),
    search ? or(like(shows.title, `%${search}%`)) : undefined,
    filter === 'watching' ? eq(userShowProgress.completed, false) : undefined,
    filter === 'completed' ? eq(userShowProgress.completed, true) : undefined,
  )

  const [{ total }] = await db.select({ total: sql<number>`count(*)` })
    .from(userShowProgress)
    .innerJoin(shows, eq(userShowProgress.showId, shows.id))
    .where(whereClause)

  const progressRows = await db.select({
    progress: userShowProgress,
    show: shows,
    nextEp: episodes,
  })
    .from(userShowProgress)
    .innerJoin(shows, eq(userShowProgress.showId, shows.id))
    .leftJoin(episodes, eq(userShowProgress.nextEpisodeId, episodes.id))
    .where(whereClause)
    .orderBy(desc(userShowProgress.lastWatchedAt))
    .limit(limit)
    .offset(offset)

  const result = progressRows.map(row => ({
    show: {
      id: row.show.id,
      tmdbId: row.show.tmdbId,
      tvdbId: row.show.tvdbId,
      imdbId: row.show.imdbId,
      traktId: row.show.traktId,
      traktSlug: row.show.traktSlug,
      title: row.show.title,
      overview: row.show.overview,
      status: row.show.status,
      firstAired: row.show.firstAired,
      network: row.show.network,
      genres: row.show.genres as string[],
      posterPath: row.show.posterPath,
      backdropPath: row.show.backdropPath,
      totalEpisodes: row.show.totalEpisodes,
      totalSeasons: row.show.totalSeasons,
      lastSyncedAt: row.show.lastSyncedAt.toISOString(),
      createdAt: row.show.createdAt.toISOString(),
    },
    airedEpisodes: row.progress.airedEpisodes,
    watchedEpisodes: row.progress.watchedEpisodes,
    nextEpisode: row.nextEp ? {
      id: row.nextEp.id,
      showId: row.nextEp.showId,
      seasonId: row.nextEp.seasonId,
      seasonNumber: row.nextEp.seasonNumber,
      episodeNumber: row.nextEp.episodeNumber,
      title: row.nextEp.title,
      overview: row.nextEp.overview,
      runtime: row.nextEp.runtime,
      airDate: row.nextEp.airDate,
      stillPath: row.nextEp.stillPath,
      traktId: row.nextEp.traktId,
      tmdbId: row.nextEp.tmdbId,
    } : null,
    lastWatchedAt: row.progress.lastWatchedAt?.toISOString() || null,
    completed: row.progress.completed,
    percentage: row.progress.airedEpisodes > 0
      ? Math.round((row.progress.watchedEpisodes / row.progress.airedEpisodes) * 100)
      : 0,
    seasons: [],
  } satisfies ShowProgress))

  return c.json({ data: result, total: Number(total), limit, offset })
})

// GET /api/shows/:id — single show with full season/episode progress
showRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const showId = parseInt(c.req.param('id'))
  const db = getDb()

  const [show] = await db.select().from(shows).where(eq(shows.id, showId))
  if (!show) return c.json({ error: 'Show not found' }, 404)

  const [progress] = await db.select().from(userShowProgress)
    .where(and(eq(userShowProgress.userId, userId), eq(userShowProgress.showId, showId)))

  const allSeasons = await db.select().from(seasons)
    .where(eq(seasons.showId, showId))
    .orderBy(asc(seasons.seasonNumber))

  const allEpisodes = await db.select().from(episodes)
    .where(eq(episodes.showId, showId))
    .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber))

  // Get all watched episode IDs for this show and user
  const watched = await db.select({ episodeId: watchHistory.episodeId, watchedAt: watchHistory.watchedAt })
    .from(watchHistory)
    .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
    .where(and(eq(watchHistory.userId, userId), eq(episodes.showId, showId)))
    .orderBy(desc(watchHistory.watchedAt))

  const watchedMap = new Map<number, string>()
  for (const w of watched) {
    if (!watchedMap.has(w.episodeId)) {
      watchedMap.set(w.episodeId, w.watchedAt.toISOString())
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const seasonData: SeasonProgress[] = allSeasons.map(s => {
    const sEps = allEpisodes.filter(e => e.seasonNumber === s.seasonNumber)
    const epProgress: EpisodeProgress[] = sEps.map(ep => {
      const watchedAt = watchedMap.get(ep.id) || null
      const aired = !!ep.airDate && ep.airDate <= today
      return {
        episodeId: ep.id,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        airDate: ep.airDate,
        watched: watchedMap.has(ep.id),
        watchedAt,
        aired,
      }
    })

    const airedCount = epProgress.filter(e => e.aired).length
    const watchedCount = epProgress.filter(e => e.watched).length

    return {
      seasonNumber: s.seasonNumber,
      episodeCount: s.episodeCount,
      airedCount,
      watchedCount,
      episodes: epProgress,
    }
  })

  const airedEpisodes = progress?.airedEpisodes ?? 0
  const watchedEpisodes = progress?.watchedEpisodes ?? 0

  return c.json({
    data: {
      show: {
        ...show,
        genres: show.genres as string[],
        lastSyncedAt: show.lastSyncedAt.toISOString(),
        createdAt: show.createdAt.toISOString(),
      },
      airedEpisodes,
      watchedEpisodes,
      nextEpisode: null,
      lastWatchedAt: progress?.lastWatchedAt?.toISOString() || null,
      completed: progress?.completed ?? false,
      percentage: airedEpisodes > 0 ? Math.round((watchedEpisodes / airedEpisodes) * 100) : 0,
      seasons: seasonData,
    } satisfies ShowProgress,
  })
})

// GET /api/shows/:id/seasons — season breakdown only
showRoutes.get('/:id/seasons', async (c) => {
  const userId = c.get('userId')
  const showId = parseInt(c.req.param('id'))
  const db = getDb()

  const allSeasons = await db.select().from(seasons)
    .where(eq(seasons.showId, showId))
    .orderBy(asc(seasons.seasonNumber))

  return c.json({ data: allSeasons })
})
