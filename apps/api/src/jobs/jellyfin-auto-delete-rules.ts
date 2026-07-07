// Pure eligibility/exclusion rules for the Jellyfin auto-delete job (N6 batch 1).
// Extracted from jellyfin-auto-delete.ts so the rules can be unit-tested without
// dragging in DB/service dependencies. Keep this module side-effect free.

// User-confirmed retention rules (see project memory jellyfin-autodelete-rules):
// a season must have finished airing for 7 days; a movie's most recent watch must
// be 30 days old; a Phase 2 delete that 500s is deferred 7 days (jellyfin#16975).
export const SEASON_DELETE_BUFFER_DAYS = 7;
export const MOVIE_DELETE_BUFFER_DAYS = 30;
export const DEFER_AFTER_500_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SeasonStat {
    // TMDB's stated total for the season — NOT the locally-counted aired episodes.
    // Using aired-so-far as the denominator would mark a still-airing season complete
    // the moment the user catches up.
    seasonTotal: number;
    airedCount: number;
    watched: number;
    lastAirDate: string | null;
}

export function isSeasonEligible(stat: SeasonStat, nowMs: number): boolean {
    if (stat.seasonTotal <= 0) return false;
    if (stat.airedCount < stat.seasonTotal) return false;
    if (stat.watched < stat.seasonTotal) return false;
    if (stat.lastAirDate === null) return false;
    const lastAirMs = new Date(stat.lastAirDate).getTime();
    return lastAirMs < nowMs - SEASON_DELETE_BUFFER_DAYS * DAY_MS;
}

// A rewatch pushes the buffer out again — callers pass MAX(watched_at), not the first watch.
export function isMovieEligible(lastWatchedAt: string | null, nowMs: number): boolean {
    if (lastWatchedAt === null) return false;
    return new Date(lastWatchedAt).getTime() < nowMs - MOVIE_DELETE_BUFFER_DAYS * DAY_MS;
}

export interface ExclusionRow {
    showId: number | null;
    movieId: number | null;
    seasonNumber: number | null;
}

export interface ExclusionIndex {
    excludedShowIds: Set<number>;
    excludedMovieIds: Set<number>;
    isSeasonExcluded(showId: number, season: number): boolean;
    // Lets Phase 2 register a just-written defer so the same run's Phase 1
    // doesn't immediately re-queue the entry it deferred.
    add(row: ExclusionRow): void;
}

// Whole-show exclusion (seasonNumber null) blocks both whole-show and season queueing.
// A season exclusion also blocks whole-show queueing for that show — deleting the whole
// series would delete the protected season's files, violating the protection semantics.
export function buildExclusionIndex(rows: ExclusionRow[]): ExclusionIndex {
    const excludedShowIds = new Set<number>();
    const excludedWholeShowIds = new Set<number>();
    const excludedSeasonKeys = new Set<string>();
    const excludedMovieIds = new Set<number>();

    const add = (row: ExclusionRow) => {
        if (row.showId !== null) {
            excludedShowIds.add(row.showId);
            if (row.seasonNumber === null) excludedWholeShowIds.add(row.showId);
            else excludedSeasonKeys.add(`${row.showId}:${row.seasonNumber}`);
        }
        if (row.movieId !== null) excludedMovieIds.add(row.movieId);
    };
    rows.forEach(add);

    return {
        excludedShowIds,
        excludedMovieIds,
        add,
        isSeasonExcluded: (showId, season) =>
            excludedWholeShowIds.has(showId) || excludedSeasonKeys.has(`${showId}:${season}`),
    };
}

// deleteJellyfinItem throws `Error("Jellyfin delete failed: <status>")` on non-OK.
export function parseJellyfinDeleteStatus(message: string): number | null {
    const m = /Jellyfin delete failed: (\d+)$/.exec(message);
    return m ? Number(m[1]) : null;
}

// N5-T10: Jellyfin 10.11's DELETE /Items can 500 AFTER the files were removed from disk
// (UserData tombstone constraint, upstream jellyfin#16975 — fixed only in 12.0). The 500
// therefore doesn't mean "not deleted"; retrying daily would loop forever against the
// ghost DB entry. Stored in history.errorMessage.
export function annotate500Error(status: number): string {
    return `HTTP ${status} — files were likely already deleted on disk (Jellyfin 10.11 bug jellyfin#16975); entry auto-deferred ${DEFER_AFTER_500_DAYS} days`;
}
