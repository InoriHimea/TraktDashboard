/**
 * MetadataSidebar — 玻璃拟物化元数据与统计侧边栏
 *
 * 包含:
 *   - RatingCard: 评分展示
 *   - ShowInfoGrid: 作品信息网格（平台/首播/季数/集数）
 *   - GenreTags: 类型标签组
 *   - SeasonProgressWall: 分季进度墙
 *
 * 每个子组件均可独立使用，也可通过 <MetadataSidebar /> 组合渲染
 */
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Star, Tv, Calendar, Layers, Film, Info } from "lucide-react";
import { cn } from "../lib/utils";
import { InlineProgressBar } from "./ProgressBarWidget";
import type { Show, SeasonProgress } from "@trakt-dashboard/types";

// ─── 动画预设 ─────────────────────────────────────────────────────────────────

const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.35,
            delay: i * 0.07,
            ease: [0.16, 1, 0.3, 1],
        },
    }),
};

// ─── 玻璃卡片基础容器 ─────────────────────────────────────────────────────────

interface GlassCardProps {
    children: ReactNode;
    className?: string;
}

function GlassCard({ children, className }: GlassCardProps) {
    return (
        <div
            className={cn(
                "rounded-2xl border border-white/[0.07]",
                "bg-zinc-900/50 backdrop-blur-lg",
                "p-4",
                className,
            )}
        >
            {children}
        </div>
    );
}

// ─── Section 标题 ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
    return (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3">
            {children}
        </p>
    );
}

// ─── Task 4a: 评分卡 ──────────────────────────────────────────────────────────

export interface RatingCardProps {
    /** 0-10 评分 */
    score?: number | null;
    /** 评分来源标签，如 "Trakt" / "TMDB" */
    source?: string;
    /** 投票人数 */
    voteCount?: number;
    className?: string;
}

export function RatingCard({
    score,
    source = "Trakt",
    voteCount,
    className,
}: RatingCardProps) {
    const stars = score != null ? Math.round((score / 10) * 5) : 0;
    const displayScore = score != null ? score.toFixed(1) : "—";

    return (
        <GlassCard className={className}>
            <SectionLabel>评分</SectionLabel>
            <div className="flex items-end gap-3">
                {/* 大号分数 */}
                <span className="text-4xl font-extrabold tracking-tight text-white leading-none">
                    {displayScore}
                </span>
                <div className="flex flex-col gap-1 pb-0.5">
                    {/* 星级 */}
                    <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                                key={i}
                                size={12}
                                className={cn(
                                    "transition-colors",
                                    i < stars
                                        ? "fill-purple-400 text-purple-400"
                                        : "fill-white/10 text-white/10",
                                )}
                            />
                        ))}
                    </div>
                    {/* 来源 + 票数 */}
                    <span className="text-[10px] text-white/30 leading-none">
                        {source}
                        {voteCount != null &&
                            ` · ${voteCount.toLocaleString()} 票`}
                    </span>
                </div>
            </div>
        </GlassCard>
    );
}

// ─── Task 4b: 作品信息网格 ────────────────────────────────────────────────────

export interface ShowInfoItem {
    label: string;
    value: string | number | null | undefined;
    icon?: ReactNode;
}

export interface ShowInfoGridProps {
    items: ShowInfoItem[];
    columns?: 2 | 3;
    className?: string;
}

