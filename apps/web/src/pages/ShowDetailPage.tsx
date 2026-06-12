import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCw, CheckCheck } from "lucide-react";
import {
    useShowDetail,
    useResetProgress,
    useMarkSeasonWatched,
    useForceSync,
    useWatchlist,
    useAddToWatchlist,
    useRemoveFromWatchlist,
} from "../hooks";
import { HeroSection } from "../components/HeroSection";
import { SeasonTab } from "../components/SeasonTab";
import { EpisodeGrid } from "../components/EpisodeGrid";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { t } from "../lib/i18n";
import { useToast } from "../lib/toast";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)]">
            <div className="max-w-[1100px] mx-auto px-6 lg:px-8 py-8">
                <div className="flex gap-8 items-start animate-pulse">
                    {/* 主栏 */}
                    <div className="flex-1 min-w-0 flex flex-col gap-6">
                        <div className="flex gap-8">
                            <div className="w-[200px] aspect-[2/3] rounded-2xl bg-white/[0.05] shrink-0" />
                            <div className="flex-1 flex flex-col gap-3 pt-2">
                                <div className="h-9 w-64 rounded-lg bg-white/[0.07]" />
                                <div className="h-3 w-40 rounded-full bg-white/[0.04]" />
                                <div className="h-3 w-28 rounded-full bg-white/[0.04]" />
                                <div className="h-20 w-full rounded-lg bg-white/[0.03]" />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            {[90, 90, 90, 90].map((w, i) => (
                                <div
                                    key={i}
                                    className="h-[130px] rounded-xl bg-white/[0.03]"
                                    style={{ width: w }}
                                />
                            ))}
                        </div>
                    </div>
                    {/* 侧栏 */}
                    <div className="w-[260px] shrink-0 flex flex-col gap-3">
                        <div className="h-32 rounded-xl bg-white/[0.03]" />
                        <div className="h-24 rounded-xl bg-white/[0.03]" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function PageError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-red-950/40 border border-red-500/15 flex items-center justify-center">
                    <span className="text-xl">⚠</span>
                </div>
                <p className="text-[var(--color-text-muted)] text-sm">加载失败，请重试</p>
                <Button
                    variant="secondary"
                    size="md"
                    icon={<RefreshCw size={13} />}
                    onClick={onRetry}
                >
                    重新加载
                </Button>
            </div>
        </div>
    );
}

// ─── ShowDetailPage ───────────────────────────────────────────────────────────

