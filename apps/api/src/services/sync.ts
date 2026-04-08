import { getDb, shows, seasons, episodes, watchHistory, userShowProgress, syncState } from '@trakt-dashboard/db'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { getTraktClient } from './trakt.js'
import { getTmdbShow, getTmdbSeason } from './tmdb.js'
import pLimit from 'p-limit'
import dayjs from 'dayjs'

const limit = pLimit(3) // max 3 concurrent TMDB requests

export async function triggerFullSync(userId: number): Promise<void> {
  const db = getDb()
  await db.update(syncState).set({
    status: 'running', progress: 0, total: 0, error: null, currentShow: null, updatedAt: new Date(),
  }).where(eq(syncState.userId, userId))

  try {
    const trakt = getTraktClient()
    console.log(`[sync] Starting full sync for user ${userId}`)

    const watchedShows = await trakt.getWatchedShows(userId)
    console.log(`[sync] Found ${watchedShows.length} watched shows`)

    await db.update(syncState).set({ total: watchedShows.length, updatedAt: new Date() }).where(eq(syncState.userId, userId))

    let done = 0
    // Task 7.3: Collect per-show failures
    const failures: Array<{ tmdbId: number; title: string; error: string }> = []

    await Promise.all(watchedShows.map(ws => limit(async () => {
      try {
        const tmdbId = ws.show.ids.tmdb
        if (!tmdbId) return

        await db.update(syncState).set({ currentShow: ws.show.title, updatedAt: new Date() }).where(eq(syncState.userId, userId))

        // Upsert show from TMDB
        const showId = await upsertShowFromTmdb(tmdbId, ws.show)

        // Get detailed progress from Trakt
        const progress = await trakt.getShowProgress(userId, ws.show.ids.trakt)

        // Upsert episodes and watch history
        await syncEpisodeProgress(userId, showId, tmdbId, progress)

        // Update show progress summary
        await recalcShowProgress(userId, showId)

        done++
        await db.update(syncState).set({ progress: done, updatedAt: new Date() }).where(eq(syncState.userId, userId))
        console.log(`[sync] ${done}/${watchedShows.length} ${ws.show.title}`)
      } catch (e: any) {
        console.error(`[sync] Error syncing ${ws.show.title}:`, e)
        failures.push({ tmdbId: ws.show.ids.tmdb, title: ws.show.title, error: String(e?.message || e) })
      }
    })))

    const lastSync = new Date()
    await db.update(syncState).set({
      status: 'completed', lastSyncAt: lastSync, currentShow: null,
      progress: done, failedShows: failures, updatedAt: new Date(),
    }).where(eq(syncState.userId, userId))

    console.log(`[sync] Full sync complete for user ${userId}`)
  } catch (e: any) {
    await db.update(syncState).set({
      status: 'error', error: e.message, updatedAt: new Date(),
    }).where(eq(syncState.userId, userId))
    throw e
  }
}

export async function triggerIncrementalSync(userId: number): Promise<void> {
  const db = getDb()
  const [state] = await db.select().from(syncState).where(eq(syncState.userId, userId))
  if (state?.status === 'running') return

  await db.update(syncState).set({ status: 'running', error: null, updatedAt: new Date() }).where(eq(syncState.userId, userId))

  try {
    const trakt = getTraktClient()
    const startAt = state?.lastSyncAt ? dayjs(state.lastSyncAt).toISOString() : undefined

    const history = await trakt.getHistory(userId, startAt)
    console.log(`[sync:incr] ${history.length} new entries since ${startAt || 'beginning'}`)

    // Group by show
    const showMap = new Map<number, typeof history>()
    for (const entry of history) {
      if (entry.type !== 'episode') continue
      const tmdbId = entry.show.ids.tmdb
      if (!tmdbId) continue
      if (!showMap.has(tmdbId)) showMap.set(tmdbId, [])
      showMap.get(tmdbId)!.push(entry)
    }

    for (const [tmdbId, entries] of showMap) {
      try {
        const showId = await upsertShowFromTmdb(tmdbId, entries[0].show)

        for (const entry of entries) {
          const ep = await findOrCreateEpisode(showId, tmdbId, entry.episode.season, entry.episode.number)
          if (!ep) continue

          await db.insert(watchHistory).values({
            userId,
            episodeId: ep.id,
            watchedAt: new Date(entry.watched_at),
            traktPlayId: String(entry.id),
          }).onConflictDoNothing()
        }

        await recalcShowProgress(userId, showId)
      } catch (e) {
        console.error(`[sync:incr] Error on tmdb ${tmdbId}:`, e)
      }
    }

    await db.update(syncState).set({
      status: 'completed', lastSyncAt: new Date(), currentShow: null, updatedAt: new Date(),
    }).where(eq(syncState.userId, userId))
  } catch (e: any) {
    await db.update(syncState).set({ status: 'error', error: e.message, updatedAt: new Date() }).where(eq(syncState.userId, userId))
  }
}

