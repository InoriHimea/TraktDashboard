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
    
    // 🌟 核心：计算上方容器的左侧留白宽度
    // 逻辑：(100%屏幕宽度 - (1200px 或 90%屏幕宽度)) / 2
    const sideSpace = 'calc((100vw - min(1200px, 90vw)) / 2)';

    return (
        <div className="flex flex-col w-full pb-12">
            {/* 季度标题 */}
            <div className="w-full mb-8" style={{ width: '90%', maxWidth: '1200px', margin: '0 auto' }}>
                <h2 className="text-xl font-black tracking-[0.2em] uppercase text-foreground">
                    {seasonLabel}
                </h2>
            </div>

            {/* 滚动容器：去掉 padding，确保滚动条背景全宽 */}
            <div className="flex overflow-x-auto pt-4 pb-10 scroll-smooth w-full no-scrollbar">
                
                {/* 🌟 核心对齐垫片：这个隐形 div 会把第一张图片顶到跟上面标题对齐的位置 */}
                <div className="shrink-0" style={{ width: sideSpace }} />

                <div className="flex gap-6">
                    {episodes.map((episode) => {
                        // 修正 isCurrent 变量
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
                                    isCurrent ? "border-2 border-purple-500 ring-4 ring-purple-500/20" : "border border-border/30 hover:border-foreground/30"
                                )}>
                                    {stillUrl ? (
                                        <img src={stillUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                                            <ImageOff className="size-10 opacity-20 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="px-2 mt-1 flex flex-col gap-1.5">
                                    <h3 className={cn("font-black text-base truncate", isCurrent ? "text-purple-500" : "text-foreground group-hover:text-purple-500 transition-colors")}>
                                        <span className="text-muted-foreground/60 font-bold mr-3">{epCode}</span>
                                        {episode.title || `Episode ${episode.episodeNumber}`}
                                    </h3>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 右侧垫片：确保滑到最后也不贴边 */}
                <div className="shrink-0" style={{ width: sideSpace }} />
            </div>
        </div>
    );
}