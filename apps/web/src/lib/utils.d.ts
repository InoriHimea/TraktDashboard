import { type ClassValue } from "clsx";
export declare function cn(...inputs: ClassValue[]): string;
export { resolveTitle, fmtDateZh } from "./i18n";
export { tmdbImage } from "./image";
export declare function formatRuntime(minutes: number | null | undefined): string;
export declare function formatEpisode(s: number, e: number): string;
export declare function pluralize(n: number, word: string): string;
/**
 * @deprecated Use `fmtDateZh` from `lib/i18n` instead for Chinese UI.
 * This function returns English labels and is kept for backward compatibility.
 */
export declare function daysAgo(date: string | null): string;
//# sourceMappingURL=utils.d.ts.map