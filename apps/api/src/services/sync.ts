import { getDb, shows, seasons, episodes, watchHistory, userShowProgress, syncState, userSettings, watchResetCursors } from '@trakt-dashboard/db'
import { eq, and, sql, or, gt, isNull, desc } from 'drizzle-orm'
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
        const traktId = entries[0].show.ids.trakt
        if (!traktId) {
          console.warn(`[sync:incr] Missing Trakt id for tmdb ${tmdbId}, skipping`)
          return
        }
        const showId = await upsertShowFromTrakt(traktId, entries[0].show, userId)
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

  const showId = await upsertShowFromTrakt(input.traktId, input.traktShow, userId)
  await getDb().insert(userShowProgress).values({ userId, showId }).onConflictDoNothing()

  const progress = await trakt.getShowProgress(userId, input.traktId)
  await syncEpisodeProgress(userId, showId, input.tmdbId, progress)
  await recalcShowProgress(userId, showId)
}

// ─── Trakt-primary upsert ─────────────────────────────────────────────────────

async function upsertShowFromTrakt(traktId: number, traktShow: any, userId: number): Promise<number> {
  const db = getDb()
  const trakt = getTraktClient()

  // Read displayLanguage
  let displayLanguage: string | null = null
  try {
    const [settings] = await db.select({ displayLanguage: userSettings.displayLanguage })
      .from(userSettings).where(eq(userSettings.userId, userId))
    displayLanguage = settings?.displayLanguage ?? null
  } catch { /* ignore */ }

  // Fetch Trakt show detail
  const traktDetail = await trakt.getShowDetail(traktId, userId)

  if (!traktDetail.ids.tmdb) {
    throw new Error('Missing TMDB id (required for poster/image support)')
  }
  const tmdbId = traktDetail.ids.tmdb

  // Fetch TMDB data for images + translations (only if displayLanguage set)
  let posterPath: string | null = null
  let backdropPath: string | null = null
  let translatedName: string | null = null
  let translatedOverview: string | null = null

  if (displayLanguage) {
    try {
      const tmdbShow = await getTmdbShow(tmdbId, displayLanguage, userId)
      posterPath = tmdbShow.poster_path || null
      backdropPath = tmdbShow.backdrop_path || null
      if (tmdbShow.name && tmdbShow.name !== traktDetail.title) translatedName = tmdbShow.name
      if (tmdbShow.overview && tmdbShow.overview !== traktDetail.overview) translatedOverview = tmdbShow.overview
    } catch (e) {
      console.warn(`[sync] TMDB show fetch failed for tmdb ${tmdbId}: ${toErrorMessage(e)}`)
    }
  }

  // Fetch seasons from Trakt
  const traktSeasons = await trakt.getSeasons(traktId, userId)
  const totalSeasons = traktSeasons.length
  const totalEpisodes = traktSeasons.reduce((sum, s) => sum + (s.episode_count || 0), 0)

  // Upsert show
  const [show] = await db.insert(shows).values({
    tmdbId,
    traktId: traktDetail.ids.trakt,
    traktSlug: traktDetail.ids.slug,
    tvdbId: traktDetail.ids.tvdb,
    imdbId: traktDetail.ids.imdb,
    title: traktDetail.title,
    overview: traktDetail.overview,
    status: traktDetail.status?.toLowerCase() || 'unknown',
    firstAired: traktDetail.first_aired,
    network: traktDetail.network,
    genres: traktDetail.genres || [],
    posterPath,
    backdropPath,
    totalSeasons,
    totalEpisodes,
    originalName: traktDetail.title,
    translatedName,
    translatedOverview,
    displayLanguage,
    lastSyncedAt: new Date(),
  }).onConflictDoUpdate({
    target: [shows.tmdbId],
    set: {
      traktId: traktDetail.ids.trakt,
      traktSlug: traktDetail.ids.slug,
      tvdbId: traktDetail.ids.tvdb,
      title: traktDetail.title,
      overview: traktDetail.overview,
      status: traktDetail.status?.toLowerCase() || 'unknown',
      firstAired: traktDetail.first_aired,
      network: traktDetail.network,
      genres: traktDetail.genres || [],
      posterPath,
      backdropPath,
      totalSeasons,
      totalEpisodes,
      originalName: traktDetail.title,
      translatedName,
      translatedOverview,
      displayLanguage,
      lastSyncedAt: new Date(),
    },
  }).returning({ id: shows.id })

  // Upsert seasons + episodes concurrently
  const seasonLimit = pLimit(SEASON_CONCURRENCY)
  await Promise.all(traktSeasons.map(s => seasonLimit(async () => {
    const [season] = await db.insert(seasons).values({
      showId: show.id,
      seasonNumber: s.number,
      episodeCount: s.episode_count,
      airDate: s.first_aired || null,
      overview: s.overview || null,
      posterPath: null,
    }).onConflictDoUpdate({
      target: [seasons.showId, seasons.seasonNumber],
      set: { episodeCount: s.episode_count, airDate: s.first_aired || null, overview: s.overview || null },
    }).returning({ id: seasons.id })

    let traktEpisodes: import('./trakt.js').TraktEpisodeDetail[] = []
    try {
      traktEpisodes = await trakt.getEpisodes(traktId, s.number, userId)
    } catch (e) {
      console.warn(`[sync] Failed to fetch Trakt episodes for show ${traktId} season ${s.number}: ${toErrorMessage(e)}`)
      return
    }

    // Fetch TMDB episode translations if displayLanguage set
    let tmdbEpisodeMap = new Map<number, { translatedTitle: string | null; translatedOverview: string | null }>()
    if (displayLanguage) {
      try {
        const tmdbSeason = await getTmdbSeason(tmdbId, s.number, displayLanguage, userId)
        for (const ep of tmdbSeason.episodes || []) {
          tmdbEpisodeMap.set(ep.episode_number, {
            translatedTitle: ep.name?.trim() || null,
            translatedOverview: ep.overview?.trim() || null,
          })
        }
      } catch (e) {
        console.warn(`[sync] TMDB season fetch failed for tmdb ${tmdbId} s${s.number}: ${toErrorMessage(e)}`)
      }
    }

    for (const ep of traktEpisodes) {
      const tmdbEp = tmdbEpisodeMap.get(ep.number)
      const translatedEpTitle = (tmdbEp?.translatedTitle && tmdbEp.translatedTitle !== ep.title)
        ? tmdbEp.translatedTitle : null
      const translatedEpOverview = (tmdbEp?.translatedOverview && tmdbEp.translatedOverview !== ep.overview)
        ? tmdbEp.translatedOverview : null

      await db.insert(episodes).values({
        showId: show.id,
        seasonId: season.id,
        seasonNumber: ep.season,
        episodeNumber: ep.number,
        title: ep.title,
        overview: ep.overview,
        translatedTitle: translatedEpTitle,
        translatedOverview: translatedEpOverview,
        runtime: ep.runtime,
        airDate: ep.first_aired,
        stillPath: null,
        traktId: ep.ids.trakt,
        tmdbId: ep.ids.tmdb,
      }).onConflictDoUpdate({
        target: [episodes.showId, episodes.seasonNumber, episodes.episodeNumber],
        set: {
          title: ep.title,
          overview: ep.overview,
          translatedTitle: translatedEpTitle,
          translatedOverview: translatedEpOverview,
          runtime: ep.runtime,
          airDate: ep.first_aired,
          traktId: ep.ids.trakt,
          tmdbId: ep.ids.tmdb,
        },
      })
    }
  })))

  return show.id
}

