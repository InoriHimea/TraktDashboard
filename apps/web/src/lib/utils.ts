import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Re-export from dedicated modules for backward compatibility
export { resolveTitle, fmtDateZh } from "./i18n";
export { tmdbImage } from "./image";

export function formatRuntime(minutes: number | null | undefined): string {
    if (!minutes || minutes <= 0) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

export function formatEpisode(s: number, e: number): string {
    return `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}`;
}

export function pluralize(n: number, word: string): string {
    return `${n} ${n === 1 ? word : word + "s"}`;
}

/**
 * @deprecated Use `fmtDateZh` from `lib/i18n` instead for Chinese UI.
 * This function returns English labels and is kept for backward compatibility.
 */
export function daysAgo(date: string | null): string {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor(
        (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff} days ago`;
    if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
    if (diff < 365) return `${Math.floor(diff / 30)} months ago`;
    return `${Math.floor(diff / 365)}y ago`;
}
