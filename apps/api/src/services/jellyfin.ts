import type {
    JellyfinLibrary,
    JellyfinEpisode,
    JellyfinMovie,
    JellyfinLibrarySummary,
    JellyfinActivityEntry,
    JellyfinTopItem,
    JellyfinStatsTopContent,
    JellyfinHeatmapCell,
} from "@trakt-dashboard/types";

export interface JellyfinConfig {
    url: string;
    apiKey: string;
}

function jellyfinFetch(cfg: JellyfinConfig, path: string, init?: RequestInit) {
    const base = cfg.url.replace(/\/$/, "");
    return fetch(`${base}${path}`, {
        ...init,
        headers: {
            "X-Emby-Token": cfg.apiKey,
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
}

export async function fetchJellyfinLibraries(cfg: JellyfinConfig): Promise<JellyfinLibrary[]> {
    // /Library/VirtualFolders can return empty for non-admin keys or certain Jellyfin builds.
    // Use /Users/{id}/Views instead — it returns the libraries visible to that user.
    const usersRes = await jellyfinFetch(cfg, "/Users");
    if (!usersRes.ok) throw new Error(`Jellyfin users fetch failed: ${usersRes.status}`);
    const users = (await usersRes.json()) as Array<{ Id: string; Name: string }>;
    if (!users.length) return [];

    const jellyfinUser = process.env.JELLYFIN_USER;
    const user = jellyfinUser ? (users.find((u) => u.Name === jellyfinUser) ?? users[0]) : users[0];

    const viewsRes = await jellyfinFetch(cfg, `/Users/${user.Id}/Views`);
    if (!viewsRes.ok) throw new Error(`Jellyfin views fetch failed: ${viewsRes.status}`);
    const data = (await viewsRes.json()) as {
        Items: Array<{ Id: string; Name: string; CollectionType: string }>;
    };
    return (data.Items ?? []).map((lib) => ({
        id: lib.Id,
        name: lib.Name,
        collectionType: lib.CollectionType ?? "",
    }));
}

async function findJellyfinSeriesId(
    cfg: JellyfinConfig,
    showTmdbId: number,
): Promise<string | null> {
    // AnyProviderIdEquals is broken in some Jellyfin builds (returns unfiltered results).
    // Fetch all Series with their ProviderIds and filter client-side instead.
    const params = new URLSearchParams({
        IncludeItemTypes: "Series",
        Recursive: "true",
        Fields: "ProviderIds",
        Limit: "2000",
    });
    const res = await jellyfinFetch(cfg, `/Items?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
        Items: Array<{ Id: string; ProviderIds?: Record<string, string> }>;
    };
    const target = String(showTmdbId);
    const match = (data.Items ?? []).find((item) => item.ProviderIds?.["Tmdb"] === target);
    return match?.Id ?? null;
}

export async function findJellyfinSeasonEpisodes(
    cfg: JellyfinConfig,
    showTmdbId: number,
    seasonNumber: number,
): Promise<JellyfinEpisode[]> {
    const seriesId = await findJellyfinSeriesId(cfg, showTmdbId);
    if (!seriesId) return [];

    // /Items with AncestorIds/AnyProviderIdEquals are broken in some Jellyfin builds.
    // Use the dedicated /Shows/{id}/Episodes endpoint which filters correctly.
    const params = new URLSearchParams({
        Season: String(seasonNumber),
        Fields: "Path",
    });
    const res = await jellyfinFetch(cfg, `/Shows/${seriesId}/Episodes?${params}`);
    if (!res.ok) throw new Error(`Jellyfin season episodes fetch failed: ${res.status}`);
    const data = (await res.json()) as {
        Items: Array<{ Id: string; Name: string; SeriesName?: string; Path?: string }>;
    };
    return (data.Items ?? []).map((item) => ({
        id: item.Id,
        name: item.Name ?? "",
        seriesName: item.SeriesName ?? "",
        path: item.Path ?? null,
    }));
}

export async function findJellyfinEpisode(
    cfg: JellyfinConfig,
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    ancestorIds?: string[],
): Promise<JellyfinEpisode | null> {
    const params = new URLSearchParams({
        IncludeItemTypes: "Episode",
        Recursive: "true",
        Fields: "Path,ProviderIds",
        AnyProviderIdEquals: `Tmdb.${showTmdbId}`,
        ParentIndexNumber: String(seasonNumber),
        IndexNumber: String(episodeNumber),
    });
    if (ancestorIds && ancestorIds.length > 0) {
        params.set("AncestorIds", ancestorIds.join(","));
    }
    const res = await jellyfinFetch(cfg, `/Items?${params}`);
    if (!res.ok) throw new Error(`Jellyfin episode lookup failed: ${res.status}`);
    const data = (await res.json()) as {
        Items: Array<{
            Id: string;
            Name: string;
            SeriesName: string;
            Path?: string;
            ParentIndexNumber?: number;
            IndexNumber?: number;
        }>;
    };
    const item = data.Items?.[0] ?? null;
    if (!item) return null;
    return {
        id: item.Id,
        name: item.Name ?? "",
        seriesName: item.SeriesName ?? "",
        path: item.Path ?? null,
    };
}

export async function findJellyfinMovie(
    cfg: JellyfinConfig,
    movieTmdbId: number,
): Promise<JellyfinMovie | null> {
    const params = new URLSearchParams({
        IncludeItemTypes: "Movie",
        Recursive: "true",
        Fields: "Path,ProviderIds",
        AnyProviderIdEquals: `Tmdb.${movieTmdbId}`,
    });
    const res = await jellyfinFetch(cfg, `/Items?${params}`);
    if (!res.ok) throw new Error(`Jellyfin movie lookup failed: ${res.status}`);
    const data = (await res.json()) as {
        Items: Array<{ Id: string; Name: string; Path?: string }>;
    };
    const item = data.Items?.[0] ?? null;
    if (!item) return null;
    return { id: item.Id, name: item.Name ?? "", path: item.Path ?? null };
}

export async function deleteJellyfinItem(cfg: JellyfinConfig, itemId: string): Promise<void> {
    const res = await jellyfinFetch(cfg, `/Items/${itemId}?deleteFiles=true`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error(`Jellyfin delete failed: ${res.status}`);
}

// ─── Active Sessions (now-playing) ───────────────────────────────────────────

interface RawNowPlayingItem {
    Id: string;
    Name: string;
    Type: "Episode" | "Movie" | string;
    SeriesName?: string;
    SeriesId?: string;
    ParentIndexNumber?: number; // season
    IndexNumber?: number; // episode
    RunTimeTicks?: number;
    ProviderIds?: { Tmdb?: string; Imdb?: string };
    ImageTags?: { Primary?: string };
    SeriesPrimaryImageTag?: string;
}

interface RawSession {
    NowPlayingItem?: RawNowPlayingItem;
    PlayState?: { PositionTicks?: number; IsPaused?: boolean };
    UserId?: string;
    UserName?: string;
}

export interface JellyfinActiveSession {
    jellyfinItemId: string;
    mediaType: "episode" | "movie";
    title: string;
    seriesTitle: string | null;
    seriesJellyfinId: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    runtimeMinutes: number | null;
    progressPct: number; // 0-100
    isPaused: boolean;
    tmdbShowId: number | null; // series TMDB ID (for episodes)
    tmdbMovieId: number | null; // movie TMDB ID
}

export async function getActiveSessions(
    cfg: JellyfinConfig,
    username?: string,
): Promise<JellyfinActiveSession | null> {
    const res = await jellyfinFetch(cfg, "/Sessions?ActiveWithinSeconds=60");
    if (!res.ok) throw new Error(`Jellyfin sessions failed: ${res.status}`);
    const sessions = (await res.json()) as RawSession[];

    // On a shared Jellyfin server /Sessions returns every account's playback. When a
    // username is configured, only consider that user's sessions so we never report
    // (or "catch up" Trakt against) someone else's now-playing.
    const wanted = username?.trim().toLowerCase();

    for (const session of sessions) {
        const item = session.NowPlayingItem;
        if (!item) continue;
        if (wanted && (session.UserName ?? "").toLowerCase() !== wanted) continue;

        const mediaType =
            item.Type === "Movie" ? "movie" : item.Type === "Episode" ? "episode" : null;
        if (!mediaType) continue;

        const runtimeTicks = item.RunTimeTicks ?? null;
        const positionTicks = session.PlayState?.PositionTicks ?? 0;
        const runtimeMinutes = runtimeTicks ? Math.round(runtimeTicks / 600_000_000) : null;
        const progressPct =
            runtimeTicks && runtimeTicks > 0
                ? Math.min(100, Math.max(0, (positionTicks / runtimeTicks) * 100))
                : 0;

        const tmdbStr = item.ProviderIds?.Tmdb;
        const tmdbId = tmdbStr ? parseInt(tmdbStr, 10) : null;

        return {
            jellyfinItemId: item.Id,
            mediaType,
            title: item.Name,
            seriesTitle: item.SeriesName ?? null,
            seriesJellyfinId: item.SeriesId ?? null,
            seasonNumber: item.ParentIndexNumber ?? null,
            episodeNumber: item.IndexNumber ?? null,
            runtimeMinutes,
            progressPct,
            isPaused: session.PlayState?.IsPaused ?? false,
            tmdbShowId: mediaType === "episode" ? tmdbId : null,
            tmdbMovieId: mediaType === "movie" ? tmdbId : null,
        };
    }
    return null;
}

export async function autoDeleteJellyfinEpisode(
    cfg: JellyfinConfig,
    autoDeleteLibraryIds: string[],
    showTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
): Promise<void> {
    if (autoDeleteLibraryIds.length === 0) return;

    // Restrict search to the configured auto-delete libraries via AncestorIds so we
    // never touch media in libraries the user didn't opt into.
    const episode = await findJellyfinEpisode(
        cfg,
        showTmdbId,
        seasonNumber,
        episodeNumber,
        autoDeleteLibraryIds,
    );
    if (!episode) return;

    await deleteJellyfinItem(cfg, episode.id);
}

// ─── Jellyfin Statistics ──────────────────────────────────────────────────────

async function getJellyfinFirstUserId(cfg: JellyfinConfig): Promise<string | null> {
    const res = await jellyfinFetch(cfg, "/Users");
    if (!res.ok) return null;
    const users = (await res.json()) as Array<{ Id: string; Name: string }>;
    if (!users.length) return null;
    const wanted = process.env.JELLYFIN_USER?.trim().toLowerCase();
    const user = wanted
        ? (users.find((u) => u.Name.toLowerCase() === wanted) ?? users[0])
        : users[0];
    return user.Id;
}

export async function getJellyfinLibrarySummary(
    cfg: JellyfinConfig,
): Promise<JellyfinLibrarySummary> {
    const makeUrl = (type: string) => `/Items?IncludeItemTypes=${type}&Recursive=true&Limit=0`;
    const [moviesRes, seriesRes, episodesRes] = await Promise.all([
        jellyfinFetch(cfg, makeUrl("Movie")),
        jellyfinFetch(cfg, makeUrl("Series")),
        jellyfinFetch(cfg, makeUrl("Episode")),
    ]);
    const getCount = async (res: Response) => {
        if (!res.ok) return 0;
        const d = (await res.json()) as { TotalRecordCount?: number };
        return d.TotalRecordCount ?? 0;
    };
    const [movieCount, seriesCount, episodeCount] = await Promise.all([
        getCount(moviesRes),
        getCount(seriesRes),
        getCount(episodesRes),
    ]);
    return { movieCount, seriesCount, episodeCount };
}

export async function getJellyfinActivityLog(
    cfg: JellyfinConfig,
    limit = 50,
): Promise<JellyfinActivityEntry[]> {
    const params = new URLSearchParams({ limit: String(limit), hasUserId: "true" });
    const res = await jellyfinFetch(cfg, `/System/ActivityLog/Entries?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
        Items: Array<{
            Date: string;
            Name: string;
            Type: string;
            UserName?: string;
            ItemId?: string;
        }>;
    };
    return (data.Items ?? [])
        .filter((e) => e.Type === "VideoPlaybackStopped" || e.Type === "VideoPlayback")
        .map((e) => ({
            date: e.Date,
            name: e.Name,
            type: e.Type,
            userName: e.UserName ?? null,
            itemId: e.ItemId ?? null,
        }));
}

export async function getJellyfinTopItems(cfg: JellyfinConfig): Promise<JellyfinStatsTopContent> {
    const userId = await getJellyfinFirstUserId(cfg);
    if (!userId) return { movies: [], series: [] };

    const makeParams = (type: string) =>
        new URLSearchParams({
            SortBy: "PlayCount",
            SortOrder: "Descending",
            IncludeItemTypes: type,
            Recursive: "true",
            Fields: "UserData",
            Filters: "IsPlayed",
            Limit: "10",
        });

    const [moviesRes, seriesRes] = await Promise.all([
        jellyfinFetch(cfg, `/Users/${userId}/Items?${makeParams("Movie")}`),
        jellyfinFetch(cfg, `/Users/${userId}/Items?${makeParams("Series")}`),
    ]);

    const parseItems = async (
        res: Response,
        type: JellyfinTopItem["type"],
    ): Promise<JellyfinTopItem[]> => {
        if (!res.ok) return [];
        const d = (await res.json()) as {
            Items: Array<{ Id: string; Name: string; UserData?: { PlayCount?: number } }>;
        };
        return (d.Items ?? [])
            .filter((item) => (item.UserData?.PlayCount ?? 0) > 0)
            .map((item) => ({
                id: item.Id,
                name: item.Name,
                playCount: item.UserData?.PlayCount ?? 0,
                type,
            }));
    };

    const [movies, series] = await Promise.all([
        parseItems(moviesRes, "Movie"),
        parseItems(seriesRes, "Series"),
    ]);
    return { movies, series };
}

export async function getJellyfinPlayHeatmap(cfg: JellyfinConfig): Promise<JellyfinHeatmapCell[]> {
    const params = new URLSearchParams({ limit: "1000", hasUserId: "true" });
    const res = await jellyfinFetch(cfg, `/System/ActivityLog/Entries?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
        Items: Array<{ Date: string; Type: string }>;
    };

    const counts = new Map<string, number>();
    for (const item of data.Items ?? []) {
        if (item.Type !== "VideoPlaybackStopped" && item.Type !== "VideoPlayback") continue;
        const d = new Date(item.Date);
        const key = `${d.getUTCDay()}_${d.getUTCHours()}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([key, count]) => {
        const [day, hour] = key.split("_").map(Number);
        return { dayOfWeek: day, hour, count };
    });
}
