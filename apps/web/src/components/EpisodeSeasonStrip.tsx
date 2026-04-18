import React, { useEffect, useRef } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "../lib/utils";
import type { EpisodeProgress } from "@trakt-dashboard/types";

interface EpisodeSeasonStripProps {
    episodes: EpisodeProgress[];
    seasonNumber: number;
    currentEpisodeNumber: number;
    showId?: number; 
}

export function EpisodeSeasonStrip({ 
    episodes, 
    seasonNumber, 
    currentEpisodeNumber,
    showId 
}: EpisodeSeasonStripProps) {
    const currentRef = useRef<HTMLDivElement>(null);

    // 自动滚动到当前剧集
    useEffect(() => {
        if (currentRef.current) {
            currentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }, [currentEpisodeNumber]);

    const seasonLabel = seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;

    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                {seasonLabel.toUpperCase()}
            </h2>

            {/* 滚动容器 */}
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scroll-smooth w-full no-scrollbar">
                {episodes.map((episode: EpisodeProgress) => {
                    const isCurrent = episode.episodeNumber === currentEpisodeNumber;
                    // 注意：根据你实际的数据结构替换 stillPath
                    const stillUrl = episode.stillPath; 

                    return (
                        <div 
                            key={episode.episodeNumber}
                            ref={isCurrent ? currentRef : null}
                            className="group flex-none w-64 md:w-72 snap-start flex flex-col gap-2 cursor-pointer"
                        >
                            {/* 截图区域 (16:9) */}
                            <div className={cn(
                                "relative w-full aspect-video rounded-xl overflow-hidden bg-muted border",
                                isCurrent ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border hover:border-foreground/50 transition-colors"
                            )}>
                                {stillUrl ? (
                                    <img 
                                        src={stillUrl} 
                                        alt={`Episode ${episode.episodeNumber}`} 
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                        <ImageOff className="size-8 text-muted-foreground/30" />
                                    </div>
                                )}
                                
                                <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-foreground text-xs font-bold px-2 py-1 rounded">
                                    E{episode.episodeNumber}
                                </div>
                            </div>

                            {/* 底部信息 */}
                            <div>
                                <h3 className={cn(
                                    "font-semibold text-sm truncate",
                                    isCurrent ? "text-primary" : "text-foreground group-hover:text-primary transition-colors"
                                )}>
                                    {episode.title || `Episode ${episode.episodeNumber}`}
                                </h3>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}