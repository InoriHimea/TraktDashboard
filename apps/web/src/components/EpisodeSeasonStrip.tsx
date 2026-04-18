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
            {/* 标题对齐主内容的 Padding */}
            <div className="max-w-[1600px] mx-auto px-8 md:px-16 lg:px-24 w-full mb-8">
                <h2 className="text-xl font-black tracking-[0.2em] uppercase text-foreground">
                    {seasonLabel}
                </h2>
            </div>

            {/* 滚动容器也使用一致的起止 Padding，卡片间距拉大到 gap-6 */}
            <div className="flex gap-6 overflow-x-auto px-8 md:px-16 lg:px-24 pt-8 pb-10 snap-x snap-mandatory scroll-smooth w-full no-scrollbar">
                {episodes.map((episode: EpisodeProgress) => {
                    const isCurrent = episode.episodeNumber === currentEpisodeNumber;
                    const stillUrl = resolveEpisodeStill(episode.stillPath as string); 
                    const epCode = `${seasonNumber}x${String(episode.episodeNumber).padStart(2, '0')}`;

                    return (
                        <div 
                            key={episode.episodeNumber}
                            ref={isCurrent ? currentRef : null}
                            onClick={() => navigate(`/shows/${showId}/seasons/${seasonNumber}/episodes/${episode.episodeNumber}`)}
                            className="group flex-none w-[280px] md:w-[320px] snap-start flex flex-col gap-4 cursor-pointer"
                        >
                            <div className={cn(
                                "relative w-full aspect-video rounded-2xl overflow-hidden bg-muted shadow-lg border",
                                isCurrent 
                                    ? "border-purple-500 ring-2 ring-purple-500 ring-offset-4 ring-offset-background" 
                                    : "border-border/30 hover:border-foreground/30 transition-all"
                            )}>
                                {stillUrl ? (
                                    <img 
                                        src={stillUrl} 
                                        alt={`Episode ${episode.episodeNumber}`} 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
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
                                    isCurrent ? "text-purple-500" : "text-foreground group-hover:text-purple-500 transition-colors"
                                )}>
                                    <span className="text-muted-foreground/60 font-bold mr-3">
                                        {epCode}
                                    </span>
                                    {episode.title || `Episode ${episode.episodeNumber}`}
                                </h3>
                                {episode.airDate && (
                                    <p className="text-sm text-muted-foreground/70 font-bold tracking-wide">
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