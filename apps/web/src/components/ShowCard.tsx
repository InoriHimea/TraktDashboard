import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tv2, PlayCircle } from "lucide-react";
import type { ShowProgress } from "@trakt-dashboard/types";
import { ProgressBar } from "./ProgressBar";
import { WatchedBadge } from "./ui/WatchedBadge";
import { tmdbImage, formatEpisode } from "../lib/utils";

interface ShowCardProps {
    progress: ShowProgress;
    index: number;
}

const STATUS_COLOR: Record<string, string> = {
    "returning series": "var(--color-airing)",
    ended: "var(--color-ended)",
    canceled: "var(--color-error)",
    "in production": "var(--color-airing)",
};

export function ShowCard({ progress, index }: ShowCardProps) {
    const { show, watchedEpisodes, airedEpisodes, nextEpisode, completed, percentage } = progress;
    const poster = tmdbImage(show.posterPath, "w500");
    const statusColor = STATUS_COLOR[show.status] || "var(--color-text-muted)";
    const [imgError, setImgError] = useState(false);

    // Task 13: multilingual title logic
    const primaryTitle = show.translatedName ?? show.title;
    const secondaryTitle = show.translatedName ? (show.originalName ?? null) : null;

    return (
        <motion.div
            className="h-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.3,
                delay: Math.min(index * 0.03, 0.4),
                ease: [0.16, 1, 0.3, 1],
            }}
        >
            <Link to={`/shows/${show.id}`} className="block h-full no-underline">
                <motion.div
                    whileHover={{
                        y: -3,
                        boxShadow: "var(--shadow-media-card-hover)",
                    }}
                    transition={{ duration: 0.15 }}
                    className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
                    style={{ boxShadow: "var(--shadow-media-card)" }}
                >
                    {/* Poster — 2:3 aspect ratio */}
                    <div className="relative aspect-[2/3] bg-[var(--color-surface-3)]">
                        {poster && !imgError ? (
                            <img
                                src={poster}
                                alt={show.title}
                                onError={() => setImgError(true)}
                                className="w-full h-full object-cover block"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Tv2
                                    size={32}
                                    className="text-[var(--color-text-muted)] opacity-30"
                                />
                            </div>
                        )}

                        {/* Watched badge (shared, Trakt double-check) */}
                        {completed && (
                            <div className="absolute top-2 right-2">
                                <WatchedBadge size="sm" />
                            </div>
                        )}

                        {/* Progress overlay at bottom */}
                        <div
                            style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: "24px 10px 8px",
                                background:
                                    "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
                            }}
                        >
                            <ProgressBar
                                watched={watchedEpisodes}
                                aired={airedEpisodes}
                                total={show.totalEpisodes}
                                compact
                                showLabel={false}
                            />
                        </div>
                    </div>

                    {/* Info section */}
                    <div className="flex min-h-[104px] flex-1 flex-col p-[12px_14px_14px]">
                        {/* Primary title */}
                        <h3
                            className="h-4 truncate text-[13px] font-semibold leading-4 tracking-tight text-[var(--color-text)]"
                            title={primaryTitle}
                        >
                            {primaryTitle}
                        </h3>

                        {/* Original title (secondary) */}
                        <p
                            className="mt-1 h-[14px] truncate text-[11px] leading-[14px] text-[var(--color-text-muted)]"
                            title={secondaryTitle ?? undefined}
                            aria-hidden={!secondaryTitle}
                        >
                            {secondaryTitle ?? "\u00a0"}
                        </p>

                        {/* Status + network */}
                        <div className="mt-1.5 flex h-4 items-center gap-1.5">
                            <span
                                className="inline-block w-[5px] h-[5px] rounded-full shrink-0"
                                style={{ background: statusColor }}
                            />
                            <span className="truncate text-[11px] text-[var(--color-text-muted)]">
                                {show.network || show.status}
                            </span>
                        </div>

                        {/* Episode count */}
                        <div className="mt-auto flex items-center justify-between">
                            <span className="text-[11px] text-[var(--color-text-muted)]">
                                <span className="text-[var(--color-watched)] font-medium">
                                    {watchedEpisodes}
                                </span>
                                {" / "}
                                {airedEpisodes}
                            </span>
                            <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                                {percentage}%
                            </span>
                        </div>

                        {/* Next episode */}
                        <div className="mt-1.5 flex h-4 items-center justify-end">
                            {nextEpisode && !completed && (
                                <span className="flex items-center gap-1 truncate text-[10px] leading-4 text-[var(--color-accent)]">
                                    <PlayCircle size={10} className="shrink-0" />
                                    {formatEpisode(
                                        nextEpisode.seasonNumber,
                                        nextEpisode.episodeNumber,
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                </motion.div>
            </Link>
        </motion.div>
    );
}
