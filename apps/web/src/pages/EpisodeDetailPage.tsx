import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEpisodeDetail } from "../hooks";
import { EpisodeInfoCard } from "../components/EpisodeInfoCard";
import { EpisodeSeasonStrip } from "../components/EpisodeSeasonStrip";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";

export default function EpisodeDetailPage() {
    const { showId, season, episode } = useParams();
    const navigate = useNavigate();
    const { data, isLoading, isError, refetch } = useEpisodeDetail(Number(showId), Number(season), Number(episode));
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

    if (isLoading || isError || !data) return null;

    const isWatched = data.watched;

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
            <main style={containerStyle}>
                <EpisodeInfoCard
                    data={data}
                    isWatched={isWatched}
                    onHistoryClick={() => setHistoryPanelOpen(true)}
                    onRefetch={() => refetch()}
                />
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
