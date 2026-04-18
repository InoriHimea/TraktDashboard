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
    currentEpisodeNumber
}: EpisodeSeasonStripProps) {
    const currentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentRef.current) {
            currentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }, [currentEpisodeNumber]);

    const seasonLabel = seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;

    return (
        <div className="flex flex-col w-full">
            {/* 标题区域：保持与主内容对齐的边距 */}
            <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full mb-6">
                <h2 className="text-xl font-extrabold tracking-widest uppercase text-foreground/80">
                    {seasonLabel}
                </h2>
            </div>

            {/* 滚动区域：不限制宽度，直接撑满屏幕，靠内边距对齐首项 */}
            <div className="flex gap-5 overflow-x-auto px-6 lg:px-12 pb-8 snap-x snap-mandatory scroll-smooth w-full no-scrollbar">
                {episodes.map((episode: EpisodeProgress) => {
                    const isCurrent = episode.episodeNumber === currentEpisodeNumber;
                    const stillUrl = episode.stillPath; 

                    return (
                        <div 
                            key={episode.episodeNumber}
                            ref={isCurrent ? currentRef : null}
                            className="group flex-none w-[260px] md:w-[280px] snap-start flex flex-col gap-3 cursor-pointer"
                        >
                            {/* 卡片缩略图 */}
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
                                
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md tracking-wider">
                                    EP {episode.episodeNumber}
                                </div>
                            </div>

                            {/* 卡片文字信息 */}
                            <div className="px-1">
                                <h3 className={cn(
                                    "font-bold text-sm truncate",
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