export default function ShowDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const showId = Number(id);
    const isValidId = Number.isInteger(showId) && showId > 0;

    const { data: progress, isLoading, error, refetch } = useShowDetail(isValidId ? showId : 0);
    const [activeSeason, setActiveSeason] = useState<number | null>(null);
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const episodesRef = useRef<HTMLDivElement>(null);

    const resetProgress = useResetProgress(isValidId ? showId : 0);
    const markSeasonWatched = useMarkSeasonWatched(isValidId ? showId : 0);
    const forceSync = useForceSync(isValidId ? showId : 0);

    // Watchlist
    const { data: watchlistItems } = useWatchlist("shows");
    const watchlistItem = watchlistItems?.find((item) => "show" in item && item.show.id === showId);
    const inWatchlist = !!watchlistItem;
    const addToWatchlist = useAddToWatchlist();
    const removeFromWatchlist = useRemoveFromWatchlist();
    const isWatchlistPending = addToWatchlist.isPending || removeFromWatchlist.isPending;

    const { toast } = useToast();

    if (isLoading) return <PageSkeleton />;
    if (error) return <PageError onRetry={() => refetch()} />;

    if (!progress) {
        return (
            <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] flex items-center justify-center">
                <div className="text-center flex flex-col items-center gap-3">
                    <p className="text-[var(--color-text-muted)] text-base">未找到该剧集</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowLeft size={13} />}
                        onClick={() => navigate(-1)}
                    >
                        返回
                    </Button>
                </div>
            </div>
        );
    }

    const { seasons, show } = progress;
    const currentSeasonNumber = activeSeason ?? seasons[0]?.seasonNumber ?? 1;
    const currentSeason = seasons.find((s) => s.seasonNumber === currentSeasonNumber) ?? seasons[0];

    // Compute overall progress
    const totalEpisodes = show.totalEpisodes ?? seasons.reduce((s, x) => s + x.episodeCount, 0);
    const totalWatched = seasons.reduce((s, x) => s + x.watchedCount, 0);
    const isComplete = totalEpisodes > 0 && totalWatched >= totalEpisodes;

    const handleResetConfirm = async () => {
        setResetError(null);
        try {
            await resetProgress.mutateAsync();
            setResetConfirmOpen(false);
        } catch (err) {
            setResetError(err instanceof Error ? err.message : "重置失败，请重试");
        }
    };

    function scrollToEpisodes() {
        episodesRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] text-[var(--color-text)]">
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

                {/* Hero 三栏区 */}
                <HeroSection
                    progress={progress}
                    onWatchClick={scrollToEpisodes}
                    onHistoryClick={() => setHistoryPanelOpen(true)}
                    onResetClick={isComplete ? () => setResetConfirmOpen(true) : undefined}
                    onForceSyncClick={() => {
                        forceSync.mutate(undefined, {
                            onSuccess: () => toast("已触发元数据刷新", "success"),
                            onError: (err) =>
                                toast(`刷新失败: ${err.message}`, "error", {
                                    label: "重试",
                                    onClick: () => forceSync.mutate(undefined),
                                }),
                        });
                    }}
                    onToggleWatchlist={() => {
                        if (inWatchlist && watchlistItem) {
                            removeFromWatchlist.mutate(watchlistItem.id, {
                                onSuccess: () => toast(t("watchlist.removeSuccess"), "success"),
                                onError: () =>
                                    toast(t("watchlist.removeFailed"), "error", {
                                        label: "重试",
                                        onClick: () => removeFromWatchlist.mutate(watchlistItem.id),
                                    }),
                            });
                        } else {
                            addToWatchlist.mutate(
                                { type: "show", id: showId },
                                {
                                    onSuccess: () => toast("已添加到待看列表", "success"),
                                    onError: () =>
                                        toast("添加失败", "error", {
                                            label: "重试",
                                            onClick: () =>
                                                addToWatchlist.mutate({ type: "show", id: showId }),
                                        }),
                                },
                            );
                        }
                    }}
                    isForceSyncing={forceSync.isPending}
                    isWatchlistPending={isWatchlistPending}
                    inWatchlist={inWatchlist}
                    isComplete={isComplete}
                />

                {/* 季/集区域 */}
                <div
                    ref={episodesRef}
                    style={{
                        marginTop: "40px",
                        paddingTop: "32px",
                        scrollMarginTop: "calc(var(--app-nav-height) + 24px)",
                        borderTop: "1px solid var(--color-border-subtle)",
                    }}
                >
                    {/* 季切换标签 */}
                    {seasons.length > 0 && (
                        <div
                            className="mb-6 inline-flex max-w-full flex-wrap rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg shadow-black/10"
                            role="tablist"
                            aria-label="选择季度"
                        >
                            {seasons.map((s) => {
                                const isActive = s.seasonNumber === currentSeasonNumber;

                                return (
                                    <button
                                        key={s.seasonNumber}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => setActiveSeason(s.seasonNumber)}
                                        className="inline-flex h-8 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
                                        style={{
                                            color: isActive
                                                ? "var(--color-accent-light)"
                                                : "var(--color-text-secondary)",
                                            background: isActive
                                                ? "var(--color-accent-dim)"
                                                : "transparent",
                                            border: isActive
                                                ? "1px solid var(--color-border-focus)"
                                                : "1px solid transparent",
                                        }}
                                    >
                                        {s.seasonNumber === 0
                                            ? t("shows.specials")
                                            : `S${s.seasonNumber}`}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* 季海报横排 — 靠左 */}
                    {seasons.length > 0 && (
                        <div
                            style={{
                                display: "flex",
                                gap: "24px",
                                marginBottom: "40px",
                                overflowX: "auto",
                                paddingBottom: "8px",
                                paddingLeft: "10px",
                                scrollbarWidth: "none",
                            }}
                            role="tablist"
                            aria-label="选择季度"
                        >
                            {seasons.map((s) => (
                                <SeasonTab
                                    key={s.seasonNumber}
                                    season={s}
                                    isActive={s.seasonNumber === currentSeasonNumber}
                                    onClick={() => setActiveSeason(s.seasonNumber)}
                                />
                            ))}
                        </div>
                    )}

                    {/* 当前季操作栏 */}
                    {currentSeason && (
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-[var(--color-text-muted)]">
                                {currentSeason.seasonNumber === 0
                                    ? t("shows.specials")
                                    : t("shows.seasonLabel", {
                                          number: currentSeason.seasonNumber,
                                      })}
                                {" · "}
                                {t("shows.episodeCount", {
                                    watched: currentSeason.watchedCount,
                                    total: currentSeason.airedCount,
                                })}
                            </span>
                            {currentSeason.watchedCount < currentSeason.airedCount && (
                                <Button
                                    type="button"
                                    variant="primary"
                                    color="emerald"
                                    size="sm"
                                    loading={markSeasonWatched.isPending}
                                    icon={<CheckCheck className="h-3.5 w-3.5" />}
                                    onClick={() =>
                                        markSeasonWatched.mutate(
                                            { season: currentSeason.seasonNumber, watchedAt: null },
                                            {
                                                onSuccess: () =>
                                                    toast(
                                                        t("shows.markSeasonWatchedSuccess"),
                                                        "success",
                                                    ),
                                                onError: () =>
                                                    toast(
                                                        t("shows.markSeasonWatchedError"),
                                                        "error",
                                                        {
                                                            label: "重试",
                                                            onClick: () =>
                                                                markSeasonWatched.mutate({
                                                                    season: currentSeason.seasonNumber,
                                                                    watchedAt: null,
                                                                }),
                                                        },
                                                    ),
                                            },
                                        )
                                    }
                                >
                                    {t("shows.markSeasonWatched")}
                                </Button>
                            )}
                        </div>
                    )}

                    {/* 剧集横向滚动列表 */}
                    <div
                        style={{
                            paddingTop: "24px",
                            borderTop: "1px solid var(--color-border-subtle)",
                        }}
                    >
                        <AnimatePresence mode="wait">
                            {currentSeason ? (
                                <EpisodeGrid
                                    key={currentSeasonNumber}
                                    episodes={currentSeason.episodes}
                                    seasonNumber={currentSeasonNumber}
                                    showId={showId}
                                    backdropPath={show.backdropPath}
                                />
                            ) : (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-[var(--color-text-muted)] text-sm py-10 text-center"
                                >
                                    暂无剧集数据
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {resetError && (
                <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-500/20 bg-red-950/80 px-4 py-3 text-sm text-red-400 shadow-xl">
                    {resetError}
                </div>
            )}
            <ConfirmDialog
                isOpen={resetConfirmOpen}
                title="再看一遍？"
                description="这将重置观看进度，但所有历史记录会完整保留。你可以随时在观看历史中查看之前的记录。"
                confirmText="确认重置"
                confirmColor="amber"
                cancelText="取消"
                isLoading={resetProgress.isPending}
                onConfirm={handleResetConfirm}
                onCancel={() => {
                    setResetConfirmOpen(false);
                    setResetError(null);
                }}
            />

            {/* Watch History Panel */}
            <WatchHistoryPanel
                open={historyPanelOpen}
                onClose={() => setHistoryPanelOpen(false)}
                showId={showId}
                onDeleted={() => refetch()}
            />
        </div>
    );
}