async function upsertShowFromTmdb(tmdbId: number, traktShow: any): Promise<number> {
  const db = getDb()
  const tmdb = await getTmdbShow(tmdbId)

  const [show] = await db.insert(shows).values({
    tmdbId,
    tvdbId: tmdb.external_ids?.tvdb_id || traktShow.ids?.tvdb || null,
    imdbId: tmdb.external_ids?.imdb_id || traktShow.ids?.imdb || null,
    traktId: traktShow.ids?.trakt || null,
    traktSlug: traktShow.ids?.slug || null,
    title: tmdb.name,
    overview: tmdb.overview || null,
    status: tmdb.status?.toLowerCase() || 'unknown',
    firstAired: tmdb.first_air_date || null,
    network: tmdb.networks?.[0]?.name || null,
    genres: tmdb.genres?.map((g: any) => g.name) || [],
    posterPath: tmdb.poster_path || null,
    backdropPath: tmdb.backdrop_path || null,
    totalEpisodes: tmdb.number_of_episodes || 0,
    totalSeasons: tmdb.number_of_seasons || 0,
    lastSyncedAt: new Date(),
  }).onConflictDoUpdate({
    target: [shows.tmdbId],
    set: {
      tvdbId: tmdb.external_ids?.tvdb_id || traktShow.ids?.tvdb || null,
      title: tmdb.name,
      overview: tmdb.overview || null,
      status: tmdb.status?.toLowerCase() || 'unknown',
      network: tmdb.networks?.[0]?.name || null,
      genres: tmdb.genres?.map((g: any) => g.name) || [],
      posterPath: tmdb.poster_path || null,
      backdropPath: tmdb.backdrop_path || null,
      totalEpisodes: tmdb.number_of_episodes || 0,
      totalSeasons: tmdb.number_of_seasons || 0,
      lastSyncedAt: new Date(),
    },
  }).returning({ id: shows.id })

  // Upsert seasons
  for (const s of tmdb.seasons || []) {
    if (s.season_number === 0) continue
    const [season] = await db.insert(seasons).values({
      showId: show.id,
      seasonNumber: s.season_number,
      episodeCount: s.episode_count,
      airDate: s.air_date || null,
      overview: s.overview || null,
      posterPath: s.poster_path || null,
    }).onConflictDoUpdate({
      target: [seasons.showId, seasons.seasonNumber],
      set: { episodeCount: s.episode_count, airDate: s.air_date || null },
    }).returning({ id: seasons.id })

    // Fetch and upsert episodes for each season
    try {
      const seasonData = await getTmdbSeason(tmdbId, s.season_number)
      for (const ep of seasonData.episodes || []) {
        await db.insert(episodes).values({
          showId: show.id,
          seasonId: season.id,
          seasonNumber: ep.season_number,
          episodeNumber: ep.episode_number,
          title: ep.name || null,
          overview: ep.overview || null,
          runtime: ep.runtime || null,
          airDate: ep.air_date || null,
          stillPath: ep.still_path || null,
          tmdbId: ep.id || null,
        }).onConflictDoUpdate({
          target: [episodes.showId, episodes.seasonNumber, episodes.episodeNumber],
          set: {
            title: ep.name || null,
            runtime: ep.runtime || null,
            airDate: ep.air_date || null,
            stillPath: ep.still_path || null,
          },
        })
      }
    } catch (e) {
      console.warn(`[sync] Failed to fetch season ${s.season_number} for tmdb ${tmdbId}`)
    }
  }

  return show.id
}

async function syncEpisodeProgress(userId: number, showId: number, tmdbId: number, progress: any): Promise<void> {
  const db = getDb()

  for (const season of progress.seasons || []) {
    for (const ep of season.episodes || []) {
      if (!ep.completed || !ep.last_watched_at) continue

      const episode = await findOrCreateEpisode(showId, tmdbId, season.number, ep.number)
      if (!episode) continue

      // Task 6.3: Use composite unique index (userId, episodeId, watchedAt) for dedup
      const watchedAt = new Date(ep.last_watched_at)
      await db.insert(watchHistory).values({
        userId,
        episodeId: episode.id,
        watchedAt,
        traktPlayId: null,
      }).onConflictDoNothing({ target: [watchHistory.userId, watchHistory.episodeId, watchHistory.watchedAt] })
    }
  }
}

