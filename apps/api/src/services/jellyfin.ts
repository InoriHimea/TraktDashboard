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
