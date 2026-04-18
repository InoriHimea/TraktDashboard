import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Search, ImageOff } from "lucide-react";
import { useEpisodeDetail } from "../hooks";
import { EpisodeInfoCard } from "../components/EpisodeInfoCard";
import { EpisodeSeasonStrip } from "../components/EpisodeSeasonStrip";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { resolveEpisodeStillLarge } from "../lib/image";

function EpisodeDetailSkeleton() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="w-full h-14 border-b border-border" />
            <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full mt-8 flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-[40%] aspect-video bg-muted animate-pulse rounded-2xl" />
                <div className="w-full md:w-[60%] h-40 bg-muted animate-pulse rounded-2xl" />
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

    return (
        <div className="min-h-screen bg-background text-foreground pb-24 md:pb-12 overflow-x-hidden">
            {/* 顶部导航 */}
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 h-14 flex items-center">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="size-5" />
                        <span className="text-sm font-medium">返回</span>
                    </button>
                </div>
            </header>

            {/* 上半部分：受约束的剧集详情（有左右边距） */}
            <main className="max-w-7xl mx-auto px-6 lg:px-12 pt-10 flex flex-col md:flex-row gap-10 items-start">
                
                {/* 左侧：固定宽度的截图容器 */}
                <div className="w-full md:w-[45%] lg:w-[40%] shrink-0 flex flex-col relative group">
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-muted shadow-xl border border-border/50 relative">
                        {stillUrl ? (
                            <img 
                                src={stillUrl} 
                                alt={data.title || "Episode still"} 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted">
                                <ImageOff className="size-12 opacity-30 text-muted-foreground" />
                                <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-30 text-muted-foreground">
                                    No Image
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧：剧集信息，自适应剩余空间 */}
                <div className="w-full md:flex-1 flex flex-col justify-center">
                    <EpisodeInfoCard 
                        data={data} 
                        onHistoryClick={() => setHistoryPanelOpen(true)} 
                    />
                </div>
            </main>

            {/* 下半部分：挣脱容器，全宽度的剧集滚动条 */}
            <section className="w-full mt-16 pt-10 border-t border-border bg-muted/20">
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
            <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-6 pb-6 pt-3 md:hidden bg-background/90 backdrop-blur-lg z-50 border-t border-border shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                <button onClick={() => navigate('/progress')} className="flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                    <Home className="size-5" />
                    <span className="text-[10px] uppercase tracking-widest mt-1">Home</span>
                </button>
                <button className="flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                    <Search className="size-5" />
                    <span className="text-[10px] uppercase tracking-widest mt-1">Search</span>
                </button>
            </nav>
        </div>
    );
}