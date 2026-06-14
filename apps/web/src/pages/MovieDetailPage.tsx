import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Film,
    Clock,
    Calendar,
    Eye,
    Trash2,
    RefreshCw,
    Loader2,
    History,
    Bookmark,
} from "lucide-react";
import {
    useMovieDetail,
    useMovieHistory,
    useMarkMovieWatched,
    useDeleteMovieHistory,
    useWatchlist,
    useAddToWatchlist,
    useRemoveFromWatchlist,
} from "../hooks";
import { tmdbImage } from "../lib/utils";
import { useToast } from "../lib/toast";
import { getLocale, t } from "../lib/i18n";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Tag } from "../components/ui/Tag";
import { OverviewText } from "../components/ui/OverviewText";
import { WatchedBadge } from "../components/ui/WatchedBadge";

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
            <span className="shrink-0 text-[var(--color-text-muted)]">{label}</span>
            <span className="min-w-0 text-right font-medium text-[var(--color-text-secondary)] break-words">
                {value}
            </span>
        </div>
    );
}

function MetricTile({
    label,
    value,
    tone = "text-[var(--color-text)]",
    wide = false,
}: {
    label: string;
    value: string;
    tone?: string;
    wide?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3 py-3 ${wide ? "col-span-2" : ""}`}
        >
            <div className="mb-1 text-[11px] text-[var(--color-text-muted)]">{label}</div>
            <div className={`truncate text-base font-bold ${tone}`}>{value}</div>
        </div>
    );
}

function PageSkeleton() {
    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] text-[var(--color-text)]">
            <div className="app-container flex flex-col gap-8 py-8 animate-pulse">
                <div className="h-10 w-24 rounded-lg bg-[var(--color-surface-3)]" />
                <div className="flex flex-col gap-10 lg:flex-row">
                    <div className="w-[240px] max-w-full aspect-[2/3] rounded-2xl bg-[var(--color-surface-3)]" />
                    <div className="flex flex-1 flex-col gap-4 pt-2">
                        <div className="h-9 w-72 rounded-lg bg-white/[0.07]" />
                        <div className="h-4 w-44 rounded-full bg-white/[0.04]" />
                        <div className="h-28 w-full max-w-3xl rounded-lg bg-white/[0.03]" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MovieDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const movieId = Number(id);
    const isValidId = Number.isInteger(movieId) && movieId > 0;

    const { data: progress, isLoading, error, refetch } = useMovieDetail(isValidId ? movieId : 0);
    const { data: history, isLoading: historyLoading } = useMovieHistory(isValidId ? movieId : 0);
    const markWatched = useMarkMovieWatched(isValidId ? movieId : 0);
    const deleteHistory = useDeleteMovieHistory(isValidId ? movieId : 0);

    const { data: watchlistItems } = useWatchlist("movies");
    const watchlistItem = watchlistItems?.find(
        (item) => "movie" in item && item.movie.id === movieId,
    );
    const inWatchlist = !!watchlistItem;
    const addToWatchlist = useAddToWatchlist();
    const removeFromWatchlist = useRemoveFromWatchlist();
    const isWatchlistPending = addToWatchlist.isPending || removeFromWatchlist.isPending;

    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<"details" | "history">("details");
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [markWatchedConfirmOpen, setMarkWatchedConfirmOpen] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [backdropError, setBackdropError] = useState(false);

    const visibleHistory = useMemo(() => {
        const seen = new Set<string>();
        return (history ?? []).filter((entry) => {
            const key = `${entry.movieId}:${entry.watchedAt ?? "null"}:${entry.source}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [history]);

    if (isLoading) return <PageSkeleton />;

    if (error) {
        return (
            <div className="flex min-h-[calc(100svh-var(--app-nav-height))] items-center justify-center bg-[var(--color-bg)] px-6 text-[var(--color-text)]">
                <div className="flex flex-col items-center gap-4 text-center">
                    <p className="text-sm text-[var(--color-error)]">{t("common.loadFailed")}</p>
                    <Button
                        type="button"
                        variant="ghost"
                        color="slate"
                        size="md"
                        icon={<RefreshCw size={14} />}
                        onClick={() => refetch()}
                    >
                        {t("common.reload")}
                    </Button>
                </div>
            </div>
        );
    }

    if (!progress) {
        return (
            <div className="flex min-h-[calc(100svh-var(--app-nav-height))] items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                {t("common.notFound")}
            </div>
        );
    }

    const { movie, watchCount, lastWatchedAt } = progress;
    const poster = tmdbImage(movie.posterPath, "w500");
    const backdrop = tmdbImage(movie.backdropPath, "w1280");

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleString(getLocale(), {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatDateOnly = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString(getLocale(), {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const totalWatchMinutes = movie.runtime && watchCount > 0 ? movie.runtime * watchCount : null;
    const formatMinutes = (minutes: number | null) => {
        if (!minutes) return "—";
        if (minutes < 60) return t("common.minutes", { n: minutes });
        return `${(minutes / 60).toFixed(minutes >= 600 ? 0 : 1)}h`;
    };

    const handleMarkWatched = async () => {
        try {
            await markWatched.mutateAsync(new Date().toISOString());
            setMarkWatchedConfirmOpen(false);
        } catch {
            // mutation error is surfaced via markWatched.isError; keep dialog open
        }
    };

    const handleDeleteHistory = async (historyId: number) => {
        try {
            await deleteHistory.mutateAsync(historyId);
            setDeleteConfirmId(null);
        } catch {
            // mutation error is surfaced via deleteHistory.isError; keep dialog open
        }
    };

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] text-[var(--color-text)]">
            {backdrop && !backdropError && (
                <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-full overflow-hidden opacity-55">
                    <img
                        src={backdrop}
                        alt=""
                        onError={() => setBackdropError(true)}
                        className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-[var(--color-bg)]/70 to-[var(--color-bg)]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-bg)] via-transparent to-[var(--color-bg)]/80" />
                </div>
            )}

            <div className="app-container relative flex flex-col gap-8 py-8">
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

                <section className="flex flex-col items-start gap-10 lg:flex-row">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="relative mx-auto w-[240px] max-w-full shrink-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-2xl shadow-black/40 lg:mx-0"
                    >
                        <div className="aspect-[2/3]">
                            {poster && !imgError ? (
                                <img
                                    src={poster}
                                    alt={movie.title}
                                    onError={() => setImgError(true)}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <Film
                                        size={48}
                                        className="text-[var(--color-text-muted)] opacity-40"
                                    />
                                </div>
                            )}
                        </div>
                        {watchCount > 0 && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4">
                                <WatchedBadge size="md" />
                            </div>
                        )}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className="flex min-w-0 flex-1 flex-col items-start gap-5"
                    >
                        <div className="flex flex-col items-start gap-3">
                            <h1 className="max-w-5xl text-left text-[clamp(34px,5vw,64px)] font-bold leading-[0.95] tracking-[-0.045em] text-[var(--color-text)]">
                                {movie.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-[var(--color-text-secondary)]">
                                {movie.releaseDate && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Calendar size={14} />{" "}
                                        {new Date(movie.releaseDate).getFullYear()}
                                    </span>
                                )}
                                {movie.runtime && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Clock size={14} />{" "}
                                        {t("common.minutes", { n: movie.runtime })}
                                    </span>
                                )}
                                {watchCount > 0 && (
                                    <Tag color="emerald" variant="outline" icon={<Eye size={14} />}>
                                        {t("movies.watchCount")} {watchCount}
                                    </Tag>
                                )}
                            </div>
                        </div>

                        {movie.genres.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {movie.genres.map((genre) => (
                                    <Tag key={genre} color="slate" variant="3d">
                                        {genre}
                                    </Tag>
                                ))}
                            </div>
                        )}

                        {movie.overview && (
                            <OverviewText
                                text={movie.overview}
                                className="max-w-4xl text-left text-[15px] leading-7"
                            />
                        )}

                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="primary"
                                size="md"
                                loading={markWatched.isPending}
                                icon={<Eye size={15} />}
                                onClick={() => setMarkWatchedConfirmOpen(true)}
                            >
                                {t("movieDetail.markWatched")}
                            </Button>
                            <Button
                                type="button"
                                variant={inWatchlist ? "primary" : "secondary"}
                                color="amber"
                                size="md"
                                icon={
                                    <Bookmark
                                        size={15}
                                        fill={inWatchlist ? "currentColor" : "none"}
                                    />
                                }
                                onClick={() => {
                                    if (inWatchlist && watchlistItem) {
                                        removeFromWatchlist.mutate(watchlistItem.id, {
                                            onSuccess: () =>
                                                toast(t("watchlist.removeSuccess"), "success"),
                                            onError: () =>
                                                toast(t("watchlist.removeFailed"), "error", {
                                                    label: t("common.retry"),
                                                    onClick: () =>
                                                        removeFromWatchlist.mutate(
                                                            watchlistItem.id,
                                                        ),
                                                }),
                                        });
                                    } else {
                                        addToWatchlist.mutate(
                                            { type: "movie", id: movieId },
                                            {
                                                onSuccess: () =>
                                                    toast(
                                                        t("movieDetail.addedToWatchlist"),
                                                        "success",
                                                    ),
                                                onError: () =>
                                                    toast(
                                                        t("movieDetail.addToWatchlistFailed"),
                                                        "error",
                                                        {
                                                            label: t("common.retry"),
                                                            onClick: () =>
                                                                addToWatchlist.mutate({
                                                                    type: "movie",
                                                                    id: movieId,
                                                                }),
                                                        },
                                                    ),
                                            },
                                        );
                                    }
                                }}
                                disabled={isWatchlistPending}
                            >
                                {inWatchlist
                                    ? t("common.inWatchlist")
                                    : t("common.addToWatchlistShort")}
                            </Button>
                        </div>
                    </motion.div>
                </section>

                <section className="border-t border-[var(--color-border-subtle)] pt-7">
                    <div className="mb-5 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-lg shadow-black/10">
                        {[
                            ["details", t("movieDetail.tabProfile"), Film],
                            ["history", t("watchHistory.showTitle"), History],
                        ].map(([key, label, Icon]) => (
                            <button
                                key={key as string}
                                onClick={() => setActiveTab(key as "details" | "history")}
                                className="inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors"
                                style={{
                                    color:
                                        activeTab === key
                                            ? "var(--action-violet-text)"
                                            : "var(--color-text-secondary)",
                                    background:
                                        activeTab === key
                                            ? "var(--action-violet-surface)"
                                            : "transparent",
                                    border:
                                        activeTab === key
                                            ? "1px solid var(--action-violet-border)"
                                            : "1px solid transparent",
                                }}
                            >
                                <Icon size={14} /> {label as string}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === "details" ? (
                            <motion.div
                                key="details"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="grid max-w-6xl grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_1fr]"
                            >
                                <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-lg shadow-black/10">
                                    <div className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                                        {t("movieDetail.profileMovie")}
                                    </div>
                                    <div className="grid gap-3 text-sm">
                                        <DetailRow
                                            label={t("movieDetail.fieldReleaseDate")}
                                            value={
                                                formatDateOnly(movie.releaseDate) ??
                                                t("common.unknown")
                                            }
                                        />
                                        <DetailRow
                                            label={t("movieDetail.fieldRuntime")}
                                            value={
                                                movie.runtime
                                                    ? t("common.minutes", { n: movie.runtime })
                                                    : t("common.unknown")
                                            }
                                        />
                                        <DetailRow
                                            label={t("movieDetail.fieldGenres")}
                                            value={
                                                movie.genres.length
                                                    ? movie.genres.join(" / ")
                                                    : t("common.unknown")
                                            }
                                        />
                                        <DetailRow
                                            label={t("movieDetail.fieldSyncedAt")}
                                            value={
                                                formatDate(movie.lastSyncedAt) ??
                                                t("common.unknown")
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-lg shadow-black/10">
                                    <div className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                                        {t("movieDetail.profileWatch")}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <MetricTile
                                            label={t("movieDetail.metricWatchCount")}
                                            value={String(watchCount)}
                                            tone="text-[var(--color-watched)]"
                                        />
                                        <MetricTile
                                            label={t("movieDetail.metricTotalRuntime")}
                                            value={formatMinutes(totalWatchMinutes)}
                                        />
                                        <MetricTile
                                            label={t("movieDetail.metricLastWatched")}
                                            value={
                                                formatDate(lastWatchedAt) ??
                                                t("movieDetail.notWatchedYet")
                                            }
                                            wide
                                        />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-lg shadow-black/10">
                                    <div className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                                        {t("movieDetail.profileExternal")}
                                    </div>
                                    <div className="grid gap-3 text-sm">
                                        <DetailRow label="TMDB" value={`#${movie.tmdbId}`} />
                                        <DetailRow
                                            label="IMDb"
                                            value={movie.imdbId || t("common.unknown")}
                                        />
                                        <DetailRow
                                            label="Trakt"
                                            value={String(
                                                movie.traktSlug ||
                                                    movie.traktId ||
                                                    t("common.unknown"),
                                            )}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="max-w-4xl"
                            >
                                <div className="mb-4 flex items-center gap-2">
                                    <h2 className="text-lg font-semibold">
                                        {t("watchHistory.showTitle")}
                                    </h2>
                                    {visibleHistory.length > 0 && (
                                        <span className="text-sm text-[var(--color-text-muted)]">
                                            {t("watchHistory.recordCount", {
                                                count: visibleHistory.length,
                                            })}
                                        </span>
                                    )}
                                </div>

                                {historyLoading ? (
                                    <div className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                                        <Loader2 size={14} className="animate-spin" />{" "}
                                        {t("common.loading")}
                                    </div>
                                ) : visibleHistory.length === 0 ? (
                                    <p className="text-sm text-[var(--color-text-muted)]">
                                        {t("watchHistory.empty")}
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <AnimatePresence>
                                            {visibleHistory.map((entry) => (
                                                <motion.div
                                                    key={entry.id}
                                                    initial={{ opacity: 0, y: 4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -4 }}
                                                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3"
                                                >
                                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                                        {formatDate(entry.watchedAt) ??
                                                            t("watchHistory.unknownTime")}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        color="rose"
                                                        size="sm"
                                                        icon={<Trash2 size={13} />}
                                                        onClick={() => setDeleteConfirmId(entry.id)}
                                                        title={t("watchHistory.deleteLabel")}
                                                        aria-label={t("watchHistory.deleteLabel")}
                                                    />
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </div>
            <ConfirmDialog
                isOpen={markWatchedConfirmOpen}
                title={t("movieDetail.markWatchedTitle")}
                description={t("movieDetail.markWatchedDesc")}
                confirmText={t("movieDetail.markWatchedConfirm")}
                confirmColor="violet"
                cancelText={t("common.cancel")}
                isLoading={markWatched.isPending}
                onConfirm={() => {
                    handleMarkWatched();
                }}
                onCancel={() => setMarkWatchedConfirmOpen(false)}
            />
            <ConfirmDialog
                isOpen={deleteConfirmId !== null}
                title={t("movieDetail.deleteHistoryTitle")}
                description={t("movieDetail.deleteHistoryDesc")}
                confirmText={t("common.delete")}
                confirmColor="rose"
                cancelText={t("common.cancel")}
                isLoading={deleteHistory.isPending}
                onConfirm={() => {
                    if (deleteConfirmId !== null) {
                        handleDeleteHistory(deleteConfirmId);
                    }
                }}
                onCancel={() => setDeleteConfirmId(null)}
            />
        </div>
    );
}
