import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Film } from "lucide-react";
import type { MovieProgress } from "@trakt-dashboard/types";
import { tmdbImage } from "../lib/utils";
import { t } from "../lib/i18n";

interface MovieCardProps {
    movie: MovieProgress;
    index: number;
}

export function MovieCard({ movie, index }: MovieCardProps) {
    const { movie: movieData, watchCount, lastWatchedAt } = movie;
    const poster = tmdbImage(movieData.posterPath, "w500");
    const [imgError, setImgError] = useState(false);

    // Format last watched date
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

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
                to={`/movies/${movieData.id}`}
                className="no-underline block"
            >
                <motion.div
                    whileHover={{
                        y: -3,
                        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                    }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-lg shadow-black/10 cursor-pointer"
                >
                    {/* Poster — 2:3 aspect ratio */}
                    <div className="relative aspect-[2/3] bg-[var(--color-surface-3)]">
                        {poster && !imgError ? (
                            <img
                                src={poster}
                                alt={movieData.title}
                                onError={() => setImgError(true)}
                                className="w-full h-full object-cover block"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Film
                                    size={32}
                                    className="text-[var(--color-text-muted)] opacity-30"
                                />
                            </div>
                        )}

                        {/* Watch count badge */}
                        <div
                            style={{
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                background: "rgba(0,0,0,0.7)",
                                borderRadius: "999px",
                                padding: "3px 8px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11px",
                                color:
                                    watchCount > 0
                                        ? "var(--color-watched)"
                                        : "var(--color-text-muted)",
                                backdropFilter: "blur(4px)",
                            }}
                        >
                            {watchCount > 0
                                ? t("movies.watchedNTimes", { count: watchCount })
                                : t("movies.notWatched")}
                        </div>
                    </div>

                    {/* Info section */}
                    <div className="p-[12px_14px_14px]">
                        {/* Title */}
                        <h3
                            className="truncate text-[13px] font-semibold text-[var(--color-text)] tracking-tight leading-tight mb-1"
                            title={movieData.title}
                        >
                            {movieData.title}
                        </h3>

                        {/* Release date */}
                        {movieData.releaseDate && (
                            <div className="flex items-center gap-1.5 mb-3">
                                <span className="text-[11px] text-[var(--color-text-muted)]">
                                    {new Date(
                                        movieData.releaseDate,
                                    ).getFullYear()}
                                </span>
                            </div>
                        )}

                        {/* Last watched date */}
                        {lastWatchedAt && (
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                                <span className="text-[11px] text-[var(--color-text-muted)]">
                                    {t("movies.lastWatched")}
                                </span>
                                <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                                    {formatDate(lastWatchedAt)}
                                </span>
                            </div>
                        )}
                    </div>
                </motion.div>
            </Link>
        </motion.div>
    );
}
