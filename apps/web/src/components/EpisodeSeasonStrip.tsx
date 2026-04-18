import React, { useEffect, useRef } from "react";
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
        <div className="flex flex-col w-full">
            <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full mb-6">
                <h2 className="text-xl font-extrabold tracking-widest uppercase text-foreground/80">
                    {seasonLabel}
                </h2>
            </div>

            <div className="flex gap-5 overflow-x-auto px-6 lg:px-12 pb-8 snap-x snap-mandatory scroll-smooth w-full no-scrollbar">
                {episodes.map((episode: EpisodeProgress) => {
                    const isCurrent = episode.episodeNumber === currentEpisodeNumber;
                    const stillUrl = resolveEpisodeStill(episode.stillPath as string); 
                    
                    // Trakt 风格的集数标识，如: 1x01
                    const epCode = `${seasonNumber}x${String(episode.episodeNumber).padStart(2, '0')}`;

                    return (
                        <div 
                            key={episode.episodeNumber}
                            ref={isCurrent ? currentRef : null}
                            onClick={() => navigate(`/shows/${showId}/seasons/${seasonNumber}/episodes/${episode.episodeNumber}`)}
                            className="group flex-none w-[260px] md:w-[280px] snap-start flex flex-col gap-3 cursor-pointer"
                        >
                            <div className={cn(
                                "relative w-full aspect-video rounded-xl overflow-hidden bg-background shadow-md border",
                                isCurrent 
                                    ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" 
                                    : "border-border/50 hover:border-foreground/30 transition-all"
                            )}>
                                {stillUrl ? (
                                    <img 
                                        src={stillUrl} 
                                        alt={`Episode ${episode.episodeNumber}`} 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                                        <ImageOff className="size-8 text-muted-foreground/30" />
                                    </div>
                                )}
                            </div>

                            {/* 标题部分加入 Trakt 的 1x01 标识 */}
                            <div className="px-1 mt-1 flex flex-col gap-1">
                                <h3 className={cn(
                                    "font-bold text-sm truncate",
                                    isCurrent ? "text-primary" : "text-foreground group-hover:text-primary transition-colors"
                                )}>
                                    <span className="text-muted-foreground font-normal mr-2">
                                        {epCode}
                                    </span>
                                    {episode.title || `Episode ${episode.episodeNumber}`}
                                </h3>
                                {/* 选填：如果有对应数据可以展示播出日期 */}
                                {episode.airDate && (
                                    <p className="text-xs text-muted-foreground/70 font-medium">
                                        {new Date(episode.airDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}