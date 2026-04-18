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
            {/* 1. 标题容器：保持原样居中 */}
            <div className="w-full mb-8" style={{ width: '90%', maxWidth: '1200px', margin: '0 auto' }}>
                <h2 className="text-xl font-black tracking-[0.2em] uppercase text-foreground">
                    {seasonLabel}
                </h2>
            </div>

            {/* 2. 横向滚动条：去除所有 padding，恢复纯净的全宽 (full-bleed) 容器 */}
            <div className="flex gap-6 overflow-x-auto pt-12 pb-10 snap-x snap-mandatory scroll-smooth w-full no-scrollbar">
                
                {/* 注意：在 map 中加入 index 索引 */}
                {episodes.map((episode, index) => {
                    // 判断是否为第一张或最后一张卡片
                    const isFirst = index === 0;
                    const isLast = index === episodes.length - 1;
                    
                    const epCode = `${seasonNumber}x${episode.episodeNumber.toString().padStart(2, '0')}`;
                    const isCurrent = episode.episodeNumber === currentEpisodeNumber;
                    const stillUrl = resolveEpisodeStill(episode.stillPath);

                    return (
                        <div 
                            key={episode.episodeNumber}
                            onClick={() => navigate(`/shows/${showId}/seasons/${seasonNumber}/episodes/${episode.episodeNumber}`)}
                            className="group flex-none w-[280px] md:w-[320px] snap-start flex flex-col gap-4 cursor-pointer"
                            style={{
                                // 核心魔法：只有第一集有左边距，最后一集有右边距！
                                // max(5%, calc(50% - 600px)) 完美复刻上方宽度的数学原理
                                marginLeft: isFirst ? 'max(5%, calc(50% - 600px))' : '0',
                                marginRight: isLast ? 'max(5%, calc(50% - 600px))' : '0'
                            }}
                        >
                            <div className={cn(
                                "relative w-full aspect-video rounded-2xl overflow-hidden bg-muted shadow-lg transition-all",
                                isCurrent ? "border border-purple-500 ring-2 ring-purple-500 ring-offset-4 ring-offset-background" : "border border-border/30 hover:border-foreground/30"
                            )}>
                                {stillUrl ? (
                                    <img 
                                        src={stillUrl} 
                                        alt={episode.title || `Episode ${episode.episodeNumber}`} 
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
                
                {/* 3. 在列表末尾加一个隐形的垫片，防止滑到最右边时贴边（修补 Flexbox 的 Bug） */}
                <div 
                    className="shrink-0" 
                    style={{ width: 'calc((100vw - min(1200px, 90vw)) / 2 - 24px)' }} 
                />
            </div>
        </div>
    );
}