async function findOrCreateEpisode(showId: number, tmdbId: number, seasonNum: number, episodeNum: number) {
  const db = getDb()
  const [ep] = await db.select().from(episodes)
    .where(and(
      eq(episodes.showId, showId),
      eq(episodes.seasonNumber, seasonNum),
      eq(episodes.episodeNumber, episodeNum),
    ))

  if (ep) return ep

  // Episode not in DB yet — try fetching from TMDB
  try {
    const seasonData = await getTmdbSeason(tmdbId, seasonNum)
    const tmdbEp = seasonData.episodes?.find(e => e.episode_number === episodeNum)
    if (!tmdbEp) return null

    const [season] = await db.select().from(seasons)
      .where(and(eq(seasons.showId, showId), eq(seasons.seasonNumber, seasonNum)))

    const [newEp] = await db.insert(episodes).values({
      showId,
      seasonId: season?.id || null,
      seasonNumber: seasonNum,
      episodeNumber: episodeNum,
      title: tmdbEp.name || null,
      overview: tmdbEp.overview || null,
      runtime: tmdbEp.runtime || null,
      airDate: tmdbEp.air_date || null,
      stillPath: tmdbEp.still_path || null,
      tmdbId: tmdbEp.id || null,
    }).onConflictDoNothing().returning()

    return newEp || null
  } catch {
    return null
  }
}

export async function recalcShowProgress(userId: number, showId: number): Promise<void> {
  const db = getDb()
  const now = new Date()

  // Count aired episodes (air_date <= today)
  const [airedResult] = await db.select({ count: sql<number>`count(*)` })
    .from(episodes)
    .where(and(
      eq(episodes.showId, showId),
      sql`air_date IS NOT NULL AND air_date <= ${now.toISOString().split('T')[0]}`,
    ))
  const airedEpisodes = Number(airedResult?.count || 0)

  // Count watched episodes (distinct episodes user has watched)
  const [watchedResult] = await db.select({ count: sql<number>`count(distinct episode_id)` })
    .from(watchHistory)
    .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
    .where(and(eq(watchHistory.userId, userId), eq(episodes.showId, showId)))
  const watchedEpisodes = Number(watchedResult?.count || 0)

  // Last watched
  const [lastWatched] = await db.select({ watchedAt: watchHistory.watchedAt })
    .from(watchHistory)
    .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
    .where(and(eq(watchHistory.userId, userId), eq(episodes.showId, showId)))
    .orderBy(sql`watched_at DESC`)
    .limit(1)

  // Find next episode (lowest season+episode not yet watched)
  const watchedEpisodeIds = await db.select({ id: watchHistory.episodeId })
    .from(watchHistory)
    .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
    .where(and(eq(watchHistory.userId, userId), eq(episodes.showId, showId)))

  const watchedIds = watchedEpisodeIds.map(r => r.id)

  let nextEpisodeId: number | null = null
  if (watchedIds.length > 0) {
    const [next] = await db.select({ id: episodes.id })
      .from(episodes)
      .where(and(
        eq(episodes.showId, showId),
        sql`id NOT IN (${sql.join(watchedIds.map(id => sql`${id}`), sql`, `)})`,
        sql`air_date IS NOT NULL AND air_date <= ${now.toISOString().split('T')[0]}`,
      ))
      .orderBy(episodes.seasonNumber, episodes.episodeNumber)
      .limit(1)
    nextEpisodeId = next?.id || null
  }

  const [show] = await db.select({ status: shows.status }).from(shows).where(eq(shows.id, showId))
  const completed = (show?.status === 'ended' || show?.status === 'canceled') && watchedEpisodes >= airedEpisodes && airedEpisodes > 0

  await db.insert(userShowProgress).values({
    userId,
    showId,
    airedEpisodes,
    watchedEpisodes,
    nextEpisodeId,
    lastWatchedAt: lastWatched?.watchedAt || null,
    completed,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [userShowProgress.userId, userShowProgress.showId],
    set: { airedEpisodes, watchedEpisodes, nextEpisodeId, lastWatchedAt: lastWatched?.watchedAt || null, completed, updatedAt: new Date() },
  })
}
