import type { NowPlayingEpisode } from "@trakt-dashboard/types";
interface NowPlayingPopupProps {
    data: NowPlayingEpisode | null;
    isLoading: boolean;
    isOpen: boolean;
    onClose: () => void;
}
export declare function computeRemainingMinutes(expiresAt: string, now?: number): number;
export declare function computeProgressPct(runtime: number | null, remainingMinutes: number): number;
export declare function formatSeasonEpisode(seasonNumber: number, episodeNumber: number): string;
export declare function NowPlayingPopup({ data, isLoading, isOpen, onClose, }: NowPlayingPopupProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=NowPlayingPopup.d.ts.map