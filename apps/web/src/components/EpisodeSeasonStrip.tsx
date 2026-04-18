import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { cn } from "../lib/utils";
import { resolveEpisodeStill } from "../lib/image";
import type { EpisodeProgress } from "@trakt-dashboard/types";

interface EpisodeSeasonStripProps {
    episodes: EpisodeProgress[];
    seasonNumber: number;
    currentEpisodeNumber: number;
    showId?: number | string;
}

export function EpisodeSeasonStrip({
    episodes,
    seasonNumber,
    currentEpisodeNumber,
    showId
}: EpisodeSeasonStripProps) {
    const currentRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (currentRef.current) {
            currentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }, [currentEpisodeNumber]);

    const seasonLabel = seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;

    return (
        <div className="flex flex-col w-full pb-12">
            {/* 面包屑标题 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '24px' }}>
                <span className="text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer">
                    Season
                </span>
                <span className="text-muted-foreground/30 font-black">/</span>
                <span className="text-foreground">
                    {seasonLabel}
                </span>
            </div>

            {/* 横向滚动 — 负 margin-top + 正 padding-top 防止 ring 被 overflow 裁切 */}
            <div
                className="flex overflow-x-auto pb-6 scroll-smooth"
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--border, #333) transparent',
                    marginTop: '-8px',
                    paddingTop: '8px',
                }}
            >
                <div className="flex gap-6">
                    {episodes.map((episode) => {
                        const isCurrent = Number(episode.episodeNumber) === Number(currentEpisodeNumber);
                        const epCode = `${seasonNumber}x${episode.episodeNumber.toString().padStart(2, '0')}`;
                        const stillUrl = resolveEpisodeStill(episode.stillPath);

                        return (
                            <div
                                key={episode.episodeNumber}
                                ref={isCurrent ? currentRef : null}
                                onClick={() => navigate(`/shows/${showId}/seasons/${seasonNumber}/episodes/${episode.episodeNumber}`)}
                                className="group flex-none w-[280px] md:w-[320px] flex flex-col gap-4 cursor-pointer"
                            >
                                <div className={cn(
                                    "relative w-full aspect-video rounded-2xl overflow-hidden bg-muted shadow-lg transition-all",
                                    isCurrent
                                        ? "border-2 border-purple-500 ring-4 ring-purple-500/20"
                                        : "border border-border/30 hover:border-foreground/30"
                                )}>
                                    {stillUrl ? (
                                        <img
                                            src={stillUrl}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            alt=""
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                                            <ImageOff className="size-10 opacity-20 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="px-2 mt-1 flex flex-col gap-1.5">
                                    <h3 className={cn(
                                        "font-black text-base truncate",
                                        isCurrent
                                            ? "text-purple-500"
                                            : "text-foreground group-hover:text-purple-500 transition-colors"
                                    )}>
                                        <span className="text-muted-foreground/60 font-bold mr-3">{epCode}</span>
                                        {episode.title || `Episode ${episode.episodeNumber}`}
                                    </h3>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}