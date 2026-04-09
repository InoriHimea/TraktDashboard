import { getDb, shows, seasons, episodes, watchHistory, userShowProgress, syncState } from '@trakt-dashboard/db'
import { eq, and, sql } from 'drizzle-orm'
import { getTraktClient } from './trakt.js'
import { getTmdbShow, getTmdbSeason } from './tmdb.js'
import dayjs from 'dayjs'

const FAILED_RETRY_MAX = 3

type FailedShow = {
  tmdbId: number
  title: string
  error: string
  retryCount?: number
  alert?: boolean
  lastTriedAt?: string
}

function failureKey(tmdbId: number, title: string): string {
  return `${tmdbId}:${title}`
}

function toErrorMessage(e: unknown): string {
  return String((e as { message?: string })?.message || e || 'Unknown error')
}

function upsertFailure(map: Map<string, FailedShow>, failure: FailedShow) {
  const key = failureKey(failure.tmdbId, failure.title)
  map.set(key, {
    ...failure,
    retryCount: failure.retryCount ?? 0,
    alert: failure.alert ?? false,
    lastTriedAt: new Date().toISOString(),
  })
}

async function syncSingleShow(
  userId: number,
  input: { tmdbId: number; traktId: number | null; title: string; traktShow: any },
  onStage?: (stage: string) => Promise<void>,
) {
  const trakt = getTraktClient()
  if (!input.tmdbId) throw new Error('Missing TMDB id')
  if (!input.traktId) throw new Error('Missing Trakt id')

  await onStage?.('写入基础剧集信息')
  const showId = await upsertShowFromTmdb(input.tmdbId, input.traktShow)
  await getDb().insert(userShowProgress).values({
    userId,
    showId,
  }).onConflictDoNothing()

  await onStage?.('同步 Trakt 观看进度')
  const progress = await trakt.getShowProgress(userId, input.traktId)

  await onStage?.('写入观看记录')
  await syncEpisodeProgress(userId, showId, input.tmdbId, progress)

  await onStage?.('计算汇总进度')
  await recalcShowProgress(userId, showId)
}

async function ensureSyncState(userId: number) {
  const db = getDb()
  await db.insert(syncState).values({ userId }).onConflictDoNothing()
}