export function ShowInfoGrid({
    items,
    columns = 2,
    className,
}: ShowInfoGridProps) {
    const filtered = items.filter(
        (item) => item.value != null && item.value !== "",
    );

    return (
        <GlassCard className={className}>
            <SectionLabel>作品信息</SectionLabel>
            <div
                className={cn(
                    "grid gap-x-4 gap-y-3",
                    columns === 2 ? "grid-cols-2" : "grid-cols-3",
                )}
            >
                {filtered.map(({ label, value, icon }) => (
                    <div key={label} className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] text-white/30 font-medium flex items-center gap-1 truncate">
                            {icon}
                            {label}
                        </span>
                        <span className="text-[13px] text-white/85 font-medium truncate">
                            {value ?? "—"}
                        </span>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}

// ─── Task 4c: 类型标签组 ──────────────────────────────────────────────────────

export interface GenreTagsProps {
    genres: string[];
    className?: string;
}

export function GenreTags({ genres, className }: GenreTagsProps) {
    if (!genres.length) return null;

    return (
        <GlassCard className={className}>
            <SectionLabel>类型</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
                {genres.map((genre) => (
                    <span
                        key={genre}
                        className={cn(
                            "px-3 py-1 rounded-full text-[11px] font-medium",
                            "bg-white/[0.07] text-white/60",
                            "border border-white/[0.06]",
                            "hover:bg-white/[0.12] hover:text-white/80 transition-colors cursor-default",
                        )}
                    >
                        {genre}
                    </span>
                ))}
            </div>
        </GlassCard>
    );
}

// ─── Task 4d: 分季进度墙 ──────────────────────────────────────────────────────

export interface SeasonProgressItem {
    seasonNumber: number;
    label?: string;
    watchedCount: number;
    episodeCount: number;
    airedCount?: number;
}

export interface SeasonProgressWallProps {
    seasons: SeasonProgressItem[];
    className?: string;
}

export function SeasonProgressWall({
    seasons,
    className,
}: SeasonProgressWallProps) {
    if (!seasons.length) return null;

    return (
        <GlassCard className={className}>
            <SectionLabel>分季进度</SectionLabel>
            <div className="flex flex-col gap-3">
                {seasons.map((season, i) => {
                    const total = season.episodeCount;
                    const watched = season.watchedCount;
                    const aired = season.airedCount ?? total;
                    const pct =
                        total > 0 ? Math.round((watched / total) * 100) : 0;
                    const airedPct = total > 0 ? (aired / total) * 100 : 100;
                    const label =
                        season.label ?? `第 ${season.seasonNumber} 季`;
                    const isComplete = watched >= aired && aired > 0;

                    return (
                        <motion.div
                            key={season.seasonNumber}
                            custom={i}
                            variants={fadeUp}
                            initial="hidden"
                            animate="visible"
                            className="flex items-center gap-3"
                        >
                            {/* 季名 */}
                            <span className="text-[11px] text-white/50 w-14 shrink-0 truncate">
                                {label}
                            </span>

                            {/* 进度轨道 */}
                            <div className="flex-1 relative h-1 rounded-full bg-white/[0.08] overflow-hidden">
                                {/* 已播出但未看（暗色） */}
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full bg-white/[0.15] transition-all duration-700"
                                    style={{ width: `${airedPct}%` }}
                                />
                                {/* 已看（紫色） */}
                                <motion.div
                                    className={cn(
                                        "absolute inset-y-0 left-0 rounded-full transition-colors",
                                        isComplete
                                            ? "bg-emerald-500"
                                            : "bg-purple-500",
                                    )}
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: `${(watched / Math.max(total, 1)) * 100}%`,
                                    }}
                                    transition={{
                                        duration: 0.8,
                                        delay: i * 0.05,
                                        ease: [0.16, 1, 0.3, 1],
                                    }}
                                />
                            </div>

                            {/* 百分比 */}
                            <span
                                className={cn(
                                    "text-[11px] tabular-nums w-8 text-right shrink-0 font-medium",
                                    isComplete
                                        ? "text-emerald-400"
                                        : pct > 0
                                          ? "text-purple-400"
                                          : "text-white/25",
                                )}
                            >
                                {pct}%
                            </span>
                        </motion.div>
                    );
                })}
            </div>
        </GlassCard>
    );
}

// ─── 组合: MetadataSidebar ────────────────────────────────────────────────────

export interface MetadataSidebarProps {
    show: Show;
    /** 评分 0-10 */
    rating?: number | null;
    ratingSource?: string;
    ratingVotes?: number;
    seasons?: SeasonProgressItem[];
    className?: string;
}

export function MetadataSidebar({
    show,
    rating,
    ratingSource,
    ratingVotes,
    seasons = [],
    className,
}: MetadataSidebarProps) {
    // 构建信息网格数据
    const infoItems: ShowInfoItem[] = [
        {
            label: "播出平台",
            value: show.network,
            icon: <Tv size={9} />,
        },
        {
            label: "首播日期",
            value: show.firstAired
                ? new Date(show.firstAired).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                  })
                : null,
            icon: <Calendar size={9} />,
        },
        {
            label: "总季数",
            value: show.totalSeasons ? `${show.totalSeasons} 季` : null,
            icon: <Layers size={9} />,
        },
        {
            label: "总集数",
            value: show.totalEpisodes ? `${show.totalEpisodes} 集` : null,
            icon: <Film size={9} />,
        },
        {
            label: "状态",
            value: show.status,
            icon: <Info size={9} />,
        },
    ];

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            {/* 评分 */}
            {rating != null && (
                <motion.div
                    custom={0}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                >
                    <RatingCard
                        score={rating}
                        source={ratingSource}
                        voteCount={ratingVotes}
                    />
                </motion.div>
            )}

            {/* 作品信息 */}
            <motion.div
                custom={1}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
            >
                <ShowInfoGrid items={infoItems} columns={2} />
            </motion.div>

            {/* 类型标签 */}
            {(show.genres?.length ?? 0) > 0 && (
                <motion.div
                    custom={2}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                >
                    <GenreTags genres={show.genres} />
                </motion.div>
            )}

            {/* 分季进度 */}
            {seasons.length > 0 && (
                <motion.div
                    custom={3}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                >
                    <SeasonProgressWall seasons={seasons} />
                </motion.div>
            )}
        </div>
    );
}
