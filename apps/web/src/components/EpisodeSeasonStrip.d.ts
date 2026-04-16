import type { EpisodeProgress } from "@trakt-dashboard/types";
interface EpisodeSeasonStripProps {
    episodes: EpisodeProgress[];
    seasonNumber: number;
    currentEpisodeNumber: number;
    showId: number;
}
export declare function EpisodeSeasonStrip({ episodes, seasonNumber, currentEpisodeNumber, showId, }: EpisodeSeasonStripProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=EpisodeSeasonStrip.d.ts.map