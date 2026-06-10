import { useState, type ReactNode } from "react";
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
import { formatEpisode } from "../lib/utils";

function EpisodeDetailState({
    message,
    action,
}: {
    message: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex min-h-[calc(100svh-var(--app-nav-height))] items-center justify-center bg-background px-6 text-foreground">
            <div className="hud-panel flex max-w-sm flex-col items-center gap-4 p-8 text-center">
                <p className="text-sm text-muted-foreground">{message}</p>
                {action}
            </div>
        </div>
    );
}

function EpisodeDetailSkeleton() {
    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-background text-foreground">
            <div className="mx-auto flex w-full max-w-[1440px] animate-pulse flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
                <div className="h-10 w-28 rounded-full bg-muted/70" />
                <div className="grid items-center gap-8 lg:grid-cols-[minmax(360px,0.74fr)_minmax(0,1fr)] lg:gap-12">
                    <div className="aspect-video w-full rounded-[var(--radius-xl)] bg-muted/70" />
                    <div className="flex flex-col gap-5 py-3">
                        <div className="h-5 w-44 rounded-full bg-muted/70" />
                        <div className="h-14 w-4/5 rounded-xl bg-muted" />
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="h-20 rounded-xl bg-muted/70" />
                            <div className="h-20 rounded-xl bg-muted/70" />
                            <div className="h-20 rounded-xl bg-muted/70" />
                        </div>
                        <div className="h-28 w-full rounded-xl bg-muted/60" />
                    </div>
                </div>
                <div className="h-64 rounded-[var(--radius-xl)] bg-muted/60" />
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
    const episodeCode = formatEpisode(data.seasonNumber, data.episodeNumber);
    const title = data.translatedTitle ?? data.title ?? episodeCode;

    return (
        <div className="relative min-h-[calc(100svh-var(--app-nav-height))] w-full overflow-hidden bg-background pb-24 text-foreground">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[540px] overflow-hidden">
                {heroImageUrl && (
                    <img
                        src={heroImageUrl}
                        alt=""
                        className="h-full w-full scale-105 object-cover opacity-25 blur-2xl"
                    />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,11,0.48),var(--color-bg)_78%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,244,238,0.14),transparent_34%),radial-gradient(circle_at_82%_8%,rgba(255,61,129,0.10),transparent_30%)]" />
            </div>

            <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        color="slate"
                        size="md"
                        icon={<ArrowLeft className="size-4" />}
                        onClick={() => navigate(-1)}
                        className="w-fit"
                    >
                        {t("common.back")}
                    </Button>
                    <div className="flex min-w-0 items-center gap-2 rounded-full border border-border/50 bg-[var(--color-surface-2)]/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:max-w-[50%]">
                        <span className="truncate text-foreground/90">{data.show.translatedName ?? data.show.title}</span>
                        <span className="text-muted-foreground/50">/</span>
                        <span className="tabular-nums text-[var(--color-accent-light)]">{episodeCode}</span>
                    </div>
                </div>

                <section className="grid items-center gap-8 lg:grid-cols-[minmax(360px,0.74fr)_minmax(0,1fr)] lg:gap-12 xl:gap-14">
                    <div className="w-full">
                        <div className="hud-panel-strong relative aspect-video w-full overflow-hidden rounded-[var(--radius-xl)] border border-border/50 shadow-2xl shadow-black/35">
                            {heroImageUrl ? (
                                <img
                                    src={heroImageUrl}
                                    className="h-full w-full object-cover"
                                    alt={title}
                                />
                            ) : (
                                <EpisodePlaceholder
                                    seasonNumber={data.seasonNumber}
                                    episodeNumber={data.episodeNumber}
                                />
                            )}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/78 via-black/12 to-transparent" />
                            <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                                <Tag color="slate" variant="3d" size="sm" className="rounded-full px-3 py-1 tabular-nums">
                                    {episodeCode}
                                </Tag>
                                {isWatched && (
                                    <Tag
                                        color="emerald"
                                        variant="3d"
                                        size="sm"
                                        icon={<Check className="size-3.5" strokeWidth={4} />}
                                        className="rounded-full px-3 py-1"
                                    >
                                        已观看
                                    </Tag>
                                )}
                            </div>
                            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                                <p className="line-clamp-2 text-sm font-semibold text-white/90 sm:text-base">
                                    {data.show.translatedName ?? data.show.title}
                                </p>
                                {data.traktRating != null && (
                                    <div className="shrink-0 rounded-full border border-[var(--action-amber-border)] bg-[var(--action-amber-surface)] px-3 py-1 text-xs font-black text-[var(--action-amber-text)] shadow-lg backdrop-blur-md">
                                        {data.traktRating}
                                        <span className="ml-0.5 opacity-65">%</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col justify-center">
                        <EpisodeInfoCard
                            data={data}
                            isWatched={isWatched}
                            onHistoryClick={() => setHistoryPanelOpen(true)}
                            onRefetch={() => refetch()}
                        />
                    </div>
                </section>

                <section className="border-t border-border/40 pt-8 lg:pt-10">
                    <EpisodeSeasonStrip
                        showId={data.showId}
                        seasonNumber={data.seasonNumber}
                        currentEpisodeNumber={data.episodeNumber}
                        episodes={data.seasonEpisodes || []}
                        watched={isWatched}
                        fallbackImageUrl={fallbackUrl}
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
        </div>
    );
}
