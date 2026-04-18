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
        <div className="min-h-screen bg-background flex flex-col w-full">
            <div className="w-full h-16 border-b border-border/40" />
            <div className="w-full mx-auto px-12 md:px-20 lg:px-28 mt-16 flex flex-col md:flex-row gap-12" style={{ maxWidth: '1200px' }}>
                <div className="w-full md:w-[320px] lg:w-[420px] aspect-video bg-muted animate-pulse rounded-2xl" />
                <div className="w-full md:flex-1 h-80 bg-muted animate-pulse rounded-2xl" />
            </div>
        </div>
    );
}

function PageError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex-1 flex items-center justify-center min-h-screen bg-background text-foreground w-full">
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
    // 假设这是获取到的观看状态
    const isWatched = true; 

    return (
        // 父容器加上 flex flex-col gap-8 md:gap-12 确保上下大区块(Header/Main/Section)有明显间距
        <div className="min-h-screen w-full bg-background text-foreground pb-32 md:pb-20 flex flex-col gap-8 md:gap-12 overflow-x-hidden">
            
            <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/40 h-16 flex items-center shrink-0 w-full">
                {/* 彻底抛弃 Tailwind 的 px 边距类，直接用原生百分比宽度强制留白 */}
                <div className="flex items-center" style={{ width: '90%', maxWidth: '1200px', margin: '0 auto' }}>
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="size-5" />
                        <span className="text-sm font-bold uppercase tracking-wider">Back</span>
                    </button>
                </div>
            </header>

            {/* 主内容区 */}
            <main 
                className="flex flex-col md:flex-row gap-12 lg:gap-20 items-start overflow-visible"
                style={{ width: '90%', maxWidth: '1200px', margin: '0 auto' }}
            >
                {/* 左侧海报区 */}
                <div className="w-full md:w-[360px] lg:w-[440px] shrink-0 relative group overflow-visible">
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
                    
                    {/* Watched 标签：放在图片底部偏上一点点 */}
                    {isWatched && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-xl shadow-xl flex items-center gap-2 px-4 py-2 z-10">
                            <Check className="size-5 text-purple-500" strokeWidth={3} />
                            <span className="text-xs font-extrabold uppercase tracking-widest text-foreground whitespace-nowrap">Watched</span>
                        </div>
                    )}
                </div>

                {/* 右侧内容区 */}
                <div className="w-full md:flex-1 flex flex-col min-w-0 pt-4 md:pt-0">
                    <EpisodeInfoCard 
                        data={data} 
                        isWatched={isWatched}
                        onHistoryClick={() => setHistoryPanelOpen(true)}
                    />
                </div>
            </main>

            {/* 剧集列表条 */}
            <section className="w-full pt-8 border-t border-border/40 bg-muted/5">
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

            <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-12 pb-8 pt-4 md:hidden bg-background/95 backdrop-blur-xl z-50 border-t border-border/40 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)]">
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