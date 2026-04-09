import { getDb, shows, seasons, episodes, watchHistory, userShowProgress, syncState } from '@trakt-dashboard/db'
import { eq, and, sql } from 'drizzle-orm'
import { getTraktClient } from './trakt.js'
import { getTmdbShow, getTmdbSeason } from './tmdb.js'
import pLimit from 'p-limit'
import dayjs from 'dayjs'

// Concurrency: 5 shows in parallel, each show's seasons also fetched in parallel
const SHOW_CONCURRENCY = 5
const SEASON_CONCURRENCY = 4
const FAILED_RETRY_MAX = 2
// Per-show hard timeout (ms) — prevents one stuck show from blocking a slot forever
const SHOW_TIMEOUT_MS = 90_000

type FailedShow = {
  tmdbId: number
  title: string
  error: string
  retryCount?: number
}

function toErrorMessage(e: unknown): string {
  return String((e as { message?: string })?.message || e || 'Unknown error')
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ])
}

async function ensureSyncState(userId: number) {
  await getDb().insert(syncState).values({ userId }).onConflictDoNothing()
}

// ─── Full sync ────────────────────────────────────────────────────────────────

export async function triggerFullSync(userId: number): Promise<void> {
  const db = getDb()
  await ensureSyncState(userId)
  await db.update(syncState).set({
    status: 'running', progress: 0, total: 0,
    error: null, currentShow: 'Fetching watched shows from Trakt…',
    failedShows: [], updatedAt: new Date(),
  }).where(eq(syncState.userId, userId))

  try {
    const trakt = getTraktClient()
    const watchedShows = await trakt.getWatchedShows(userId)
    console.log(`[sync] Found ${watchedShows.length} watched shows`)

    await db.update(syncState).set({ total: watchedShows.length, updatedAt: new Date() })
      .where(eq(syncState.userId, userId))

    let processed = 0
    const failureMap = new Map<number, FailedShow>()
    const limit = pLimit(SHOW_CONCURRENCY)

    await Promise.all(watchedShows.map(ws => limit(async () => {
      const tmdbId = ws.show.ids.tmdb
      const title = ws.show.title

      if (!tmdbId) {
        failureMap.set(0, { tmdbId: 0, title, error: 'Missing TMDB id' })
        processed++
        return
      }

      try {
        await withTimeout(
          syncSingleShow(userId, {
            tmdbId,
            traktId: ws.show.ids.trakt || null,
            title,
            traktShow: ws.show,
          }),
          SHOW_TIMEOUT_MS,
          title
        )
      } catch (e) {
        console.error(`[sync] Error syncing "${title}":`, toErrorMessage(e))
        failureMap.set(tmdbId, { tmdbId, title, error: toErrorMessage(e) })
      } finally {
        processed++
        await db.update(syncState).set({
          progress: processed,
          currentShow: `${processed}/${watchedShows.length} · ${title}`,
          failedShows: Array.from(failureMap.values()),
          updatedAt: new Date(),
        }).where(eq(syncState.userId, userId))
        console.log(`[sync] ${processed}/${watchedShows.length} ${title}`)
      }
    })))

    // Retry failed shows once
    if (failureMap.size > 0) {
      console.log(`[sync] Retrying ${failureMap.size} failed shows…`)
      await db.update(syncState).set({
        currentShow: `Retrying ${failureMap.size} failed shows…`,
        updatedAt: new Date(),
      }).where(eq(syncState.userId, userId))

      const retryLimit = pLimit(2)
      await Promise.all(Array.from(failureMap.values()).map(f => retryLimit(async () => {
        try {
          await withTimeout(
            syncSingleShow(userId, {
              tmdbId: f.tmdbId,
              traktId: watchedShows.find(s => s.show.ids.tmdb === f.tmdbId)?.show.ids.trakt || null,
              title: f.title,
              traktShow: watchedShows.find(s => s.show.ids.tmdb === f.tmdbId)?.show || { ids: {} },
            }),
            SHOW_TIMEOUT_MS,
            f.title
          )
          failureMap.delete(f.tmdbId)
        } catch (e) {
          failureMap.set(f.tmdbId, { ...f, error: toErrorMessage(e), retryCount: (f.retryCount ?? 0) + 1 })
          console.error(`[sync] Retry failed for "${f.title}":`, toErrorMessage(e))
        }
      })))
    }

    await db.update(syncState).set({
      status: 'completed', lastSyncAt: new Date(), currentShow: null,
      progress: processed, failedShows: Array.from(failureMap.values()), updatedAt: new Date(),
    }).where(eq(syncState.userId, userId))

    console.log(`[sync] Full sync complete. ${failureMap.size} failures.`)
  } catch (e: any) {
    await db.update(syncState).set({ status: 'error', error: e.message, updatedAt: new Date() })
      .where(eq(syncState.userId, userId))
    throw e
  }
}

