import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Search, ImageOff } from "lucide-react";
import { useEpisodeDetail } from "../hooks";
import { EpisodeInfoCard } from "../components/EpisodeInfoCard";
import { EpisodeSeasonStrip } from "../components/EpisodeSeasonStrip";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { resolveEpisodeStillLarge } from "../lib/image";

// 补回 Skeleton 组件，适配 Tailwind v4
function EpisodeDetailSkeleton() {
    return (
        <div className="min-h-screen bg-background">
            <div className="h-[60vh] md:h-[40vh] bg-muted animate-pulse" />
            <div className="max-w-7xl mx-auto px-4 md:px-8 mt-12">
                <div className="w-full h-56 rounded-2xl bg-muted animate-pulse" />
            </div>
        </div>
    );
}

// 补回 Error 组件
function PageError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex-1 flex items-center justify-center min-h-screen bg-background text-foreground">
            <div className="flex flex-col items-center gap-4">
                <p className="text-muted-foreground text-sm">加载失败</p>
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                    <span>重试</span>
                </button>
            </div>
        </div>
    );
}

export default function EpisodeDetailPage() {
    const { showId, season, episode } = useParams();
    const navigate = useNavigate();
    
    // 强制转换为 Number，解决 TS 2345 报错
    const { data, isLoading, isError, refetch } = useEpisodeDetail(
        Number(showId), 
        Number(season), 
        Number(episode)
    );
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

    if (isLoading) return <EpisodeDetailSkeleton />;
    if (isError || !data) return <PageError onRetry={() => refetch()} />;

    // 解决引数不可指派报错：resolveEpisodeStillLarge 需要的是 string，传入对应的 path 字段
    const stillUrl = resolveEpisodeStillLarge(data?.stillPath as string);

    return (
        <div className="min-h-screen bg-background text-foreground pb-24 md:pb-12">
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 flex items-center">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="size-5" />
                        <span className="text-sm font-medium">返回</span>
                    </button>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-8 space-y-12">
                <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-5 lg:col-span-4 w-full aspect-video rounded-2xl overflow-hidden bg-muted flex items-center justify-center shadow-lg border border-border">
                        {stillUrl ? (
                            <img 
                                src={stillUrl} 
                                // 添加 fallback 解决类型 null 报错
                                alt={data.title || "Episode still"} 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <ImageOff className="size-10 opacity-50" />
                                <span className="text-xs uppercase tracking-widest opacity-50">No Image</span>
                            </div>
                        )}
                    </div>

                    <div className="md:col-span-7 lg:col-span-8 flex flex-col justify-center space-y-6">
                        <EpisodeInfoCard 
                            data={data} 
                            onHistoryClick={() => setHistoryPanelOpen(true)} 
                        />
                    </div>
                </section>

                <section className="w-full border-t border-border pt-8">
                    <EpisodeSeasonStrip 
                        showId={data.showId}
                        seasonNumber={data.seasonNumber}
                        currentEpisodeNumber={data.episodeNumber}
                        episodes={data.seasonEpisodes || []}
                    />
                </section>
            </main>

            <WatchHistoryPanel
                open={historyPanelOpen}
                onClose={() => setHistoryPanelOpen(false)}
                showId={data.showId}
                seasonNumber={data.seasonNumber}
                episodeNumber={data.episodeNumber}
                onDeleted={() => refetch()}
            />

            <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-6 pb-6 pt-3 md:hidden bg-background/90 backdrop-blur-lg z-50 border-t border-border shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                <button
                    onClick={() => navigate('/progress')}
                    className="flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                    <Home className="size-5" />
                    <span className="text-[10px] uppercase tracking-widest mt-1">Home</span>
                </button>
                <button className="flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer">
                    <Search className="size-5" />
                    <span className="text-[10px] uppercase tracking-widest mt-1">Search</span>
                </button>
            </nav>
        </div>
    );
}