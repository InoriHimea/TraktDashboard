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
            <div className="w-full h-16 border-b border-border/40" />
            <div className="max-w-[1600px] mx-auto px-8 md:px-16 lg:px-24 w-full mt-16 flex flex-col md:flex-row gap-12 lg:gap-24">
                <div className="w-full md:w-[380px] lg:w-[480px] aspect-video bg-muted animate-pulse rounded-2xl" />
                <div className="w-full md:flex-1 h-80 bg-muted animate-pulse rounded-2xl" />
            </div>
        </div>
    );
}

function PageError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex-1 flex items-center justify-center min-h-screen bg-background text-foreground">
            <div className="flex flex-col items-center gap-6">
                <p className="text-muted-foreground text-lg">加载失败</p>
                <button onClick={onRetry} className="bg-muted px-6 py-3 rounded-xl hover:bg-muted/80 font-bold">重试</button>
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
    const isWatched = true; 

    return (
        <div className="min-h-screen bg-background text-foreground pb-32 md:pb-20 overflow-x-hidden">
            {/* 顶部导航：加宽左右 padding */}
            <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/40 h-16 flex items-center">
                <div className="max-w-[1600px] w-full mx-auto px-8 md:px-16 lg:px-24 flex items-center">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="size-5" />
                        <span className="text-sm font-bold uppercase tracking-wider">Back</span>
                    </button>
                </div>
            </header>

            {/* 主内容区：极致的留白 pt-12 md:pt-20 以及 gap-12 lg:gap-24 */}
            <main className="max-w-[1600px] mx-auto px-8 md:px-16 lg:px-24 pt-12 md:pt-20 flex flex-col md:flex-row gap-12 lg:gap-24 items-start">
                
                {/* 左侧海报区 — group 必须写在这里，Tailwind v4 @apply 不支持 variant 标记类 */}
                <div className="w-full md:w-[380px] lg:w-[480px] shrink-0 relative group">
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-muted shadow-2xl border border-border/30 relative">
                        {stillUrl ? (
                            <img 
                                src={stillUrl} 
                                alt={data.title || "Episode still"} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/50">
                                <ImageOff className="size-12 opacity-20 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    
                    {/* Watched 标签 */}
                    {isWatched && (
                        <div className="absolute -top-4 -left-3 bg-background border border-border rounded-xl shadow-xl flex items-center gap-2 px-4 py-2 z-10">
                            <Check className="size-5 text-purple-500" strokeWidth={3} />
                            <span className="text-xs font-extrabold uppercase tracking-widest text-foreground">Watched</span>
                        </div>
                    )}
                </div>

                {/* 右侧内容区 */}
                <div className="w-full md:flex-1 flex flex-col min-w-0 pt-2 md:pt-0">
                    <EpisodeInfoCard 
                        data={data} 
                        isWatched={isWatched}
                        onHistoryClick={() => setHistoryPanelOpen(true)}
                    />
                </div>
            </main>

            {/* 剧集列表条：顶部拉开 margin (mt-20 pt-16) */}
            <section className="w-full mt-20 pt-16 border-t border-border/40 bg-muted/5">
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

            <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-8 pb-8 pt-4 md:hidden bg-background/95 backdrop-blur-xl z-50 border-t border-border/40 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)]">
                <button onClick={() => navigate('/progress')} className="flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                    <Home className="size-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest mt-1.5">Home</span>
                </button>
                <button className="flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                    <Search className="size-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest mt-1.5">Search</span>
                </button>
            </nav>
        </div>
    );
}