export async function triggerFullSync(userId: number): Promise<void> {
  const db = getDb()
  await ensureSyncState(userId)
  await db.update(syncState).set({
    status: 'running',
    progress: 0,
    total: 0,
    error: null,
    currentShow: 'Preparing sync...',
    failedShows: [],
    updatedAt: new Date(),
  }).where(eq(syncState.userId, userId))

  try {
    console.log(`[sync] Starting full sync for user ${userId}`)

    const trakt = getTraktClient()
    const watchedShows = await trakt.getWatchedShows(userId)
    console.log(`[sync] Found ${watchedShows.length} watched shows`)

    await db.update(syncState).set({ total: watchedShows.length, updatedAt: new Date() }).where(eq(syncState.userId, userId))

    let processed = 0
    const failureMap = new Map<string, FailedShow>()

    for (const [idx, ws] of watchedShows.entries()) {
      const progressLabel = `[${idx + 1}/${watchedShows.length}] ${ws.show.title}`
      try {
        const tmdbId = ws.show.ids.tmdb
        if (!tmdbId) {
          upsertFailure(failureMap, { tmdbId: 0, title: ws.show.title, error: 'Missing TMDB id' })
          continue
        }

        await syncSingleShow(userId, {
          tmdbId,
          traktId: ws.show.ids.trakt || null,
          title: ws.show.title,
          traktShow: ws.show,
        }, async (stage) => {
          await db.update(syncState).set({
            currentShow: `${progressLabel} · ${stage}`,
            updatedAt: new Date(),
          }).where(eq(syncState.userId, userId))
        })
      } catch (e: any) {
        console.error(`[sync] Error syncing ${ws.show.title}:`, e)
        upsertFailure(failureMap, {
          tmdbId: ws.show.ids.tmdb || 0,
          title: ws.show.title,
          error: toErrorMessage(e),
        })
      } finally {
        processed++
        await db.update(syncState).set({
          progress: processed,
          failedShows: Array.from(failureMap.values()),
          updatedAt: new Date(),
        }).where(eq(syncState.userId, userId))
        console.log(`[sync] ${processed}/${watchedShows.length} ${ws.show.title}`)
      }
    }

    if (failureMap.size > 0) {
      for (let round = 1; round <= FAILED_RETRY_MAX && failureMap.size > 0; round++) {
        await db.update(syncState).set({
          currentShow: `Retrying failed shows (${round}/${FAILED_RETRY_MAX})`,
          failedShows: Array.from(failureMap.values()),
          updatedAt: new Date(),
        }).where(eq(syncState.userId, userId))

        for (const failure of Array.from(failureMap.values())) {
          if ((failure.retryCount || 0) >= FAILED_RETRY_MAX) continue

          try {
            await db.update(syncState).set({
              currentShow: `Retry ${round}/${FAILED_RETRY_MAX}: ${failure.title}`,
              updatedAt: new Date(),
            }).where(eq(syncState.userId, userId))

            await syncSingleShow(userId, {
              tmdbId: failure.tmdbId,
              traktId: watchedShows.find((s) => s.show.ids.tmdb === failure.tmdbId)?.show.ids.trakt || null,
              title: failure.title,
              traktShow: watchedShows.find((s) => s.show.ids.tmdb === failure.tmdbId)?.show || { ids: {} },
            }, async (stage) => {
              await db.update(syncState).set({
                currentShow: `Retry ${round}/${FAILED_RETRY_MAX}: ${failure.title} · ${stage}`,
                updatedAt: new Date(),
              }).where(eq(syncState.userId, userId))
            })
            failureMap.delete(failureKey(failure.tmdbId, failure.title))
          } catch (e) {
            const retryCount = (failure.retryCount || 0) + 1
            const stillFailed: FailedShow = {
              ...failure,
              error: toErrorMessage(e),
              retryCount,
              alert: retryCount >= FAILED_RETRY_MAX,
              lastTriedAt: new Date().toISOString(),
            }
            upsertFailure(failureMap, stillFailed)
            if (stillFailed.alert) {
              console.error(`[sync][ALERT] ${failure.title} failed after ${FAILED_RETRY_MAX} retries`)
            }
          } finally {
            await db.update(syncState).set({
              failedShows: Array.from(failureMap.values()),
              updatedAt: new Date(),
            }).where(eq(syncState.userId, userId))
          }
        }
      }
    }

    const lastSync = new Date()
    const remainingFailures = Array.from(failureMap.values())
    await db.update(syncState).set({
      status: 'completed', lastSyncAt: lastSync, currentShow: null,
      progress: processed, failedShows: remainingFailures, updatedAt: new Date(),
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
  await ensureSyncState(userId)
  const [state] = await db.select().from(syncState).where(eq(syncState.userId, userId))
  if (state?.status === 'running') return

  await db.update(syncState).set({
    status: 'running',
    progress: 0,
    total: 0,
    currentShow: 'Preparing incremental sync...',
    error: null,
    updatedAt: new Date(),
  }).where(eq(syncState.userId, userId))

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

    const totalShows = showMap.size
    let processed = 0
    await db.update(syncState).set({ total: totalShows, updatedAt: new Date() }).where(eq(syncState.userId, userId))

    for (const [tmdbId, entries] of showMap) {
      try {
        await db.update(syncState).set({
          currentShow: `[${processed + 1}/${totalShows}] ${entries[0]?.show?.title || `tmdb:${tmdbId}`}`,
          updatedAt: new Date(),
        }).where(eq(syncState.userId, userId))

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
      } finally {
        processed++
        await db.update(syncState).set({ progress: processed, updatedAt: new Date() }).where(eq(syncState.userId, userId))
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
