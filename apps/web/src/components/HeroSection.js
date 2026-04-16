import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * HeroSection — 三栏布局: 海报 | 信息 | 侧边栏
 * 终极视觉修复版：原生 style 标签强制渲染渐变色 + 悬浮吸顶 + 修复底部裁切
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Info, Tv2 } from "lucide-react";
import { resolveTitle, resolveOverview, statusZh, statusColor, fmtDateZh, } from "../lib/i18n";
import { resolveShowPoster } from "../lib/image";
export function HeroSection({ progress, onWatchClick }) {
    const { show, lastWatchedAt, seasons } = progress;
    const [posterError, setPosterError] = useState(false);
    const posterUrl = resolveShowPoster(show.posterPath, "w500");
    const { primary, secondary } = resolveTitle(show);
    const overview = resolveOverview(show);
    const sColor = statusColor(show.status);
    const sLabel = statusZh(show.status);
    // Watched badge: all aired episodes watched
    const isAllWatched = progress.airedEpisodes > 0 &&
        progress.watchedEpisodes >= progress.airedEpisodes;
    const year = show.firstAired
        ? new Date(show.firstAired).getFullYear()
        : null;
    const isAiring = show.status === "returning series" || show.status === "in production";
    // Inject .text-gradient-ruby styles into document.head and clean up on unmount
    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = `
      .text-gradient-ruby {
        background: linear-gradient(135deg, #FF2E54 0%, #FF738F 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        color: transparent;
      }
    `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);
    return (_jsx("div", { className: "w-full max-w-[1200px] mx-auto px-6 lg:px-10 pt-8 pb-4", children: _jsxs("div", { className: "flex flex-col lg:flex-row items-start relative", style: { gap: "40px" }, children: [_jsxs(motion.div, { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }, className: "relative group cursor-pointer shrink-0", style: { width: "260px" }, onClick: onWatchClick, role: "button", tabIndex: 0, "aria-label": "\u7EE7\u7EED\u89C2\u770B", onKeyDown: (e) => e.key === "Enter" && onWatchClick?.(), children: [_jsx("div", { className: "absolute -inset-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[18px] pointer-events-none poster-shimmer-border" }), _jsxs("div", { className: "relative overflow-hidden shadow-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]", style: { borderRadius: "16px" }, children: [_jsx("div", { className: "aspect-[2/3] relative", children: posterUrl && !posterError ? (_jsx("img", { src: posterUrl, alt: primary, className: "w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500", onError: () => setPosterError(true) })) : (_jsx("div", { className: "w-full h-full flex items-center justify-center", children: _jsx(Tv2, { size: 40, className: "text-[var(--color-border)]" }) })) }), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" })] }), isAllWatched && (_jsx("div", { className: "flex justify-center mt-3", children: _jsxs("div", { className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface-2)] border border-emerald-500/30 shadow-sm", children: [_jsxs("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", className: "text-emerald-400 shrink-0", children: [_jsx("path", { d: "M20 6L9 17l-5-5", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("path", { d: "M20 6L9 17", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" })] }), _jsx("span", { className: "text-[11px] font-bold tracking-widest text-emerald-400 uppercase", children: "Watched" })] }) }))] }), _jsxs(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: {
                        duration: 0.45,
                        delay: 0.06,
                        ease: [0.16, 1, 0.3, 1],
                    }, style: {
                        flex: "1 1 0%",
                        display: "flex",
                        flexDirection: "column",
                        gap: "20px",
                        paddingTop: "4px",
                    }, children: [_jsxs("div", { children: [_jsx("h1", { className: "text-4xl font-bold tracking-tight text-[var(--color-text)] leading-tight mb-3", children: primary }), _jsxs("div", { className: "flex items-center flex-wrap gap-2 text-[14px] text-[var(--color-text-secondary)] font-medium", children: [year && _jsx("span", { children: year }), show.totalEpisodes > 0 && (_jsxs(_Fragment, { children: [_jsx(Dot, {}), _jsxs("span", { children: [show.totalEpisodes, " eps."] })] })), show.network && (_jsxs(_Fragment, { children: [_jsx(Dot, {}), _jsx("span", { children: show.network })] })), show.genres?.[0] && (_jsxs(_Fragment, { children: [_jsx(Dot, {}), _jsx("span", { children: show.genres[0] })] })), _jsx(Info, { size: 15, className: "text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-accent)] transition-colors ml-1" })] })] }), _jsxs("span", { className: "inline-flex items-center backdrop-blur-md", style: {
                                width: "fit-content",
                                gap: "8px",
                                fontSize: "13px",
                                fontWeight: "bold",
                                padding: "6px 16px",
                                color: sColor,
                                background: `linear-gradient(180deg, ${sColor}15 0%, ${sColor}05 100%)`,
                                border: `1px solid ${sColor}30`,
                                borderTopColor: `${sColor}70`,
                                borderRadius: "99px",
                                boxShadow: `inset 0 1px 2px rgba(255,255,255,0.2), inset 0 -1px 2px rgba(0,0,0,0.1), 0 4px 12px ${sColor}25`,
                                textShadow: "0 1px 1px rgba(0,0,0,0.1)",
                            }, children: [_jsx("span", { className: `w-2 h-2 rounded-full ${isAiring ? "animate-pulse" : ""}`, style: {
                                        background: sColor,
                                        boxShadow: `0 0 10px 1px ${sColor}`,
                                    } }), sLabel] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [show.imdbId && (_jsx("a", { href: `https://www.imdb.com/title/${show.imdbId}`, target: "_blank", rel: "noopener noreferrer", className: "hover:opacity-70 transition-opacity", "aria-label": "IMDb", children: _jsx("img", { src: "https://www.imdb.com/favicon.ico", alt: "IMDb", className: "rounded-[5px]", style: { width: "28px", height: "28px" } }) })), show.tmdbId && (_jsx("a", { href: `https://www.themoviedb.org/tv/${show.tmdbId}`, target: "_blank", rel: "noopener noreferrer", className: "hover:opacity-70 transition-opacity", "aria-label": "TMDB", children: _jsx("img", { src: "https://www.themoviedb.org/favicon.ico", alt: "TMDB", className: "rounded-[5px]", style: { width: "28px", height: "28px" } }) })), show.tvdbId && (_jsx("a", { href: `https://thetvdb.com/?tab=series&id=${show.tvdbId}`, target: "_blank", rel: "noopener noreferrer", className: "hover:opacity-70 transition-opacity", "aria-label": "TheTVDB", children: _jsx("span", { style: {
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "5px",
                                            background: "#6CB4E4",
                                            flexShrink: 0,
                                        }, children: _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: _jsx("path", { d: "M4 6h16M4 12h10M4 18h7", stroke: "white", strokeWidth: "2.5", strokeLinecap: "round" }) }) }) })), show.traktSlug && (_jsx("a", { href: `https://trakt.tv/shows/${show.traktSlug}`, target: "_blank", rel: "noopener noreferrer", className: "hover:opacity-70 transition-opacity", "aria-label": "Trakt", children: _jsx("span", { style: {
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "5px",
                                            background: "#ED1C24",
                                            flexShrink: 0,
                                        }, children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [_jsx("circle", { cx: "12", cy: "12", r: "9", stroke: "white", strokeWidth: "2" }), _jsx("path", { d: "M8 12l3 3 5-5", stroke: "white", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })] }) }) }))] }), _jsx(OverviewText, { text: overview })] }), _jsxs(motion.div, { initial: { opacity: 0, x: 10 }, animate: { opacity: 1, x: 0 }, transition: {
                        duration: 0.45,
                        delay: 0.12,
                        ease: [0.16, 1, 0.3, 1],
                    }, className: "hidden lg:flex flex-col bg-[var(--color-surface)] border border-[var(--color-border-subtle)] shadow-sm self-start", style: {
                        flex: "0 0 350px",
                        padding: "32px",
                        borderRadius: "24px",
                        gap: "28px",
                        position: "sticky",
                        top: "32px",
                        maxHeight: "calc(100vh - 64px)",
                        overflow: "hidden",
                    }, children: [_jsxs("div", { className: "flex items-center justify-between w-full shrink-0", children: [_jsxs("span", { className: "inline-flex items-center backdrop-blur-sm", style: {
                                        gap: "8px",
                                        fontSize: "12px",
                                        fontWeight: "bold",
                                        padding: "6px 12px",
                                        color: sColor,
                                        background: `linear-gradient(180deg, ${sColor}15 0%, ${sColor}05 100%)`,
                                        border: `1px solid ${sColor}20`,
                                        borderTopColor: `${sColor}50`,
                                        borderRadius: "99px",
                                        boxShadow: `inset 0 1px 2px rgba(255,255,255,0.15), 0 2px 6px ${sColor}15`,
                                    }, children: [_jsx("span", { className: `w-1.5 h-1.5 shrink-0 ${isAiring ? "animate-pulse" : ""}`, style: {
                                                background: sColor,
                                                borderRadius: "50%",
                                                boxShadow: `0 0 8px 1px ${sColor}`,
                                            } }), sLabel] }), _jsxs("span", { className: "text-[12px] font-medium text-[var(--color-text-muted)]", children: ["\u4E0A\u6B21\uFF1A", fmtDateZh(lastWatchedAt)] })] }), _jsx("div", { className: "shrink-0", style: {
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
                                gap: "10px",
                                width: "100%",
                            }, children: [
                                {
                                    value: `${show.totalSeasons}S · ${show.totalEpisodes}集`,
                                    label: "总集数",
                                },
                                {
                                    value: show.network || show.status || "—",
                                    label: "平台",
                                },
                                {
                                    value: show.firstAired
                                        ? String(new Date(show.firstAired).getFullYear())
                                        : "—",
                                    label: "首播年份",
                                },
                            ].map(({ value, label }) => (_jsxs("div", { style: {
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    backgroundColor: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                    padding: "12px 10px",
                                    borderRadius: "12px",
                                    gap: "4px",
                                }, children: [_jsx("span", { className: "text-[14px] font-bold text-[var(--color-text)] leading-none truncate", children: value }), _jsx("span", { className: "text-[11px] font-medium text-[var(--color-text-muted)] leading-none truncate", children: label })] }, label))) }), show.genres?.length > 0 && (_jsx("div", { className: "shrink-0", style: {
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                marginTop: "-4px",
                            }, children: show.genres.slice(0, 5).map((g, i) => {
                                const style = GENRE_COLORS[i % GENRE_COLORS.length];
                                return (_jsxs("span", { className: "inline-flex items-center shadow-sm", style: {
                                        gap: "6px",
                                        padding: "5px 10px",
                                        borderRadius: "10px",
                                        backgroundColor: "var(--color-surface-2)",
                                        borderLeft: "1px solid var(--color-border-subtle)",
                                        borderRight: "1px solid var(--color-border-subtle)",
                                        borderTop: "1px solid rgba(255,255,255,0.08)",
                                        borderBottom: "1px solid rgba(0,0,0,0.08)",
                                    }, children: [_jsx("span", { style: {
                                                width: "6px",
                                                height: "6px",
                                                borderRadius: "50%",
                                                backgroundColor: style.color,
                                                boxShadow: `0 0 8px ${style.color}`,
                                            } }), _jsx("span", { className: "text-[11px] font-bold tracking-wide", style: {
                                                color: "var(--color-text-secondary)",
                                            }, children: g })] }, g));
                            }) })), _jsx("div", { className: "w-full h-px bg-[var(--color-border-subtle)] my-0.5 shrink-0" }), _jsxs("div", { style: {
                                display: "flex",
                                flexDirection: "column",
                                flex: 1,
                                overflowY: "auto",
                                paddingRight: "4px",
                                gap: "24px",
                            }, children: [(() => {
                                    const totalEpisodes = show.totalEpisodes ??
                                        seasons.reduce((s, x) => s + x.episodeCount, 0);
                                    const totalWatched = seasons.reduce((s, x) => s + x.watchedCount, 0);
                                    const overallPct = totalEpisodes > 0
                                        ? Math.round((totalWatched / totalEpisodes) * 100)
                                        : 0;
                                    const remaining = totalEpisodes - totalWatched;
                                    return (_jsxs("div", { style: {
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "14px",
                                            width: "100%",
                                        }, children: [_jsxs("div", { className: "flex justify-between items-end", children: [_jsx("span", { className: "text-[13px] font-medium text-[var(--color-text-muted)] mb-1", children: "\u603B\u89C2\u770B\u8FDB\u5EA6" }), _jsxs("div", { className: "flex items-baseline", style: { gap: "10px" }, children: [_jsxs("span", { className: "text-gradient-ruby", style: {
                                                                    fontSize: "44px",
                                                                    fontWeight: 900,
                                                                    lineHeight: 1.1, // 放宽行高
                                                                    paddingBottom: "8px", // 给底部留出渲染安全区
                                                                    marginBottom: "-8px", // 负边距拉回位置
                                                                    letterSpacing: "-0.02em",
                                                                    display: "inline-block",
                                                                }, children: [overallPct, "%"] }), _jsxs("span", { className: "text-[13px] font-medium text-[var(--color-text-muted)]", children: ["\u00B7 ", remaining, "\u96C6\u672A\u770B"] })] })] }), _jsx(ProgressBar, { pct: overallPct, totalTicks: totalEpisodes, colorFrom: "#FF2E54", colorTo: "#FF738F", trackRgb: "255,46,84", height: 28, labelLeft: `${totalWatched} / ${totalEpisodes} 集` })] }));
                                })(), seasons && seasons.length > 0 && (_jsxs("div", { style: {
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "16px",
                                        width: "100%",
                                        paddingBottom: "16px",
                                    }, children: [_jsx("span", { className: "text-[13px] font-medium text-[var(--color-text-muted)]", children: "\u5404\u5B63\u8FDB\u5EA6" }), _jsx("div", { style: {
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "16px",
                                            }, children: seasons.map((s, i) => {
                                                const totalSeasonEpisodes = s.episodeCount;
                                                const pct = totalSeasonEpisodes > 0
                                                    ? Math.round((s.watchedCount /
                                                        totalSeasonEpisodes) *
                                                        100)
                                                    : 0;
                                                const pal = SEASON_PALETTES[i % SEASON_PALETTES.length];
                                                const statusText = pct === 100
                                                    ? `${totalSeasonEpisodes}集 · 全部看完`
                                                    : s.watchedCount === 0
                                                        ? `${totalSeasonEpisodes}集 · 未开始`
                                                        : `${totalSeasonEpisodes}集 · 已看 ${s.watchedCount}集`;
                                                return (_jsxs("div", { style: {
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "8px",
                                                        width: "100%",
                                                    }, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-[14px] font-bold text-[var(--color-text)]", children: s.seasonNumber === 0
                                                                        ? "Specials"
                                                                        : `Season ${s.seasonNumber}` }), _jsx("span", { className: "text-[12px] font-medium text-[var(--color-text-muted)] text-right", children: statusText })] }), _jsx(ProgressBar, { pct: pct, totalTicks: totalSeasonEpisodes, colorFrom: pal.colorFrom, colorTo: pal.colorTo, trackRgb: pal.trackRgb, height: 20, labelLeft: pct > 0
                                                                ? `${pct}%`
                                                                : undefined })] }, s.seasonNumber));
                                            }) })] }))] })] })] }) }));
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
const GENRE_COLORS = [
    { color: "#10b981" },
    { color: "#8b5cf6" },
    { color: "#f59e0b" },
    { color: "#0ea5e9" },
    { color: "#e11d48" },
];
const SEASON_PALETTES = [
    { colorFrom: "#10b981", colorTo: "#34d399", trackRgb: "16,185,129" },
    { colorFrom: "#8b5cf6", colorTo: "#a78bfa", trackRgb: "139,92,246" },
    { colorFrom: "#f97316", colorTo: "#fb923c", trackRgb: "249,115,22" },
    { colorFrom: "#eab308", colorTo: "#facc15", trackRgb: "234,179,8" },
    { colorFrom: "#3b82f6", colorTo: "#60a5fa", trackRgb: "59,130,246" },
];
function ProgressBar({ pct, totalTicks, colorFrom, colorTo, trackRgb, height = 28, labelLeft, }) {
    const validPct = Math.min(Math.max(pct, 0), 100);
    const ticks = Array.from({ length: Math.max(totalTicks - 1, 0) }, (_, i) => i + 1);
    return (_jsxs("div", { className: "relative w-full rounded-lg overflow-hidden shadow-inner", style: {
            height,
            backgroundColor: `rgba(${trackRgb}, 0.12)`,
            transform: "translateZ(0)", // 确保 Safari 圆角裁切
        }, children: [labelLeft && (_jsx("div", { className: "absolute top-0 bottom-0 left-3 flex items-center z-0 pointer-events-none", children: _jsx("span", { className: "text-[12px] font-bold tracking-wide whitespace-nowrap", style: { color: `rgba(${trackRgb}, 0.65)` }, children: labelLeft }) })), validPct > 0 && (_jsxs("div", { className: "absolute top-0 bottom-0 left-0 z-10 overflow-hidden", style: {
                    width: `${validPct}%`,
                    background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
                    borderTopRightRadius: validPct === 100 ? "8px" : "0",
                    borderBottomRightRadius: validPct === 100 ? "8px" : "0",
                }, children: [ticks.map((i) => {
                        const tickPos = (i / totalTicks) * 100;
                        if (tickPos >= validPct)
                            return null;
                        return (_jsx("div", { className: "absolute top-0 bottom-0 bg-black/10 mix-blend-multiply", style: {
                                left: `${(tickPos / validPct) * 100}%`,
                                width: "1px",
                            } }, i));
                    }), labelLeft && (_jsx("div", { className: "absolute top-0 bottom-0 left-3 flex items-center z-20 pointer-events-none", children: _jsx("span", { className: "text-[12px] font-bold tracking-wide text-white whitespace-nowrap drop-shadow-sm", children: labelLeft }) }))] }))] }));
}
function Dot() {
    return (_jsx("span", { className: "w-1 h-1 rounded-full bg-[var(--color-text-muted)] opacity-50 inline-block" }));
}
function OverviewText({ text }) {
    const [expanded, setExpanded] = useState(false);
    const [clamped, setClamped] = useState(false);
    function handleRef(el) {
        if (el)
            setClamped(el.scrollHeight > el.clientHeight + 2);
    }
    if (!text)
        return null;
    return (_jsxs("div", { className: "max-w-2xl mt-1", children: [_jsx("p", { ref: handleRef, className: "text-[14px] text-[var(--color-text-secondary)] leading-relaxed", style: expanded
                    ? undefined
                    : {
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }, children: text }), clamped && (_jsx("button", { onClick: () => setExpanded((v) => !v), className: "mt-2 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors font-medium border border-[var(--color-border-subtle)] hover:border-[var(--color-accent-dim)] bg-[var(--color-surface-2)] px-3 py-1 rounded-md", children: expanded ? "收起" : "展开阅读更多" }))] }));
}
//# sourceMappingURL=HeroSection.js.map