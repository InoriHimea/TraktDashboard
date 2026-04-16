/**
 * i18n utilities — target language first, graceful fallback chain.
 *
 * Fallback order for content fields:
 *   1. translatedName / translatedOverview / translatedTitle (set during sync in user's language)
 *   2. title / overview / name (original, may be English)
 *   3. Hard-coded zh-CN UI strings (never fall back to English for UI chrome)
 */
// ─── Show status ──────────────────────────────────────────────────────────────
export const STATUS_ZH = {
    "returning series": "连载中",
    ended: "已完结",
    canceled: "已取消",
    "in production": "制作中",
    planned: "计划中",
    pilot: "试播集",
    unknown: "未知",
};
export const STATUS_COLOR = {
    "returning series": "#22d3ee",
    ended: "#94a3b8",
    canceled: "#f87171",
    "in production": "#22d3ee",
    planned: "#a78bfa",
    pilot: "#fbbf24",
    unknown: "#6b7280",
};
export function statusZh(status) {
    return STATUS_ZH[status] ?? status;
}
export function statusColor(status) {
    return STATUS_COLOR[status] ?? "#6b7280";
}
// ─── Title resolution ─────────────────────────────────────────────────────────
// Uses translatedName when available (set during sync in user's displayLanguage).
// Does NOT hardcode 'zh-CN' — works for any language the user configured.
export function resolveTitle(show) {
    // translatedName is populated during sync in the user's configured language
    if (show.translatedName) {
        // Show original as secondary if it differs
        const secondary = show.originalName && show.originalName !== show.translatedName
            ? show.originalName
            : show.title !== show.translatedName
                ? show.title
                : null;
        return { primary: show.translatedName, secondary };
    }
    // No translation available — use stored title, show original as secondary
    return {
        primary: show.title,
        secondary: show.originalName && show.originalName !== show.title
            ? show.originalName
            : null,
    };
}
// ─── Overview resolution ──────────────────────────────────────────────────────
// Prefers translatedOverview (set during sync), falls back to original overview.
export function resolveOverview(show) {
    const text = show.translatedOverview || show.overview;
    if (!text || text.trim() === "")
        return "暂无简介";
    return text;
}
// ─── Episode title resolution ─────────────────────────────────────────────────
// Prefers translatedTitle (set during sync), falls back to original title.
export function resolveEpisodeTitle(episode) {
    const title = episode.translatedTitle || episode.title;
    if (title && title.trim() !== "")
        return title;
    // Season 0 = Specials
    if (episode.seasonNumber === 0)
        return `特别篇 ${episode.episodeNumber}`;
    return `第 ${episode.episodeNumber} 集`;
}
// ─── Episode overview resolution ─────────────────────────────────────────────
export function resolveEpisodeOverview(episode) {
    return episode.translatedOverview || episode.overview || null;
}
// ─── Date formatting ──────────────────────────────────────────────────────────
export function fmtDateZh(date) {
    if (!date)
        return "从未";
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (diff < 0)
        return "即将播出";
    if (diff === 0)
        return "今天";
    if (diff === 1)
        return "昨天";
    if (diff < 7)
        return `${diff} 天前`;
    if (diff < 30)
        return `${Math.floor(diff / 7)} 周前`;
    if (diff < 365)
        return `${Math.floor(diff / 30)} 个月前`;
    return `${Math.floor(diff / 365)} 年前`;
}
export function fmtAirDate(date) {
    if (!date)
        return "未知";
    try {
        return new Date(date).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }
    catch {
        return date;
    }
}
export function fmtRuntime(minutes) {
    if (minutes === null || minutes === undefined || minutes <= 0)
        return "";
    if (minutes < 60)
        return `${minutes} 分钟`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}
//# sourceMappingURL=i18n.js.map