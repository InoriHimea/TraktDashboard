/**
 * HeroSection — 三栏布局: 海报 | 信息 | 侧边栏
 * 终极视觉修复版：原生 style 标签强制渲染渐变色 + 悬浮吸顶 + 修复底部裁切
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { History, Info, RotateCcw, Tv2, RefreshCw, Bookmark } from "lucide-react";
import {
    resolveTitle,
    resolveOverview,
    statusZh,
    statusColor,
    fmtDateZh,
} from "../lib/i18n";
import { resolveShowPoster } from "../lib/image";
import { Button } from "./ui/Button";
import { Tag } from "./ui/Tag";
import { OverviewText } from "./ui/OverviewText";
import type { ShowProgress } from "@trakt-dashboard/types";

interface HeroSectionProps {
    progress: ShowProgress;
    onWatchClick?: () => void;
    onHistoryClick?: () => void;
    onResetClick?: () => void;
    onForceSyncClick?: () => void;
    onToggleWatchlist?: () => void;
    isForceSyncing?: boolean;
    isWatchlistPending?: boolean;
    inWatchlist?: boolean;
    isComplete?: boolean;
}

export function HeroSection({ progress, onWatchClick, onHistoryClick, onResetClick, onForceSyncClick, onToggleWatchlist, isForceSyncing, isWatchlistPending, inWatchlist, isComplete }: HeroSectionProps) {
    const { show, lastWatchedAt, seasons } = progress;
    const [posterError, setPosterError] = useState(false);

    const posterUrl = resolveShowPoster(show.posterPath, "w500");
    const { primary, secondary } = resolveTitle(show);
    const overview = resolveOverview(show);
    const sColor = statusColor(show.status);
    const sLabel = statusZh(show.status);

    // Watched badge: all aired episodes watched
    const isAllWatched =
        progress.airedEpisodes > 0 &&
        progress.watchedEpisodes >= progress.airedEpisodes;
    const year = show.firstAired
        ? new Date(show.firstAired).getFullYear()
        : null;
    const isAiring =
        show.status === "returning series" || show.status === "in production";

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

    return (
        <div className="w-full max-w-none px-0 pt-8 pb-4">
            <div
                className="flex flex-col lg:flex-row items-start relative"
                style={{ gap: "40px" }}
            >
                {/* ── 1. 左: 海报 ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="relative group cursor-pointer shrink-0"
                    style={{ width: "260px" }}
                    onClick={onWatchClick}
                    role="button"
                    tabIndex={0}
                    aria-label="继续观看"
                    onKeyDown={(e) => e.key === "Enter" && onWatchClick?.()}
                >
                    <div className="absolute -inset-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[18px] pointer-events-none poster-shimmer-border" />
                    <div
                        className="relative overflow-hidden shadow-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]"
                        style={{ borderRadius: "16px" }}
                    >
                        <div className="aspect-[2/3] relative">
                            {posterUrl && !posterError ? (
                                <img
                                    src={posterUrl}
                                    alt={primary}
                                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                                    onError={() => setPosterError(true)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Tv2
                                        size={40}
                                        className="text-[var(--color-border)]"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />

                        {/* Watched badge — inside poster, bottom-center, double-groove border */}
                        {isAllWatched && (
                            <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-10 pointer-events-none">
                                <div style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "6px 14px",
                                    borderRadius: "99px",
                                    background: "rgba(0,0,0,0.55)",
                                    backdropFilter: "blur(12px)",
                                    WebkitBackdropFilter: "blur(12px)",
                                    boxShadow: "0 0 0 1px rgba(52,211,153,0.55), 0 0 0 3px rgba(52,211,153,0.12), inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px rgba(0,0,0,0.4)",
                                    border: "1px solid rgba(52,211,153,0.7)",
                                }}>
                                    {/* Double checkmark */}
                                    <svg width="15" height="11" viewBox="0 0 30 22" fill="none" style={{ color: "#34d399", flexShrink: 0 }}>
                                        <path d="M2 11L8 17L18 6" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M11 11L17 17L27 6" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#34d399", textTransform: "uppercase" }}>
                                        Watched
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* ── 2. 中: 主信息 ── */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.45,
                        delay: 0.06,
                        ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{
                        flex: "1 1 0%",
                        display: "flex",
                        flexDirection: "column",
                        gap: "20px",
                        paddingTop: "4px",
                    }}
                >
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] leading-tight mb-3">
                            {primary}
                        </h1>
                        <div className="flex items-center flex-wrap gap-2 text-[14px] text-[var(--color-text-secondary)] font-medium">
                            {year && <span>{year}</span>}
                            {show.totalEpisodes > 0 && (
                                <>
                                    <Dot />
                                    <span>{show.totalEpisodes} eps.</span>
                                </>
                            )}
                            {show.network && (
                                <>
                                    <Dot />
                                    <span>{show.network}</span>
                                </>
                            )}
                            {show.genres?.[0] && (
                                <>
                                    <Dot />
                                    <span>{show.genres[0]}</span>
                                </>
                            )}
                            <Info
                                size={15}
                                className="text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-accent)] transition-colors ml-1"
                            />
                        </div>
                    </div>

                    <Tag
                        color={isAiring ? "emerald" : "slate"}
                        variant="3d"
                        className="w-fit rounded-full px-4 py-1.5"
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${isAiring ? "animate-pulse" : ""}`}
                            style={{ background: sColor, boxShadow: `0 0 10px 1px ${sColor}` }}
                        />
                        {sLabel}
                    </Tag>

                    <div className="flex flex-wrap items-center gap-3">
                        {show.imdbId && (
                            <a
                                href={`https://www.imdb.com/title/${show.imdbId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:opacity-70 transition-opacity"
                                aria-label="IMDb"
                            >
                                <img
                                    src="https://www.imdb.com/favicon.ico"
                                    alt="IMDb"
                                    className="rounded-[5px]"
                                    style={{ width: "28px", height: "28px" }}
                                />
                            </a>
                        )}
                        {show.tmdbId && (
                            <a
                                href={`https://www.themoviedb.org/tv/${show.tmdbId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:opacity-70 transition-opacity"
                                aria-label="TMDB"
                            >
                                <img
                                    src="https://www.themoviedb.org/favicon.ico"
                                    alt="TMDB"
                                    className="rounded-[5px]"
                                    style={{ width: "28px", height: "28px" }}
                                />
                            </a>
                        )}
                        {show.tvdbId && (
                            <a
                                href={`https://thetvdb.com/?tab=series&id=${show.tvdbId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:opacity-70 transition-opacity"
                                aria-label="TheTVDB"
                            >
                                {/* TheTVDB inline SVG icon */}
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "28px",
                                        height: "28px",
                                        borderRadius: "5px",
                                        background: "#6CB4E4",
                                        flexShrink: 0,
                                    }}
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M4 6h16M4 12h10M4 18h7"
                                            stroke="white"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </span>
                            </a>
                        )}
                        {show.traktSlug && (
                            <a
                                href={`https://trakt.tv/shows/${show.traktSlug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:opacity-70 transition-opacity"
                                aria-label="Trakt"
                            >
                                {/* Trakt inline SVG — favicon.ico is unreliable */}
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "28px",
                                        height: "28px",
                                        borderRadius: "5px",
                                        background: "#ED1C24",
                                        flexShrink: 0,
                                    }}
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="9"
                                            stroke="white"
                                            strokeWidth="2"
                                        />
                                        <path
                                            d="M8 12l3 3 5-5"
                                            stroke="white"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </span>
                            </a>
                        )}
                    </div>

                    <OverviewText text={overview} className="max-w-2xl mt-1" />

                    {/* Action buttons — inline with middle column content */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        {isComplete && onResetClick && (
                            <Button
                                type="button"
                                variant="secondary"
                                color="violet"
                                size="sm"
                                icon={<RotateCcw size={14} />}
                                onClick={onResetClick}
                                className="rounded-full"
                            >
                                再看一遍...
                            </Button>
                        )}
                        {onHistoryClick && (
                            <Button
                                type="button"
                                variant="secondary"
                                color="slate"
                                size="sm"
                                icon={<History size={14} />}
                                onClick={onHistoryClick}
                                className="rounded-full"
                            >
                                观看历史
                            </Button>
                        )}
                        {onForceSyncClick && (
                            <Button
                                type="button"
                                variant="secondary"
                                color="slate"
                                size="sm"
                                icon={<RefreshCw size={14} className={isForceSyncing ? "animate-spin" : ""} />}
                                onClick={onForceSyncClick}
                                disabled={isForceSyncing}
                                className="rounded-full"
                            >
                                刷新元数据
                            </Button>
                        )}
                        {onToggleWatchlist && (
                            <Button
                                type="button"
                                variant={inWatchlist ? "primary" : "secondary"}
                                color="amber"
                                size="sm"
                                icon={<Bookmark size={14} fill={inWatchlist ? "currentColor" : "none"} />}
                                onClick={onToggleWatchlist}
                                disabled={isWatchlistPending}
                                className="rounded-full"
                            >
                                {inWatchlist ? "已在待看" : "加入待看"}
                            </Button>
                        )}
                    </div>
                </motion.div>

                {/* ── 3. 右: 侧边栏 ── */}
                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                        duration: 0.45,
                        delay: 0.12,
                        ease: [0.16, 1, 0.3, 1],
                    }}
                    className="hidden lg:flex flex-col bg-[var(--color-surface)] border border-[var(--color-border-subtle)] shadow-sm self-start"
                    style={{
                        flex: "0 0 400px",
                        padding: "20px",
                        borderRadius: "24px",
                        gap: "20px",
                        position: "sticky",
                        top: "32px",
                        maxHeight: "calc(100vh - 64px)",
                        overflow: "hidden",
                    }}
                >
                    <div className="flex items-center justify-between w-full shrink-0">
                        <Tag
                            color={isAiring ? "emerald" : "slate"}
                            variant="3d"
                            size="sm"
                            className="rounded-full"
                        >
                            <span
                                className={`w-1.5 h-1.5 shrink-0 rounded-full ${isAiring ? "animate-pulse" : ""}`}
                                style={{ background: sColor, boxShadow: `0 0 8px 1px ${sColor}` }}
                            />
                            {sLabel}
                        </Tag>
                        <span className="text-[12px] font-medium text-[var(--color-text-muted)]">
                            上次：{fmtDateZh(lastWatchedAt)}
                        </span>
                    </div>

                    <div
                        className="shrink-0"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: "8px",
                            width: "100%",
                        }}
                    >
                        {[
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
                                    ? String(
                                          new Date(
                                              show.firstAired,
                                          ).getFullYear(),
                                      )
                                    : "—",
                                label: "首播年份",
                            },
                        ].map(({ value, label }) => (
                            <div
                                key={label}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    backgroundColor: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                    padding: "12px 10px",
                                    borderRadius: "12px",
                                    gap: "4px",
                                }}
                            >
                                <span className="text-[14px] font-bold text-[var(--color-text)] leading-snug break-words">
                                    {value}
                                </span>
                                <span className="text-[11px] font-medium text-[var(--color-text-muted)] leading-none truncate">
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {show.genres?.length > 0 && (
                        <div
                            className="shrink-0"
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                marginTop: "-4px",
                            }}
                        >
                            {show.genres.slice(0, 5).map((g, i) => {
                                const style =
                                    GENRE_COLORS[i % GENRE_COLORS.length];
                                return (
                                    <Tag key={g} color="slate" variant="3d" size="sm">
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{
                                                backgroundColor: style.color,
                                                boxShadow: `0 0 8px ${style.color}`,
                                            }}
                                        />
                                        {g}
                                    </Tag>
                                );
                            })}
                        </div>
                    )}

                    <div className="w-full h-px bg-[var(--color-border-subtle)] my-0.5 shrink-0" />

                    {/* 内部滚动区 */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            flex: 1,
                            overflowY: "auto",
                            paddingRight: "4px",
                            gap: "24px",
                        }}
                    >
                        {(() => {
                            const totalEpisodes =
                                show.totalEpisodes ??
                                seasons.reduce((s, x) => s + x.episodeCount, 0);
                            const totalWatched = seasons.reduce(
                                (s, x) => s + x.watchedCount,
                                0,
                            );
                            const overallPct =
                                totalEpisodes > 0
                                    ? Math.round(
                                          (totalWatched / totalEpisodes) * 100,
                                      )
                                    : 0;
                            const remaining = totalEpisodes - totalWatched;
                            return (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "14px",
                                        width: "100%",
                                    }}
                                >
                                    <div className="flex justify-between items-end">
                                        <span className="text-[13px] font-medium text-[var(--color-text-muted)] mb-1">
                                            总观看进度
                                        </span>
                                        <div
                                            className="flex items-baseline"
                                            style={{ gap: "10px" }}
                                        >
                                            {/* Cyber percentage — gradient + glow shadow */}
                                            <span
                                                className="text-gradient-ruby"
                                                style={{
                                                    fontSize: "44px",
                                                    fontWeight: 900,
                                                    lineHeight: 1.1,
                                                    paddingBottom: "8px",
                                                    marginBottom: "-8px",
                                                    letterSpacing: "-0.02em",
                                                    display: "inline-block",
                                                    filter: "drop-shadow(0 0 12px rgba(255,46,84,0.4)) drop-shadow(0 2px 4px rgba(255,46,84,0.2))",
                                                }}
                                            >
                                                {overallPct}%
                                            </span>

                                            <span className="text-[13px] font-medium text-[var(--color-text-muted)]">
                                                · {remaining}集未看
                                            </span>
                                        </div>
                                    </div>
                                    <ProgressBar
                                        pct={overallPct}
                                        totalTicks={totalEpisodes}
                                        colorFrom="#FF2E54"
                                        colorTo="#FF738F"
                                        trackRgb="255,46,84"
                                        height={28}
                                        labelLeft={`${totalWatched} / ${totalEpisodes} 集`}
                                    />
                                </div>
                            );
                        })()}

                        {seasons && seasons.length > 0 && (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "16px",
                                    width: "100%",
                                    paddingBottom: "16px",
                                }}
                            >
                                <span className="text-[13px] font-medium text-[var(--color-text-muted)]">
                                    各季进度
                                </span>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "16px",
                                    }}
                                >
                                    {seasons.map((s, i) => {
                                        const totalSeasonEpisodes =
                                            s.episodeCount;
                                        const pct =
                                            totalSeasonEpisodes > 0
                                                ? Math.round(
                                                      (s.watchedCount /
                                                          totalSeasonEpisodes) *
                                                          100,
                                                  )
                                                : 0;
                                        const pal =
                                            SEASON_PALETTES[
                                                i % SEASON_PALETTES.length
                                            ];
                                        const statusText =
                                            pct === 100
                                                ? `${totalSeasonEpisodes}集 · 全部看完`
                                                : s.watchedCount === 0
                                                  ? `${totalSeasonEpisodes}集 · 未开始`
                                                  : `${totalSeasonEpisodes}集 · 已看 ${s.watchedCount}集`;
                                        return (
                                            <div
                                                key={s.seasonNumber}
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "8px",
                                                    width: "100%",
                                                }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[14px] font-bold text-[var(--color-text)]">
                                                        {s.seasonNumber === 0
                                                            ? "Specials"
                                                            : `Season ${s.seasonNumber}`}
                                                    </span>
                                                    <span className="text-[12px] font-medium text-[var(--color-text-muted)] text-right">
                                                        {statusText}
                                                    </span>
                                                </div>
                                                <ProgressBar
                                                    pct={pct}
                                                    totalTicks={
                                                        totalSeasonEpisodes
                                                    }
                                                    colorFrom={pal.colorFrom}
                                                    colorTo={pal.colorTo}
                                                    trackRgb={pal.trackRgb}
                                                    height={20}
                                                    labelLeft={
                                                        pct > 0
                                                            ? `${pct}%`
                                                            : undefined
                                                    }
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
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

interface ProgressBarProps {
    pct: number;
    totalTicks: number;
    colorFrom: string;
    colorTo: string;
    trackRgb: string;
    height?: number;
    labelLeft?: string;
}

function ProgressBar({
    pct,
    totalTicks,
    colorFrom,
    colorTo,
    trackRgb,
    height = 28,
    labelLeft,
}: ProgressBarProps) {
    const validPct = Math.min(Math.max(pct, 0), 100);
    const ticks = Array.from(
        { length: Math.max(totalTicks - 1, 0) },
        (_, i) => i + 1,
    );
    const r = Math.round(height / 2);

    // If fill is too narrow to fit the label comfortably, render it outside
    // the bar to the right of the fill tip instead of inside.
    const INLINE_THRESHOLD = 22; // percent — below this, label goes outside
    const labelInside = validPct >= INLINE_THRESHOLD;

    return (
        // Outer wrapper: position:relative so the outside label can be placed
        // relative to the bar without being clipped by overflow:hidden.
        <div style={{ position: "relative", width: "100%" }}>
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height,
                    borderRadius: r,
                    backgroundColor: `rgba(${trackRgb}, 0.08)`,
                    border: `1px solid rgba(${trackRgb}, 0.18)`,
                    boxShadow: `inset 0 2px 6px rgba(0,0,0,0.10), inset 0 1px 0 rgba(0,0,0,0.05)`,
                    overflow: "hidden",
                    transform: "translateZ(0)",
                }}
            >
                {/* Track ghost tick lines */}
                {ticks.map((i) => {
                    const tickPos = (i / totalTicks) * 100;
                    return (
                        <div
                            key={i}
                            style={{
                                position: "absolute",
                                top: "20%",
                                bottom: "20%",
                                left: `${tickPos}%`,
                                width: "1px",
                                background: `rgba(${trackRgb}, 0.25)`,
                                pointerEvents: "none",
                            }}
                        />
                    );
                })}

                {/* Filled gel capsule */}
                {validPct > 0 && (
                    <div
                        style={{
                            position: "absolute",
                            top: 0, bottom: 0, left: 0,
                            width: `${validPct}%`,
                            borderRadius: r,
                            background: `linear-gradient(90deg, ${colorFrom} 0%, ${colorTo} 100%)`,
                            overflow: "hidden",
                            boxShadow: `0 0 10px rgba(${trackRgb}, 0.45), 0 2px 6px rgba(${trackRgb}, 0.3), inset 0 1px 0 rgba(255,255,255,0.5)`,
                            zIndex: 1,
                        }}
                    >
                        {/* Layer 2: top specular highlight */}
                        <div style={{
                            position: "absolute",
                            top: 0, left: 0, right: 0,
                            height: "55%",
                            borderRadius: `${r}px ${r}px 40% 40% / ${r}px ${r}px 24px 24px`,
                            background: "linear-gradient(180deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.15) 60%, transparent 100%)",
                            pointerEvents: "none",
                        }} />

                        {/* Layer 3: bottom depth shadow */}
                        <div style={{
                            position: "absolute",
                            bottom: 0, left: 0, right: 0,
                            height: "35%",
                            background: "linear-gradient(0deg, rgba(0,0,0,0.18) 0%, transparent 100%)",
                            pointerEvents: "none",
                        }} />

                        {/* Layer 4: inner side vignette */}
                        <div style={{
                            position: "absolute",
                            inset: 0,
                            background: "radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.12) 100%)",
                            pointerEvents: "none",
                        }} />

                        {/* Tick dividers inside fill */}
                        {ticks.map((i) => {
                            const tickPos = (i / totalTicks) * 100;
                            if (tickPos >= validPct) return null;
                            return (
                                <div
                                    key={i}
                                    style={{
                                        position: "absolute",
                                        top: "15%", bottom: "15%",
                                        left: `${(tickPos / validPct) * 100}%`,
                                        width: "1px",
                                        background: "rgba(255,255,255,0.35)",
                                        pointerEvents: "none",
                                    }}
                                />
                            );
                        })}

                        {/* Label inside fill — only when fill is wide enough */}
                        {labelLeft && labelInside && (
                            <div style={{
                                position: "absolute", top: 0, bottom: 0, left: "12px",
                                display: "flex", alignItems: "center", zIndex: 10, pointerEvents: "none",
                            }}>
                                <span style={{
                                    fontSize: "12px", fontWeight: 800,
                                    color: "rgba(255,255,255,0.95)",
                                    textShadow: `0 1px 3px rgba(0,0,0,0.3)`,
                                    whiteSpace: "nowrap",
                                    letterSpacing: "0.01em",
                                }}>
                                    {labelLeft}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Label outside — floats just after the fill tip when fill is too narrow */}
            {labelLeft && !labelInside && (
                <div style={{
                    position: "absolute",
                    top: 0, bottom: 0,
                    // Sit 8px to the right of the fill edge
                    left: `calc(${validPct}% + 8px)`,
                    display: "flex", alignItems: "center",
                    pointerEvents: "none",
                    zIndex: 2,
                }}>
                    <span style={{
                        fontSize: "12px", fontWeight: 700,
                        color: `rgba(${trackRgb}, 1)`,
                        whiteSpace: "nowrap",
                        letterSpacing: "0.01em",
                    }}>
                        {labelLeft}
                    </span>
                </div>
            )}
        </div>
    );
}

function Dot() {
    return (
        <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] opacity-50 inline-block" />
    );
}
