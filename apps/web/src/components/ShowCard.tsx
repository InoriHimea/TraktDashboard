import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tv2, CheckCircle2, PlayCircle } from "lucide-react";
import type { ShowProgress } from "@trakt-dashboard/types";
import { ProgressBar } from "./ProgressBar";
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
    const {
        show,
        watchedEpisodes,
        airedEpisodes,
        nextEpisode,
        completed,
        percentage,
    } = progress;
    const poster = tmdbImage(show.posterPath, "w300");
    const statusColor = STATUS_COLOR[show.status] || "var(--color-text-muted)";
    const [imgError, setImgError] = useState(false);

    // Task 13: multilingual title logic
    const primaryTitle = show.translatedName ?? show.title;
    const secondaryTitle = show.translatedName
        ? (show.originalName ?? null)
        : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.3,
                delay: Math.min(index * 0.03, 0.4),
                ease: [0.16, 1, 0.3, 1],
            }}
        >
            <Link
                to={`/shows/${show.id}`}
                className="no-underline block"
            >
                <motion.div
                    whileHover={{
                        y: -3,
                        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                    }}
                    transition={{ duration: 0.15 }}
                    className="rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border-subtle)] cursor-pointer"
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

                        {/* Completion badge */}
                        {completed && (
                            <div className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-0.5 flex items-center gap-1 backdrop-blur-sm">
                                <CheckCircle2 size={11} className="text-[var(--color-watched)]" />
                                <span className="text-[11px] text-white font-semibold">完结</span>
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
                    <div className="p-[10px_12px_12px]">
                        {/* Primary title */}
                        <h3
                            className="truncate text-[13px] font-semibold text-[var(--color-text)] tracking-tight leading-tight"
                            style={{ marginBottom: secondaryTitle ? "2px" : "4px" }}
                            title={primaryTitle}
                        >
                            {primaryTitle}
                        </h3>

                        {/* Original title (secondary) */}
                        {secondaryTitle && (
                            <p
                                className="truncate text-[11px] text-[var(--color-text-muted)] mb-1 leading-tight"
                                title={secondaryTitle}
                            >
                                {secondaryTitle}
                            </p>
                        )}

                        {/* Status + network */}
                        <div className="flex items-center gap-1.5 mb-3">
                            <span
                                className="inline-block w-[5px] h-[5px] rounded-full shrink-0"
                                style={{ background: statusColor }}
                            />
                            <span className="truncate text-[11px] text-[var(--color-text-muted)]">
                                {show.network || show.status}
                            </span>
                        </div>

                        {/* Episode count */}
                        <div className="flex items-center justify-between">
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
                        {nextEpisode && !completed && (
                            <div className="flex items-center justify-end mt-1.5">
                                <span className="flex items-center gap-1 text-[10px] text-[var(--color-accent)]">
                                    <PlayCircle size={10} />
                                    {formatEpisode(
                                        nextEpisode.seasonNumber,
                                        nextEpisode.episodeNumber,
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                </motion.div>
            </Link>
        </motion.div>
    );
}
