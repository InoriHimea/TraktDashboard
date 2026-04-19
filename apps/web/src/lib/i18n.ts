/**
 * i18n utilities — target language first, graceful fallback chain.
 *
 * Fallback order for content fields:
 *   1. translatedName / translatedOverview / translatedTitle (set during sync in user's language)
 *   2. title / overview / name (original, may be English)
 *   3. UI strings use translation files (zh-CN, en-US, etc.)
 */

import type { Show, EpisodeProgress } from "@trakt-dashboard/types";
import enUS from "../locales/en-US.json";
import zhCN from "../locales/zh-CN.json";

// ─── UI Translation System ────────────────────────────────────────────────────

type TranslationKey = string;
type Translations = typeof zhCN;

const translations: Record<string, Translations> = {
    "zh-CN": zhCN,
    "zh-TW": zhCN, // Fallback to zh-CN for Traditional Chinese
    "en-US": enUS,
    "en": enUS,
};

let currentLocale = "zh-CN";

export function setLocale(locale: string) {
    currentLocale = locale;
}

export function getLocale(): string {
    return currentLocale;
}

function getNestedValue(obj: any, path: string): string | undefined {
    return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const localeData = translations[currentLocale] || translations["zh-CN"];
    let text = getNestedValue(localeData, key) || key;

    // Replace {{param}} with actual values
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            text = text.replace(new RegExp(`{{${k}}}`, "g"), String(v));
        });
    }

    return text;
}

// ─── Show status ──────────────────────────────────────────────────────────────

export const STATUS_ZH: Record<string, string> = {
    "returning series": "连载中",
    ended: "已完结",
    canceled: "已取消",
    "in production": "制作中",
    planned: "计划中",
    pilot: "试播集",
    unknown: "未知",
};

export const STATUS_COLOR: Record<string, string> = {
    "returning series": "#22d3ee",
    ended: "#94a3b8",
    canceled: "#f87171",
    "in production": "#22d3ee",
    planned: "#a78bfa",
    pilot: "#fbbf24",
    unknown: "#6b7280",
};

export function statusZh(status: string): string {
    return STATUS_ZH[status] ?? status;
}

export function statusColor(status: string): string {
    return STATUS_COLOR[status] ?? "#6b7280";
}

// ─── Title resolution ─────────────────────────────────────────────────────────
// Uses translatedName when available (set during sync in user's displayLanguage).
// Does NOT hardcode 'zh-CN' — works for any language the user configured.

export function resolveTitle(show: Show): {
    primary: string;
    secondary: string | null;
} {
    // translatedName is populated during sync in the user's configured language
    if (show.translatedName) {
        // Show original as secondary if it differs
        const secondary =
            show.originalName && show.originalName !== show.translatedName
                ? show.originalName
                : show.title !== show.translatedName
                  ? show.title
                  : null;
        return { primary: show.translatedName, secondary };
    }
    // No translation available — use stored title, show original as secondary
    return {
        primary: show.title,
        secondary:
            show.originalName && show.originalName !== show.title
                ? show.originalName
                : null,
    };
}

// ─── Overview resolution ──────────────────────────────────────────────────────
// Prefers translatedOverview (set during sync), falls back to original overview.

export function resolveOverview(show: Show): string {
    const text = show.translatedOverview || show.overview;
    if (!text || text.trim() === "") return "暂无简介";
    return text;
}

// ─── Episode title resolution ─────────────────────────────────────────────────
// Prefers translatedTitle (set during sync), falls back to original title.

export function resolveEpisodeTitle(episode: EpisodeProgress): string {
    // 1. TMDB best translation (locale → zh-TW → ... → en-US, stored during sync)
    if (episode.translatedTitle?.trim()) return episode.translatedTitle.trim();
    // 2. Trakt original title
    if (episode.title?.trim()) return episode.title.trim();
    // 3. Numbered fallback
    if (episode.seasonNumber === 0) return `特别篇 ${episode.episodeNumber}`;
    return `第 ${episode.episodeNumber} 集`;
}

// ─── Episode overview resolution ─────────────────────────────────────────────

export function resolveEpisodeOverview(
    episode: EpisodeProgress,
): string | null {
    return episode.translatedOverview || episode.overview || null;
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function fmtDateZh(date: string | null): string {
    if (!date) return "从未";
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (diff < 0) return "即将播出";
    if (diff === 0) return "今天";
    if (diff === 1) return "昨天";
    if (diff < 7) return `${diff} 天前`;
    if (diff < 30) return `${Math.floor(diff / 7)} 周前`;
    if (diff < 365) return `${Math.floor(diff / 30)} 个月前`;
    return `${Math.floor(diff / 365)} 年前`;
}

export function fmtAirDate(date: string | null): string {
    if (!date) return "未知";
    try {
        return new Date(date).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    } catch {
        return date;
    }
}

export function fmtRuntime(minutes: number | null): string {
    if (minutes === null || minutes === undefined || minutes <= 0) return "";
    if (minutes < 60) return `${minutes} 分钟`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}
