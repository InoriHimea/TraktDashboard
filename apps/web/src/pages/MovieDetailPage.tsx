import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Film, Clock, Calendar, Eye, Trash2, RefreshCw, Loader2, History } from "lucide-react";
import { useMovieDetail, useMovieHistory, useMarkMovieWatched, useDeleteMovieHistory } from "../hooks";
import { tmdbImage } from "../lib/utils";
import { t } from "../lib/i18n";
import { Button } from "../components/ui/Button";

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
            <span className="shrink-0 text-[var(--color-text-muted)]">{label}</span>
            <span className="min-w-0 text-right font-medium text-[var(--color-text-secondary)] break-words">{value}</span>
        </div>
    );
}

function MetricTile({ label, value, tone = "text-[var(--color-text)]", wide = false }: { label: string; value: string; tone?: string; wide?: boolean }) {
    return (
        <div className={`rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3 py-3 ${wide ? "col-span-2" : ""}`}>
            <div className="mb-1 text-[11px] text-[var(--color-text-muted)]">{label}</div>
            <div className={`truncate text-base font-bold ${tone}`}>{value}</div>
        </div>
    );
}

function PageSkeleton() {
    return (
        <div className="min-h-screen bg-[var(--color-bg)] px-[3vw] py-8 text-[var(--color-text)]">
            <div className="flex w-full max-w-none flex-col gap-8 animate-pulse">
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

    const [activeTab, setActiveTab] = useState<"details" | "history">("details");
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
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
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6 text-[var(--color-text)]">
                <div className="flex flex-col items-center gap-4 text-center">
                    <p className="text-sm text-[var(--color-error)]">加载失败，请重试</p>
                    <button
                        onClick={() => refetch()}
                        className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
                    >
                        <RefreshCw size={14} /> 重新加载
                    </button>
                </div>
            </div>
        );
    }

    if (!progress) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                {t("common.notFound")}
            </div>
        );
    }

    const { movie, watchCount, lastWatchedAt } = progress;
    const poster = tmdbImage(movie.posterPath, "w500");
    const backdrop = tmdbImage(movie.backdropPath, "w1280");

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatDateOnly = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const totalWatchMinutes = movie.runtime && watchCount > 0 ? movie.runtime * watchCount : null;
    const formatMinutes = (minutes: number | null) => {
        if (!minutes) return "—";
        if (minutes < 60) return `${minutes} 分钟`;
        return `${(minutes / 60).toFixed(minutes >= 600 ? 0 : 1)}h`;
    };

    const handleMarkWatched = () => {
        markWatched.mutate(new Date().toISOString());
    };

    const handleDeleteHistory = async (historyId: number) => {
        await deleteHistory.mutateAsync(historyId);
        setDeleteConfirmId(null);
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
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

            <div className="relative flex w-full max-w-none flex-col gap-8 px-[3vw] py-8">
                <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    icon={<ArrowLeft size={14} />}
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
                        className="relative w-[240px] max-w-full shrink-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-2xl shadow-black/40"
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
                                    <Film size={48} className="text-[var(--color-text-muted)] opacity-40" />
                                </div>
                            )}
                        </div>
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
                                        <Calendar size={14} /> {new Date(movie.releaseDate).getFullYear()}
                                    </span>
                                )}
                                {movie.runtime && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Clock size={14} /> {movie.runtime} 分钟
                                    </span>
                                )}
                                {watchCount > 0 && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-emerald-300">
                                        <Eye size={14} /> {t("movies.watchCount")} {watchCount}
                                    </span>
                                )}
                            </div>
                        </div>

                        {movie.genres.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {movie.genres.map((genre) => (
                                    <span
                                        key={genre}
                                        className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-text-muted)]"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        )}

                        {movie.overview && (
                            <p className="max-w-4xl text-left text-[15px] leading-7 text-[var(--color-text-secondary)]">
                                {movie.overview}
                            </p>
                        )}


                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            loading={markWatched.isPending}
                            icon={<Eye size={15} />}
                            onClick={handleMarkWatched}
                        >
                            标记为已观看
                        </Button>
                    </motion.div>
                </section>

                <section className="border-t border-[var(--color-border-subtle)] pt-7">
                    <div className="mb-5 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg shadow-black/10">
                        {[
                            ["details", "资料", Film],
                            ["history", t("watchHistory.showTitle"), History],
                        ].map(([key, label, Icon]) => (
                            <button
                                key={key as string}
                                onClick={() => setActiveTab(key as "details" | "history")}
                                className="inline-flex h-8 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors"
                                style={{
                                    color: activeTab === key ? "var(--color-accent-light)" : "var(--color-text-secondary)",
                                    background: activeTab === key ? "var(--color-accent-dim)" : "transparent",
                                    border: activeTab === key ? "1px solid var(--color-border-focus)" : "1px solid transparent",
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
                                    <div className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">影片档案</div>
                                    <div className="grid gap-3 text-sm">
                                        <DetailRow label="上映日期" value={formatDateOnly(movie.releaseDate) ?? t("common.unknown")} />
                                        <DetailRow label="片长" value={movie.runtime ? `${movie.runtime} 分钟` : t("common.unknown")} />
                                        <DetailRow label="类型" value={movie.genres.length ? movie.genres.join(" / ") : t("common.unknown")} />
                                        <DetailRow label="同步时间" value={formatDate(movie.lastSyncedAt) ?? t("common.unknown")} />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-lg shadow-black/10">
                                    <div className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">观看档案</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <MetricTile label="观看次数" value={String(watchCount)} tone="text-[var(--color-watched)]" />
                                        <MetricTile label="累计时长" value={formatMinutes(totalWatchMinutes)} />
                                        <MetricTile label="最近观看" value={formatDate(lastWatchedAt) ?? "未观看"} wide />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-lg shadow-black/10">
                                    <div className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">外部数据</div>
                                    <div className="grid gap-3 text-sm">
                                        <DetailRow label="TMDB" value={`#${movie.tmdbId}`} />
                                        <DetailRow label="IMDb" value={movie.imdbId || t("common.unknown")} />
                                        <DetailRow label="Trakt" value={String(movie.traktSlug || movie.traktId || t("common.unknown"))} />
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
                                    <h2 className="text-lg font-semibold">{t("watchHistory.showTitle")}</h2>
                                    {visibleHistory.length > 0 && (
                                        <span className="text-sm text-[var(--color-text-muted)]">
                                            {t("watchHistory.recordCount", { count: visibleHistory.length })}
                                        </span>
                                    )}
                                </div>

                                {historyLoading ? (
                                    <div className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                                        <Loader2 size={14} className="animate-spin" /> {t("common.loading")}
                                    </div>
                                ) : visibleHistory.length === 0 ? (
                                    <p className="text-sm text-[var(--color-text-muted)]">{t("watchHistory.empty")}</p>
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
                                                        {formatDate(entry.watchedAt) ?? t("watchHistory.unknownTime")}
                                                    </span>
                                                    {deleteConfirmId === entry.id ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleDeleteHistory(entry.id)}
                                                                disabled={deleteHistory.isPending}
                                                                className="rounded-[var(--radius-sm)] bg-[var(--color-error)] px-3 py-1 text-xs text-white"
                                                            >
                                                                {t("common.confirm")}
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirmId(null)}
                                                                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-3)] px-3 py-1 text-xs text-[var(--color-text-muted)]"
                                                            >
                                                                {t("common.cancel")}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteConfirmId(entry.id)}
                                                            title={t("watchHistory.deleteLabel")}
                                                            className="rounded-[var(--radius-sm)] border border-transparent p-2 text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-error)]"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
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
        </div>
    );
}
