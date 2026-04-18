import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Home, Search, Play, Check } from "lucide-react";
import { useEpisodeDetail } from "../hooks";
import { EpisodeInfoCard } from "../components/EpisodeInfoCard";
import { EpisodeSeasonStrip } from "../components/EpisodeSeasonStrip";
import { WatchActionPanel } from "../components/WatchActionPanel";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { resolveEpisodeStill, resolveEpisodeStillLarge } from "../lib/image";

function EpisodeDetailSkeleton() {
    return (
        <div className="min-h-screen bg-[#050505]">
            <div className="h-[80vh] bg-white/5 animate-pulse" />
            <div className="max-w-7xl mx-auto px-8 mt-12">
                <div className="w-full h-56 rounded-2xl bg-white/5 animate-pulse" />
            </div>
        </div>
    );
}

function PageError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex-1 flex items-center justify-center min-h-screen bg-[#050505]">
            <div className="flex flex-col items-center gap-4">
                <p className="text-zinc-400 text-sm">加载失败</p>
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition-all cursor-pointer"
                >
                    <RefreshCw className="size-3.5" />
                    重试
                </button>
            </div>
        </div>
    );
}

export default function EpisodeDetailPage() {
    const { showId, season, episode } = useParams();
    const navigate = useNavigate();

    const showIdNum = Number(showId);
    const seasonNum = Number(season);
    const episodeNum = Number(episode);

    const isValidParams =
        !!showId && !!season && !!episode &&
        Number.isInteger(showIdNum) && Number.isInteger(seasonNum) && Number.isInteger(episodeNum) &&
        showIdNum > 0 && seasonNum >= 0 && episodeNum > 0;

    const { data, isLoading, error, refetch } = useEpisodeDetail(
        isValidParams ? showIdNum : 0,
        isValidParams ? seasonNum : 0,
        isValidParams ? episodeNum : 0,
    );
    const [watchPanelOpen, setWatchPanelOpen] = useState(false);
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

    if (!isValidParams) return <Navigate to="/progress" replace />;
    if (isLoading) return <EpisodeDetailSkeleton />;
    if (error) return <PageError onRetry={() => refetch()} />;
    if (!data) return (
        <div className="flex-1 flex items-center justify-center min-h-screen bg-[#050505] text-zinc-400 text-sm">
            未找到该集
        </div>
    );

    const stillUrl = resolveEpisodeStill(data.stillPath);
    const backdropUrl = resolveEpisodeStillLarge(data.stillPath);

    return (
        <div className="pb-24 md:pb-12 bg-[#050505] text-white">

            {/* ── Hero Section ── */}
            <section
                className="relative w-full overflow-hidden bg-[#0a0a14]"
                style={{ height: "calc(100vh - 56px)", minHeight: "520px" }}
            >
                {/* Background: blurred still */}
                <div className="absolute inset-0 z-0">
                    {backdropUrl ? (
                        <img
                            src={backdropUrl}
                            alt=""
                            className="w-full h-full object-cover scale-105 blur-sm brightness-[0.4]"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e]" />
                    )}
                    {/* Bottom fade to page bg */}
                    <div className="absolute inset-0 hero-gradient" />
                </div>

                {/* Back button — floating top-left */}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-6 left-12 md:left-16 z-20 flex items-center gap-1.5 text-xs font-medium text-white/65 bg-white/10 border border-white/15 rounded-lg px-3.5 py-1.5 backdrop-blur-md hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                    <ArrowLeft className="size-3.5" />
                    返回
                </button>

                {/* Hero content — fills full height, content pinned to bottom */}
                <div className="absolute inset-0 z-10 flex items-end">
                    <div className="w-full max-w-7xl mx-auto px-12 md:px-16 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
                        {/* Left: Episode thumbnail — desktop only */}
                        {stillUrl && (
                            <div className="hidden lg:flex lg:col-span-4 items-end group relative">
                                <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02] relative">
                                    <img
                                        src={stillUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                    {data.watched && (
                                        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
                                            <Check className="size-4 text-purple-600" strokeWidth={2.5} />
                                            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Watched</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Play className="size-16 text-white fill-white" />
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Right: Episode info */}
                        <div className="lg:col-span-8">
                            <EpisodeInfoCard
                                data={data}
                                onWatchClick={() => setWatchPanelOpen(true)}
                                onHistoryClick={() => setHistoryPanelOpen(true)}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Episodes Section ── */}
            <section className="max-w-7xl mx-auto px-12 md:px-16 mt-14 mb-24">
                <EpisodeSeasonStrip
                    episodes={data.seasonEpisodes}
                    seasonNumber={data.seasonNumber}
                    currentEpisodeNumber={data.episodeNumber}
                    showId={data.showId}
                    watched={data.watched}
                />
            </section>

            <WatchActionPanel
                open={watchPanelOpen}
                onClose={() => setWatchPanelOpen(false)}
                episodeId={data.episodeId}
                showId={data.showId}
                seasonNumber={data.seasonNumber}
                episodeNumber={data.episodeNumber}
                airDate={data.airDate}
                onSuccess={() => refetch()}
            />
            <WatchHistoryPanel
                open={historyPanelOpen}
                onClose={() => setHistoryPanelOpen(false)}
                showId={data.showId}
                seasonNumber={data.seasonNumber}
                episodeNumber={data.episodeNumber}
                onDeleted={() => refetch()}
            />

            {/* ── Mobile Bottom Nav ── */}
            <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-6 pb-6 pt-3 md:hidden bg-[#050505]/90 backdrop-blur-lg z-50 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,1)] border-t border-white/5">
                <button
                    onClick={() => navigate('/progress')}
                    className="flex flex-col items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                    <Home className="size-5" />
                    <span className="text-[10px] uppercase tracking-widest mt-1">Home</span>
                </button>
                <button className="flex flex-col items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer">
                    <Search className="size-5" />
                    <span className="text-[10px] uppercase tracking-widest mt-1">Search</span>
                </button>
            </nav>
        </div>
    );
}
