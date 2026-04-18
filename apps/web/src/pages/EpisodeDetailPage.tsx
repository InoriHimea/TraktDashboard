import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Search, ImageOff, Check } from "lucide-react";
import { useEpisodeDetail } from "../hooks";
import { EpisodeInfoCard } from "../components/EpisodeInfoCard";
import { EpisodeSeasonStrip } from "../components/EpisodeSeasonStrip";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { resolveEpisodeStillLarge } from "../lib/image";

export default function EpisodeDetailPage() {
    const { showId, season, episode } = useParams();
    const navigate = useNavigate();
    const { data, isLoading, isError, refetch } = useEpisodeDetail(Number(showId), Number(season), Number(episode));
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

    if (isLoading || isError || !data) return null;

    const stillUrl = resolveEpisodeStillLarge(data?.stillPath as string);
    const isWatched = true; 

    // 定义统一的限宽样式，确保上下绝对对齐
    const containerStyle = { width: '94%', maxWidth: '1440px', margin: '0 auto' };

    return (
        <div className="min-h-screen w-full bg-background text-foreground pb-32 md:pb-20 flex flex-col gap-8 md:gap-12 overflow-x-hidden">
            {/* 顶部导航 */}
            <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/40 h-16 flex items-center shrink-0 w-full">
                <div style={containerStyle}>
                    <button onClick={() => navigate(-1)} className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                        <ArrowLeft className="size-5" />
                        <span className="text-sm font-bold uppercase tracking-wider">Back</span>
                    </button>
                </div>
            </header>

            {/* 主内容区 */}
            <main 
                className="w-full mx-auto flex flex-col md:flex-row items-center" 
                style={{ width: '94%', maxWidth: '1440px', margin: '0 auto', gap: '48px' }}
            >
                {/* 左侧：让图片在容器高度内垂直居中 */}
                <div className="w-full md:w-[380px] lg:w-[460px] shrink-0 flex items-center justify-center">
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-muted shadow-2xl border border-border/30 relative">
                        {stillUrl ? (
                            <img src={stillUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-muted/50"><ImageOff className="size-12 opacity-20" /></div>
                        )}

                        {/* Watched 标签：底部居中 */}
                        {isWatched && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-2 px-4 py-1.5 z-10 shadow-xl">
                                <Check className="size-4 text-purple-400" strokeWidth={4} />
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white">Watched</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧内容：去除错误的 auot 拼写 */}
                <div className="flex-1 flex flex-col justify-center min-w-0" style={{ margin: '20px 0' }}>
                    <EpisodeInfoCard data={data} isWatched={isWatched} onHistoryClick={() => setHistoryPanelOpen(true)} />
                </div>
            </main>

            {/* 剧集列表 */}
            <section
                className="w-full border-t border-border/40 bg-muted/5"
                style={{
                    paddingTop: '3rem',
                    paddingLeft: 'calc((100vw - min(1440px, 94vw)) / 2)',
                    paddingRight: 'calc((100vw - min(1440px, 94vw)) / 2)',
                }}
            >
                <EpisodeSeasonStrip 
                    showId={data.showId} 
                    seasonNumber={data.seasonNumber} 
                    currentEpisodeNumber={data.episodeNumber} 
                    episodes={data.seasonEpisodes || []} 
                />
            </section>

            <WatchHistoryPanel open={historyPanelOpen} onClose={() => setHistoryPanelOpen(false)} showId={data.showId} seasonNumber={data.seasonNumber} episodeNumber={data.episodeNumber} onDeleted={() => refetch()} />
        </div>
    );
}