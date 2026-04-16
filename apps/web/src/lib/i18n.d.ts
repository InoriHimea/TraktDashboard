/**
 * i18n utilities — target language first, graceful fallback chain.
 *
 * Fallback order for content fields:
 *   1. translatedName / translatedOverview / translatedTitle (set during sync in user's language)
 *   2. title / overview / name (original, may be English)
 *   3. Hard-coded zh-CN UI strings (never fall back to English for UI chrome)
 */
import type { Show, EpisodeProgress } from "@trakt-dashboard/types";
export declare const STATUS_ZH: Record<string, string>;
export declare const STATUS_COLOR: Record<string, string>;
export declare function statusZh(status: string): string;
export declare function statusColor(status: string): string;
export declare function resolveTitle(show: Show): {
    primary: string;
    secondary: string | null;
};
export declare function resolveOverview(show: Show): string;
export declare function resolveEpisodeTitle(episode: EpisodeProgress): string;
export declare function resolveEpisodeOverview(episode: EpisodeProgress): string | null;
export declare function fmtDateZh(date: string | null): string;
export declare function fmtAirDate(date: string | null): string;
export declare function fmtRuntime(minutes: number | null): string;
//# sourceMappingURL=i18n.d.ts.map