// ─── TMDB upsert (kept for reference) ────────────────────────────────────────

async function upsertShowFromTmdb(tmdbId: number, traktShow: any, userId?: number): Promise<number> {
  const db = getDb()

  // Task 7.1: Read user's displayLanguage for translated title
  let displayLanguage: string | null = null
  if (userId) {
    try {
      const [settings] = await db.select({ displayLanguage: userSettings.displayLanguage })
        .from(userSettings).where(eq(userSettings.userId, userId))
      displayLanguage = settings?.displayLanguage ?? null
    } catch { /* ignore */ }
  }

  // Fetch base show data (no language = original)
  const tmdb = await getTmdbShow(tmdbId, undefined, userId)

  // Fetch translated title if language is set
  let translatedName: string | null = null
  let translatedOverview: string | null = null
  if (displayLanguage) {
    try {
      const translated = await getTmdbShow(tmdbId, displayLanguage, userId)
      // Store translated name if it differs from the original-language name
      if (translated.name && translated.name !== tmdb.original_name) {
        translatedName = translated.name
      }
      // Store translated overview if non-empty and different from original
      if (translated.overview && translated.overview !== tmdb.overview) {
        translatedOverview = translated.overview
      }
    } catch {
      // Translation fetch failed — skip, don't break sync
    }
  }

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
    originalName: tmdb.original_name || null,
    translatedName,
    translatedOverview,
    displayLanguage,
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
      originalName: tmdb.original_name || null,
      translatedName,
      translatedOverview,
      displayLanguage,
      lastSyncedAt: new Date(),
    },
  }).returning({ id: shows.id })

  // Fetch all seasons concurrently (include season 0 = Specials)
  const validSeasons = (tmdb.seasons || []).filter(s => s.season_number >= 0)
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
      // Fetch episode data in user's language (language-aware cache key prevents stale English cache)
      const seasonData = await getTmdbSeason(tmdbId, s.season_number, displayLanguage ?? undefined, userId)

      // If language is set and differs from default, also fetch original for fallback
      let fallbackSeason: typeof seasonData | null = null
      if (displayLanguage) {
        try {
          fallbackSeason = await getTmdbSeason(tmdbId, s.season_number, undefined, userId)
        } catch { /* ignore */ }
      }

      for (const ep of seasonData.episodes || []) {
        const fallbackEp = fallbackSeason?.episodes?.find(e => e.episode_number === ep.episode_number)

        // Determine translated vs original title/overview
        // fallbackEp = original language (English), ep = user's language
        const originalTitle = fallbackEp?.name?.trim() || ep.name?.trim() || null
        const translatedEpTitle = (displayLanguage && ep.name?.trim() && ep.name !== fallbackEp?.name)
          ? ep.name.trim() : null
        const originalOverview = fallbackEp?.overview?.trim() || ep.overview?.trim() || null
        const translatedEpOverview = (displayLanguage && ep.overview?.trim() && ep.overview !== fallbackEp?.overview)
          ? ep.overview.trim() : null

        await db.insert(episodes).values({
          showId: show.id,
          seasonId: season.id,
          seasonNumber: ep.season_number,
          episodeNumber: ep.episode_number,
          title: originalTitle,
          overview: originalOverview,
          translatedTitle: translatedEpTitle,
          translatedOverview: translatedEpOverview,
          runtime: ep.runtime || null,
          airDate: ep.air_date || null,
          stillPath: ep.still_path || null,
          tmdbId: ep.id || null,
        }).onConflictDoUpdate({
          target: [episodes.showId, episodes.seasonNumber, episodes.episodeNumber],
          set: {
            title: originalTitle,
            overview: originalOverview,
            translatedTitle: translatedEpTitle,
            translatedOverview: translatedEpOverview,
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

async function findOrCreateEpisode(showId: number, tmdbId: number, seasonNum: number, episodeNum: number, language?: string, userId?: number) {
  const db = getDb()
  const [ep] = await db.select().from(episodes).where(and(
    eq(episodes.showId, showId),
    eq(episodes.seasonNumber, seasonNum),
    eq(episodes.episodeNumber, episodeNum),
  ))
  if (ep) return ep

  // Get traktId for this show to fetch from Trakt
  try {
    const [showRow] = await db.select({ traktId: shows.traktId }).from(shows).where(eq(shows.id, showId))
    if (!showRow?.traktId) return null

    const trakt = getTraktClient()
    const traktEpisodes = await trakt.getEpisodes(showRow.traktId, seasonNum, userId ?? 0)
    const traktEp = traktEpisodes.find(e => e.number === episodeNum)
    if (!traktEp) return null

    const [season] = await db.select().from(seasons)
      .where(and(eq(seasons.showId, showId), eq(seasons.seasonNumber, seasonNum)))

    const [newEp] = await db.insert(episodes).values({
      showId, seasonId: season?.id || null,
      seasonNumber: seasonNum, episodeNumber: episodeNum,
      title: traktEp.title, overview: traktEp.overview,
      translatedTitle: null, translatedOverview: null,
      runtime: traktEp.runtime, airDate: traktEp.first_aired,
      stillPath: null, traktId: traktEp.ids.trakt, tmdbId: traktEp.ids.tmdb,
    }).onConflictDoNothing().returning()
    return newEp || null
  } catch {
    return null
  }
}

// ─── Watched Episodes Computation (Cursor-Aware) ─────────────────────────────

export async function computeWatchedEpisodes(userId: number, showId: number): Promise<number> {
  const db = getDb()
  
  // Get latest WatchResetCursor (max resetAt)
  const [cursor] = await db
    .select({ resetAt: watchResetCursors.resetAt })
    .from(watchResetCursors)
    .where(and(
      eq(watchResetCursors.userId, userId),
      eq(watchResetCursors.showId, showId)
    ))
    .orderBy(desc(watchResetCursors.resetAt))
    .limit(1)

  const resetAt = cursor?.resetAt ?? null

  // Build WHERE conditions
  const whereConditions = [
    eq(watchHistory.userId, userId),
    eq(episodes.showId, showId),
  ]
  
  // Cursor filter: watchedAt > resetAt OR watchedAt IS NULL
  if (resetAt) {
    whereConditions.push(
      or(
        gt(watchHistory.watchedAt, resetAt),
        isNull(watchHistory.watchedAt)
      )!
    )
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(distinct ${watchHistory.episodeId})` })
    .from(watchHistory)
    .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
    .where(and(...whereConditions))

  return Number(count)
}

// ─── Progress recalc ──────────────────────────────────────────────────────────

export async function recalcShowProgress(userId: number, showId: number): Promise<void> {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  const [airedResult] = await db.select({ count: sql<number>`count(*)` })
    .from(episodes)
    .where(and(eq(episodes.showId, showId), sql`air_date IS NOT NULL AND air_date <= ${today}`))
  const airedEpisodes = Number(airedResult?.count || 0)

  // Use computeWatchedEpisodes for cursor-aware calculation
  const watchedEpisodes = await computeWatchedEpisodes(userId, showId)

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
