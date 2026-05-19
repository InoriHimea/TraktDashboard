import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import { resolveEpisodeStill } from "../lib/image";
import { resolveEpisodeTitle } from "../lib/i18n";
import { EpisodePlaceholder } from "./ui/EpisodePlaceholder";
import type { EpisodeProgress } from "@trakt-dashboard/types";

interface EpisodeSeasonStripProps {
    episodes: EpisodeProgress[];
    seasonNumber: number;
    currentEpisodeNumber: number;
    showId?: number | string;
    watched: boolean;
    fallbackImageUrl?: string | null;
}

export function EpisodeSeasonStrip({
    episodes,
    seasonNumber,
    currentEpisodeNumber,
    showId,
    watched,
    fallbackImageUrl,
}: EpisodeSeasonStripProps) {
    const currentRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (watched && currentRef.current) {
            currentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }, [currentEpisodeNumber, watched]);

    const seasonLabel = seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;

    return (
        <div className="flex w-full flex-col pb-12">
            <div className="mb-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        {seasonLabel}
                    </h2>
                    <div className="h-0.5 w-12 bg-foreground/10" />
                </div>
                {!watched && (
                    <button className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)] transition-transform hover:translate-x-1">
                        View all
                        <ArrowRight size={14} />
                    </button>
                )}
            </div>

            <div
                className={cn(
                    watched
                        ? "episode-scrollbar flex gap-6 overflow-x-auto pb-6 scroll-smooth"
                        : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4",
                )}
            >
                {episodes.map((episode) => {
                    const isCurrent = Number(episode.episodeNumber) === Number(currentEpisodeNumber);
                    const stillUrl = resolveEpisodeStill(episode.stillPath);
                    const thumbUrl = stillUrl ?? fallbackImageUrl ?? null;

                    return (
                        <div
                            key={episode.episodeNumber}
                            ref={isCurrent ? currentRef : null}
                            onClick={() => navigate(`/shows/${showId}/seasons/${seasonNumber}/episodes/${episode.episodeNumber}`)}
                            className={cn(
                                "group cursor-pointer",
                                watched && "flex-none w-[280px]",
                                !episode.aired && "opacity-60",
                            )}
                        >
                            <div
                                className={cn(
                                    "relative mb-3 aspect-video overflow-hidden rounded-xl bg-zinc-900 shadow-xl",
                                    isCurrent
                                        ? "ring-2 ring-[var(--color-accent)] ring-offset-4 ring-offset-[var(--color-bg)]"
                                        : "border border-white/5",
                                )}
                            >
                                {thumbUrl ? (
                                    <img
                                        src={thumbUrl}
                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        alt=""
                                    />
                                ) : (
                                    <EpisodePlaceholder
                                        seasonNumber={seasonNumber}
                                        episodeNumber={episode.episodeNumber}
                                    />
                                )}
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                {isCurrent && <div className="absolute inset-0 bg-[var(--color-accent)]/10 mix-blend-overlay" />}
                                {episode.runtime && (
                                    <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                                        {episode.runtime}分钟
                                    </div>
                                )}
                            </div>
                            <div className="px-1">
                                <h3
                                    className={cn(
                                        "truncate text-sm font-bold transition-colors",
                                        isCurrent
                                            ? "text-[var(--color-accent)]"
                                            : "text-foreground group-hover:text-[var(--color-accent)]",
                                    )}
                                >
                                    {resolveEpisodeTitle(episode)}
                                </h3>
                                <span className="mt-1 block text-xs tracking-wider text-muted-foreground/60">
                                    S{String(seasonNumber).padStart(2, "0")} · E{String(episode.episodeNumber).padStart(2, "0")}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
