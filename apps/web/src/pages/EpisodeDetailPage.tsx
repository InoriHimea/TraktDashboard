import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { useEpisodeDetail } from "../hooks";
import { EpisodeInfoCard } from "../components/EpisodeInfoCard";
import { EpisodeSeasonStrip } from "../components/EpisodeSeasonStrip";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { EpisodePlaceholder } from "../components/ui/EpisodePlaceholder";
import { resolveEpisodeStillLarge, resolveBackdropFallback } from "../lib/image";

export default function EpisodeDetailPage() {
    const { showId, season, episode } = useParams();
    const navigate = useNavigate();
    const { data, isLoading, isError, refetch } = useEpisodeDetail(Number(showId), Number(season), Number(episode));
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

    if (isLoading || isError || !data) return null;

    const isWatched = data.watched;
    const stillUrl = resolveEpisodeStillLarge(data.stillPath);
    const fallbackUrl = resolveBackdropFallback(data.show.backdropPath);
    const heroImageUrl = stillUrl ?? fallbackUrl;

    const containerStyle = { width: '94%', maxWidth: '1440px', margin: '0 auto' };

    return (
        <div className="min-h-screen w-full bg-background text-foreground pb-32 md:pb-20 flex flex-col gap-8 md:gap-12 overflow-x-hidden">
            {/* 顶部导航 */}
            <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/40 h-16 flex items-center shrink-0 w-full">
                <div style={containerStyle}>
                    {/* 返回按钮：使用 text-foreground/65 确保浅色/深色双端清晰可见 */}
                    <button
                        onClick={() => navigate(-1)}
                        className="group inline-flex items-center gap-2.5 rounded-lg transition-all duration-150 cursor-pointer"
                        style={{
                            padding: '6px 10px 6px 6px',
                            marginLeft: '-6px',
                            color: 'rgba(128,128,128,0.85)',
                            background: 'transparent',
                            border: '1px solid transparent',
                        }}
                        onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.color = 'var(--foreground)';
                            el.style.background = 'rgba(128,128,128,0.10)';
                            el.style.borderColor = 'rgba(128,128,128,0.20)';
                        }}
                        onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.color = 'rgba(128,128,128,0.85)';
                            el.style.background = 'transparent';
                            el.style.borderColor = 'transparent';
                        }}
                    >
                        <ArrowLeft className="size-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
                        <span className="text-xs font-bold uppercase tracking-widest">Back</span>
                    </button>
                </div>
            </header>

            {/* 主内容区：左图 + 右侧信息 */}
            <main
                className="w-full mx-auto flex flex-col md:flex-row items-center"
                style={{ width: '94%', maxWidth: '1440px', margin: '0 auto', gap: '48px' }}
            >
                {/* 左侧：剧集截图 */}
                <div className="w-full md:w-[380px] lg:w-[460px] shrink-0 flex items-center justify-center">
                    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-border/30 relative">
                        {heroImageUrl ? (
                            <img src={heroImageUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <EpisodePlaceholder
                                seasonNumber={data.seasonNumber}
                                episodeNumber={data.episodeNumber}
                            />
                        )}
                        
                        {/* 底部渐变 - 与 EpisodeGrid 一致 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

                        {/* Watched 标签：底部居中 */}
                        {isWatched && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-2 px-4 py-1.5 z-10 shadow-xl">
                                <Check className="size-4 text-purple-400" strokeWidth={4} />
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white">Watched</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧：信息卡 */}
                <div className="flex-1 flex flex-col justify-center min-w-0" style={{ margin: '20px 0' }}>
                    <EpisodeInfoCard
                        data={data}
                        isWatched={isWatched}
                        onHistoryClick={() => setHistoryPanelOpen(true)}
                        onRefetch={() => refetch()}
                    />
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
                    fallbackImageUrl={fallbackUrl}
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
        </div>
    );
}