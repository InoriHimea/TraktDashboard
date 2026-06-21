import type { JellyfinLibrary, JellyfinEpisode, JellyfinMovie } from "@trakt-dashboard/types";

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
    const res = await jellyfinFetch(cfg, "/Library/VirtualFolders");
    if (!res.ok) throw new Error(`Jellyfin libraries fetch failed: ${res.status}`);
    const data = (await res.json()) as Array<{
        ItemId: string;
        Name: string;
        CollectionType: string;
    }>;
    return data.map((lib) => ({
        id: lib.ItemId,
        name: lib.Name,
        collectionType: lib.CollectionType ?? "",
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
