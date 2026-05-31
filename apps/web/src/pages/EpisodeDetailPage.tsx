import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Check, RefreshCw } from "lucide-react";
import { useEpisodeDetail } from "../hooks";
import { EpisodeInfoCard } from "../components/EpisodeInfoCard";
import { EpisodeSeasonStrip } from "../components/EpisodeSeasonStrip";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { Button } from "../components/ui/Button";
import { EpisodePlaceholder } from "../components/ui/EpisodePlaceholder";
import { Tag } from "../components/ui/Tag";
import { resolveEpisodeStillLarge, resolveBackdropFallback } from "../lib/image";
import { t } from "../lib/i18n";

function EpisodeDetailState({
    message,
    action,
}: {
    message: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
            <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-sm text-muted-foreground">{message}</p>
                {action}
            </div>
        </div>
    );
}

function EpisodeDetailSkeleton() {
    return (
        <div className="min-h-screen bg-background px-[3vw] py-8 text-foreground">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 animate-pulse">
                <div className="h-10 w-24 rounded-lg bg-muted" />
                <div className="flex flex-col gap-12 md:flex-row">
                    <div className="aspect-video w-full rounded-2xl bg-muted md:w-[420px]" />
                    <div className="flex flex-1 flex-col gap-4 py-4">
                        <div className="h-8 w-52 rounded-lg bg-muted" />
                        <div className="h-14 w-3/4 rounded-lg bg-muted" />
                        <div className="h-24 w-full rounded-lg bg-muted/70" />
                    </div>
                </div>
                <div className="h-56 rounded-2xl bg-muted/70" />
            </div>
        </div>
    );
}

export default function EpisodeDetailPage() {
    const { showId, season, episode } = useParams();
    const navigate = useNavigate();
    const parsedShowId = Number(showId);
    const parsedSeason = Number(season);
    const parsedEpisode = Number(episode);
    const validParams =
        Number.isInteger(parsedShowId) &&
        parsedShowId > 0 &&
        Number.isInteger(parsedSeason) &&
        parsedSeason >= 0 &&
        Number.isInteger(parsedEpisode) &&
        parsedEpisode > 0;

    const { data, isLoading, isError, refetch } = useEpisodeDetail(
        validParams ? parsedShowId : 0,
        validParams ? parsedSeason : -1,
        validParams ? parsedEpisode : 0,
    );
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

    if (!validParams) {
        return <Navigate to="/tv-shows" replace />;
    }

    if (isLoading) return <EpisodeDetailSkeleton />;

    if (isError) {
        return (
            <EpisodeDetailState
                message={t("episodeDetail.loadFailed")}
                action={
                    <Button
                        type="button"
                        variant="secondary"
                        color="slate"
                        size="sm"
                        icon={<RefreshCw size={14} />}
                        onClick={() => refetch()}
                    >
                        {t("common.retry")}
                    </Button>
                }
            />
        );
    }

    if (!data) {
        return (
            <EpisodeDetailState
                message={t("episodeDetail.notFound")}
                action={
                    <Button
                        type="button"
                        variant="ghost"
                        color="slate"
                        size="sm"
                        icon={<ArrowLeft size={14} />}
                        onClick={() => navigate(-1)}
                    >
                        {t("common.back")}
                    </Button>
                }
            />
        );
    }

    const isWatched = data.watched;
    const stillUrl = resolveEpisodeStillLarge(data.stillPath);
    const fallbackUrl = resolveBackdropFallback(data.show.backdropPath);
    const heroImageUrl = stillUrl ?? fallbackUrl;

    const containerStyle = { width: "94%", maxWidth: "1440px", margin: "0 auto" };

    return (
        <div className="min-h-screen w-full bg-background text-foreground pb-32 md:pb-20 flex flex-col gap-8 md:gap-12 overflow-x-hidden">
            <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/40 h-16 flex items-center shrink-0 w-full">
                <div style={containerStyle}>
                    <Button
                        type="button"
                        variant="ghost"
                        color="slate"
                        size="sm"
                        icon={<ArrowLeft className="size-4" />}
                        onClick={() => navigate(-1)}
                        className="-ml-1"
                    >
                        Back
                    </Button>
                </div>
            </header>

            <main
                className="w-full mx-auto flex flex-col md:flex-row items-center"
                style={{ width: "94%", maxWidth: "1440px", margin: "0 auto", gap: "48px" }}
            >
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
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

                        {isWatched && (
                            <Tag
                                color="emerald"
                                variant="3d"
                                size="sm"
                                icon={<Check className="size-3.5" strokeWidth={4} />}
                                className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-white shadow-xl backdrop-blur-md"
                            >
                                Watched
                            </Tag>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center min-w-0" style={{ margin: "20px 0" }}>
                    <EpisodeInfoCard
                        data={data}
                        isWatched={isWatched}
                        onHistoryClick={() => setHistoryPanelOpen(true)}
                        onRefetch={() => refetch()}
                    />
                </div>
            </main>

            <section
                className="w-full border-t border-border/40 bg-muted/5"
                style={{
                    paddingTop: "3rem",
                    paddingLeft: "calc((100vw - min(1440px, 94vw)) / 2)",
                    paddingRight: "calc((100vw - min(1440px, 94vw)) / 2)",
                }}
            >
                <EpisodeSeasonStrip
                    showId={data.showId}
                    seasonNumber={data.seasonNumber}
                    currentEpisodeNumber={data.episodeNumber}
                    episodes={data.seasonEpisodes || []}
                    watched={isWatched}
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