// ─── Incremental sync ─────────────────────────────────────────────────────────

export async function triggerIncrementalSync(userId: number): Promise<void> {
  const db = getDb()
  await ensureSyncState(userId)
  const [state] = await db.select().from(syncState).where(eq(syncState.userId, userId))
  if (state?.status === 'running') return

  await db.update(syncState).set({
    status: 'running', progress: 0, total: 0,
    currentShow: 'Fetching recent history…', error: null, updatedAt: new Date(),
  }).where(eq(syncState.userId, userId))

  try {
    const trakt = getTraktClient()
    const startAt = state?.lastSyncAt ? dayjs(state.lastSyncAt).toISOString() : undefined
    const history = await trakt.getHistory(userId, startAt)
    console.log(`[sync:incr] ${history.length} new entries since ${startAt || 'beginning'}`)

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
    await db.update(syncState).set({ total: totalShows, updatedAt: new Date() })
      .where(eq(syncState.userId, userId))

    const limit = pLimit(SHOW_CONCURRENCY)
    await Promise.all(Array.from(showMap.entries()).map(([tmdbId, entries]) => limit(async () => {
      try {
        const showId = await upsertShowFromTmdb(tmdbId, entries[0].show)
        for (const entry of entries) {
          const ep = await findOrCreateEpisode(showId, tmdbId, entry.episode.season, entry.episode.number)
          if (!ep) continue
          await db.insert(watchHistory).values({
            userId, episodeId: ep.id,
            watchedAt: new Date(entry.watched_at),
            traktPlayId: String(entry.id),
          }).onConflictDoNothing()
        }
        await recalcShowProgress(userId, showId)
      } catch (e) {
        console.error(`[sync:incr] Error on tmdb ${tmdbId}:`, toErrorMessage(e))
      } finally {
        processed++
        await db.update(syncState).set({
          progress: processed,
          currentShow: `${processed}/${totalShows} · ${entries[0]?.show?.title || `tmdb:${tmdbId}`}`,
          updatedAt: new Date(),
        }).where(eq(syncState.userId, userId))
      }
    })))

    await db.update(syncState).set({
      status: 'completed', lastSyncAt: new Date(), currentShow: null, updatedAt: new Date(),
    }).where(eq(syncState.userId, userId))
  } catch (e: any) {
    await db.update(syncState).set({ status: 'error', error: e.message, updatedAt: new Date() })
      .where(eq(syncState.userId, userId))
  }
}

// ─── Single show sync ─────────────────────────────────────────────────────────

async function syncSingleShow(
  userId: number,
  input: { tmdbId: number; traktId: number | null; title: string; traktShow: any },
) {
  if (!input.traktId) throw new Error('Missing Trakt id')
  const trakt = getTraktClient()

  const showId = await upsertShowFromTmdb(input.tmdbId, input.traktShow)
  await getDb().insert(userShowProgress).values({ userId, showId }).onConflictDoNothing()

  const progress = await trakt.getShowProgress(userId, input.traktId)
  await syncEpisodeProgress(userId, showId, input.tmdbId, progress)
  await recalcShowProgress(userId, showId)
}

// ─── TMDB upsert ──────────────────────────────────────────────────────────────

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

  // Fetch all seasons concurrently
  const validSeasons = (tmdb.seasons || []).filter(s => s.season_number > 0)
  const seasonLimit = pLimit(SEASON_CONCURRENCY)

  await Promise.all(validSeasons.map(s => seasonLimit(async () => {
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
      console.warn(`[sync] Failed to fetch season ${s.season_number} for tmdb ${tmdbId}: ${toErrorMessage(e)}`)
    }
  })))

  return show.id
}

// ─── Episode progress ─────────────────────────────────────────────────────────

