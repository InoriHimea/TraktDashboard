import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Search, ImageOff, Check } from "lucide-react";
import { useEpisodeDetail } from "../hooks";
import { EpisodeInfoCard } from "../components/EpisodeInfoCard";
import { EpisodeSeasonStrip } from "../components/EpisodeSeasonStrip";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { resolveEpisodeStillLarge } from "../lib/image";

function EpisodeDetailSkeleton() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="w-full h-14 border-b border-border/50" />
            <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 w-full mt-8 flex flex-col md:flex-row gap-6 lg:gap-10">
                <div className="w-full md:w-[320px] lg:w-[400px] aspect-video bg-muted animate-pulse rounded-xl" />
                <div className="w-full md:flex-1 h-64 bg-muted animate-pulse rounded-xl" />
            </div>
        </div>
    );
}

function PageError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex-1 flex items-center justify-center min-h-screen bg-background text-foreground">
            <div className="flex flex-col items-center gap-4">
                <p className="text-muted-foreground">加载失败</p>
                <button onClick={onRetry} className="bg-muted px-4 py-2 rounded-lg hover:bg-muted/80">重试</button>
            </div>
        </div>
    );
}

export default function EpisodeDetailPage() {
    const { showId, season, episode } = useParams();
    const navigate = useNavigate();
    
    const { data, isLoading, isError, refetch } = useEpisodeDetail(
        Number(showId), 
        Number(season), 
        Number(episode)
    );
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

    if (isLoading) return <EpisodeDetailSkeleton />;
    if (isError || !data) return <PageError onRetry={() => refetch()} />;

    const stillUrl = resolveEpisodeStillLarge(data?.stillPath as string);
    // 假设你有已看状态，这里用 mock 值，如果是根据数据来，请替换
    const isWatched = true; 

    return (
        <div className="min-h-screen bg-background text-foreground pb-24 md:pb-12 overflow-x-hidden">
            {/* 顶部返回导航 */}
            <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/40">
                <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 h-14 flex items-center">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="size-5" />
                        <span className="text-sm font-bold">返回</span>
                    </button>
                </div>
            </header>

            {/* 主内容区：完全对齐 Trakt 的 trakt-summary-container 布局 */}
            <main className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 pt-8 flex flex-col md:flex-row gap-6 lg:gap-10 items-start">
                
                {/* 1. trakt-summary-poster-container (左侧海报区) */}
                <div className="w-full md:w-[320px] lg:w-[400px] shrink-0 relative group">
                    <div className="w-full aspect-video rounded-xl overflow-hidden bg-muted shadow-lg border border-border/30 relative">
                        {stillUrl ? (
                            <img 
                                src={stillUrl} 
                                alt={data.title || "Episode still"} 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/50">
                                <ImageOff className="size-10 opacity-30 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    
                    {/* 左上角悬浮 Watched 标签 (按照 HTML 还原紫色 stem-tag) */}
                    {isWatched && (
                        <div className="absolute -top-3 -left-2 bg-background border border-border rounded-lg shadow-md flex items-center gap-1.5 px-3 py-1.5 z-10">
                            <Check className="size-4 text-purple-500" strokeWidth={3} />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">Watched</span>
                        </div>
                    )}
                </div>

                {/* 2. trakt-summary-content (右侧内容区) */}
                <div className="w-full md:flex-1 flex flex-col min-w-0">
                    <EpisodeInfoCard 
                        data={data} 
                        onHistoryClick={() => setHistoryPanelOpen(true)}
                    />
                </div>
            </main>

            {/* 剧集列表条 */}
            <section className="w-full mt-12 pt-10 border-t border-border/40 bg-muted/10">
                <EpisodeSeasonStrip 
                    showId={data.showId}
                    seasonNumber={data.seasonNumber}
                    currentEpisodeNumber={data.episodeNumber}
                    episodes={data.seasonEpisodes || []}
                />
            </section>

            <WatchHistoryPanel
                open={historyPanelOpen}
                onClose={() => setHistoryPanelOpen(false)}
                showId={data.showId}
                seasonNumber={data.seasonNumber}
                episodeNumber={data.episodeNumber}
                onDeleted={() => refetch()}
            />

            {/* 移动端底部导航 */}
            <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-6 pb-6 pt-3 md:hidden bg-background/95 backdrop-blur-lg z-50 border-t border-border/40 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                <button onClick={() => navigate('/progress')} className="flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                    <Home className="size-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Home</span>
                </button>
                <button className="flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                    <Search className="size-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Search</span>
                </button>
            </nav>
        </div>
    );
}