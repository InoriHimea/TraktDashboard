import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import { resolveEpisodeTitle } from "../lib/i18n";
import { resolveEpisodeStill } from "../lib/image";
import { EpisodePlaceholder } from "./ui/EpisodePlaceholder";
import type { EpisodeProgress } from "@trakt-dashboard/types";

interface EpisodeSeasonStripProps {
    episodes: EpisodeProgress[];
    seasonNumber: number;
    currentEpisodeNumber: number;
    showId: number;
    watched: boolean;
}

export function EpisodeSeasonStrip({
    episodes,
    seasonNumber,
    currentEpisodeNumber,
    showId,
    watched,
}: EpisodeSeasonStripProps) {
    const navigate = useNavigate();
    const currentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentRef.current) {
            currentRef.current.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
            });
        }
    }, [currentEpisodeNumber]);

    const seasonLabel =
        seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 text-white">
                    SEASONS / SPECIALS
                    <span className="w-12 h-0.5 bg-white/10" />
                </h2>
                {/* VIEW ALL — only in unwatched/grid mode */}
                {!watched && (
                    <button
                        className="text-[#ff8aa8] text-xs font-bold tracking-widest uppercase flex items-center gap-2 hover:translate-x-1 transition-transform cursor-pointer"
                        onClick={() => navigate(`/shows/${showId}`)}
                    >
                        VIEW ALL <ArrowRight className="size-3.5" />
                    </button>
                )}
            </div>

            {/* Episode list — conditional layout */}
            {watched ? (
                /* Horizontal scroll (watched state) */
                <div className="flex overflow-x-auto gap-6 pb-6 episode-scrollbar scroll-smooth">
                    {episodes.map((ep) => {
                        const isCurrent = ep.episodeNumber === currentEpisodeNumber;
                        const isUnaired = ep.aired === false;
                        return (
                            <EpisodeThumbnail
                                key={ep.episodeId}
                                episode={ep}
                                seasonNumber={seasonNumber}
                                showId={showId}
                                isCurrent={isCurrent}
                                isUnaired={isUnaired}
                                className="flex-none w-[280px]"
                                ref={isCurrent ? currentRef : null}
                                onNavigate={(s, e) =>
                                    navigate(`/shows/${showId}/seasons/${s}/episodes/${e}`)
                                }
                            />
                        );
                    })}
                </div>
            ) : (
                /* Responsive grid (unwatched state) */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {episodes.map((ep) => {
                        const isCurrent = ep.episodeNumber === currentEpisodeNumber;
                        const isUnaired = ep.aired === false;
                        return (
                            <EpisodeThumbnail
                                key={ep.episodeId}
                                episode={ep}
                                seasonNumber={seasonNumber}
                                showId={showId}
                                isCurrent={isCurrent}
                                isUnaired={isUnaired}
                                ref={isCurrent ? currentRef : null}
                                onNavigate={(s, e) =>
                                    navigate(`/shows/${showId}/seasons/${s}/episodes/${e}`)
                                }
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Episode Thumbnail ────────────────────────────────────────────────────────

interface EpisodeThumbnailProps {
    episode: EpisodeProgress;
    seasonNumber: number;
    showId: number;
    isCurrent: boolean;
    isUnaired: boolean;
    className?: string;
    onNavigate: (season: number, episode: number) => void;
}

const EpisodeThumbnail = React.forwardRef<
    HTMLDivElement,
    EpisodeThumbnailProps
>(({ episode, seasonNumber, isCurrent, isUnaired, className, onNavigate }, ref) => {
    const [imgError, setImgError] = useState(false);

    const title = resolveEpisodeTitle(episode);
    const stillUrl = resolveEpisodeStill(episode.stillPath);
    const showImg = stillUrl && !imgError;
    const epCode = `S${String(seasonNumber).padStart(2, "0")} · E${String(episode.episodeNumber).padStart(2, "0")}`;

    return (
        <div
            ref={ref}
            className={cn(
                "group cursor-pointer",
                isUnaired && "opacity-50 cursor-default",
                className
            )}
            onClick={() => !isUnaired && onNavigate(seasonNumber, episode.episodeNumber)}
            aria-current={isCurrent ? "true" : undefined}
            aria-label={`${epCode} ${title}`}
        >
            {/* Thumbnail */}
            <div
                className={cn(
                    "relative aspect-video rounded-xl overflow-hidden mb-3 bg-zinc-900 shadow-xl",
                    isCurrent
                        ? "ring-2 ring-[#ff8aa8] ring-offset-4 ring-offset-[#050505]"
                        : "border border-white/5"
                )}
            >
                {showImg ? (
                    <img
                        src={stillUrl}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <EpisodePlaceholder
                        seasonNumber={seasonNumber}
                        episodeNumber={episode.episodeNumber}
                    />
                )}

                {/* Duration badge */}
                {episode.runtime && (
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white">
                        {episode.runtime}m
                    </div>
                )}

                {/* Current episode overlay tint */}
                {isCurrent && (
                    <div className="absolute inset-0 bg-[#ff8aa8]/10 mix-blend-overlay pointer-events-none" />
                )}

                {/* Unaired overlay */}
                {isUnaired && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <span className="text-[9px] font-bold tracking-[0.08em] px-2 py-0.5 rounded bg-black/70 border border-white/10 text-white/50 uppercase">
                            未播出
                        </span>
                    </div>
                )}
            </div>

            {/* Title */}
            <div>
                <h3
                    className={cn(
                        "font-bold text-sm truncate",
                        isCurrent
                            ? "text-[#ff8aa8]"
                            : "text-white group-hover:text-[#ff8aa8] transition-colors"
                    )}
                >
                    {title || `Episode ${episode.episodeNumber}`}
                </h3>
                <p className="text-xs text-zinc-500 tracking-wider mt-1">
                    {epCode}
                </p>
            </div>
        </div>
    );
});

EpisodeThumbnail.displayName = "EpisodeThumbnail";