async function syncEpisodeProgress(userId: number, showId: number, tmdbId: number, progress: any): Promise<void> {
  const db = getDb()
  for (const season of progress.seasons || []) {
    for (const ep of season.episodes || []) {
      if (!ep.completed || !ep.last_watched_at) continue
      const episode = await findOrCreateEpisode(showId, tmdbId, season.number, ep.number)
      if (!episode) continue
      await db.insert(watchHistory).values({
        userId, episodeId: episode.id,
        watchedAt: new Date(ep.last_watched_at),
        traktPlayId: null,
      }).onConflictDoNothing({ target: [watchHistory.userId, watchHistory.episodeId, watchHistory.watchedAt] })
    }
  }
}

async function findOrCreateEpisode(showId: number, tmdbId: number, seasonNum: number, episodeNum: number) {
  const db = getDb()
  const [ep] = await db.select().from(episodes).where(and(
    eq(episodes.showId, showId),
    eq(episodes.seasonNumber, seasonNum),
    eq(episodes.episodeNumber, episodeNum),
  ))
  if (ep) return ep

  try {
    const seasonData = await getTmdbSeason(tmdbId, seasonNum)
    const tmdbEp = seasonData.episodes?.find(e => e.episode_number === episodeNum)
    if (!tmdbEp) return null

    const [season] = await db.select().from(seasons)
      .where(and(eq(seasons.showId, showId), eq(seasons.seasonNumber, seasonNum)))

    const [newEp] = await db.insert(episodes).values({
      showId, seasonId: season?.id || null,
      seasonNumber: seasonNum, episodeNumber: episodeNum,
      title: tmdbEp.name || null, overview: tmdbEp.overview || null,
      runtime: tmdbEp.runtime || null, airDate: tmdbEp.air_date || null,
      stillPath: tmdbEp.still_path || null, tmdbId: tmdbEp.id || null,
    }).onConflictDoNothing().returning()
    return newEp || null
  } catch {
    return null
  }
}

// ─── Progress recalc ──────────────────────────────────────────────────────────

export async function recalcShowProgress(userId: number, showId: number): Promise<void> {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  const [airedResult] = await db.select({ count: sql<number>`count(*)` })
    .from(episodes)
    .where(and(eq(episodes.showId, showId), sql`air_date IS NOT NULL AND air_date <= ${today}`))
  const airedEpisodes = Number(airedResult?.count || 0)

  const [watchedResult] = await db.select({ count: sql<number>`count(distinct episode_id)` })
    .from(watchHistory)
    .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
    .where(and(eq(watchHistory.userId, userId), eq(episodes.showId, showId)))
  const watchedEpisodes = Number(watchedResult?.count || 0)

  const [lastWatched] = await db.select({ watchedAt: watchHistory.watchedAt })
    .from(watchHistory)
    .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
    .where(and(eq(watchHistory.userId, userId), eq(episodes.showId, showId)))
    .orderBy(sql`watched_at DESC`)
    .limit(1)

  const watchedIds = (await db.select({ id: watchHistory.episodeId })
    .from(watchHistory)
    .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
    .where(and(eq(watchHistory.userId, userId), eq(episodes.showId, showId))))
    .map(r => r.id)

  let nextEpisodeId: number | null = null
  if (watchedIds.length > 0) {
    const [next] = await db.select({ id: episodes.id })
      .from(episodes)
      .where(and(
        eq(episodes.showId, showId),
        sql`id NOT IN (${sql.join(watchedIds.map(id => sql`${id}`), sql`, `)})`,
        sql`air_date IS NOT NULL AND air_date <= ${today}`,
      ))
      .orderBy(episodes.seasonNumber, episodes.episodeNumber)
      .limit(1)
    nextEpisodeId = next?.id || null
  }

  const [show] = await db.select({ status: shows.status }).from(shows).where(eq(shows.id, showId))
  const completed = (show?.status === 'ended' || show?.status === 'canceled')
    && watchedEpisodes >= airedEpisodes && airedEpisodes > 0

  await db.insert(userShowProgress).values({
    userId, showId, airedEpisodes, watchedEpisodes,
    nextEpisodeId, lastWatchedAt: lastWatched?.watchedAt || null,
    completed, updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [userShowProgress.userId, userShowProgress.showId],
    set: { airedEpisodes, watchedEpisodes, nextEpisodeId, lastWatchedAt: lastWatched?.watchedAt || null, completed, updatedAt: new Date() },
  })
}
