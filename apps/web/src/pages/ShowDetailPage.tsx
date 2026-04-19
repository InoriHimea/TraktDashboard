import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCw, History } from "lucide-react";
import { useShowDetail, useResetProgress } from "../hooks";
import { HeroSection } from "../components/HeroSection";
import { SeasonTab } from "../components/SeasonTab";
import { EpisodeGrid } from "../components/EpisodeGrid";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { Button } from "../components/ui/Button";
import { resolveTitle } from "../lib/i18n";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
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
        <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-red-950/40 border border-red-500/15 flex items-center justify-center">
                    <span className="text-xl">⚠</span>
                </div>
                <p className="text-[var(--color-text-muted)] text-sm">
                    加载失败，请重试
                </p>
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

    const {
        data: progress,
        isLoading,
        error,
        refetch,
    } = useShowDetail(isValidId ? showId : 0);
    const [activeSeason, setActiveSeason] = useState<number | null>(null);
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const episodesRef = useRef<HTMLDivElement>(null);

    const resetProgress = useResetProgress(isValidId ? showId : 0);

    if (isLoading) return <PageSkeleton />;
    if (error) return <PageError onRetry={() => refetch()} />;

    if (!progress) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
                <div className="text-center flex flex-col items-center gap-3">
                    <p className="text-[var(--color-text-muted)] text-base">
                        未找到该剧集
                    </p>
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
    const currentSeason =
        seasons.find((s) => s.seasonNumber === currentSeasonNumber) ??
        seasons[0];

    // Compute overall progress
    const totalEpisodes =
        show.totalEpisodes ?? seasons.reduce((s, x) => s + x.episodeCount, 0);
    const totalWatched = seasons.reduce((s, x) => s + x.watchedCount, 0);
    const isComplete = totalEpisodes > 0 && totalWatched >= totalEpisodes;

    const handleResetConfirm = async () => {
        setResetError(null);
        try {
            await resetProgress.mutateAsync();
            setResetConfirmOpen(false);
        } catch (err) {
            setResetError(
                err instanceof Error ? err.message : "重置失败，请重试",
            );
        }
    };

    function scrollToEpisodes() {
        episodesRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
            <div style={{ width: "100%", padding: "24px 40px" }}>
                {/* Hero 三栏区 */}
                <HeroSection
                    progress={progress}
                    onWatchClick={scrollToEpisodes}
                />

                {/* Watch again + History buttons (shown when 100% complete) */}
                {isComplete && (
                    <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-10 mt-4 mb-2 flex items-center">
                        {/* Spacer matching poster width + gap so buttons align under the info column */}
                        <div className="hidden lg:block shrink-0" style={{ width: "260px", marginRight: "40px" }} />
                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => setResetConfirmOpen(true)}
                            >
                                再看一遍...
                            </Button>
                            <Button
                                variant="secondary"
                                size="md"
                                icon={<History size={15} />}
                                onClick={() => setHistoryPanelOpen(true)}
                            >
                                观看历史
                            </Button>
                        </div>
                    </div>
                )}

                {/* History button (always visible) */}
                {!isComplete && (
                    <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-10 mt-4 mb-2 flex items-center">
                        {/* Spacer matching poster width + gap */}
                        <div className="hidden lg:block shrink-0" style={{ width: "260px", marginRight: "40px" }} />
                        <Button
                            variant="secondary"
                            size="md"
                            icon={<History size={15} />}
                            onClick={() => setHistoryPanelOpen(true)}
                        >
                            观看历史
                        </Button>
                    </div>
                )}

                {/* 季/集区域 */}
                <div
                    ref={episodesRef}
                    style={{
                        marginTop: "40px",
                        paddingTop: "32px",
                        borderTop: "1px solid var(--color-border-subtle)",
                    }}
                >
                    {/* Breadcrumb */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "24px",
                            fontSize: "14px",
                        }}
                    >
                        <span
                            style={{
                                fontWeight: 600,
                                color: "var(--color-text)",
                            }}
                        >
                            Seasons
                        </span>
                        <span style={{ color: "var(--color-text-muted)" }}>
                            /
                        </span>
                        <span style={{ color: "var(--color-text-muted)" }}>
                            {currentSeasonNumber === 0
                                ? "Specials"
                                : `Season ${currentSeasonNumber}`}
                        </span>
                    </div>

                    {/* 季海报横排 — 靠左 */}
                    {seasons.length > 0 && (
                        <div
                            style={{
                                display: "flex",
                                gap: "24px",
                                marginBottom: "40px",
                                overflowX: "auto",
                                paddingBottom: "8px",
                                scrollbarWidth: "none",
                            }}
                            role="tablist"
                            aria-label="选择季度"
                        >
                            {seasons.map((s) => (
                                <SeasonTab
                                    key={s.seasonNumber}
                                    season={s}
                                    isActive={
                                        s.seasonNumber === currentSeasonNumber
                                    }
                                    onClick={() =>
                                        setActiveSeason(s.seasonNumber)
                                    }
                                />
                            ))}
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

            {/* Reset Confirm Dialog */}
            <AnimatePresence>
                {resetConfirmOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                            onClick={() => {
                                setResetConfirmOpen(false);
                                setResetError(null);
                            }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="fixed z-50 bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-[420px] max-w-[90vw] p-6"
                            style={{
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">
                                再看一遍？
                            </h3>
                            <p className="text-sm text-[var(--color-text-muted)] mb-4">
                                这将重置观看进度，但所有历史记录会完整保留。你可以随时在观看历史中查看之前的记录。
                            </p>
                            {resetError && (
                                <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-sm text-red-400">
                                    {resetError}
                                </div>
                            )}
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="ghost"
                                    size="md"
                                    onClick={() => {
                                        setResetConfirmOpen(false);
                                        setResetError(null);
                                    }}
                                    disabled={resetProgress.isPending}
                                >
                                    取消
                                </Button>
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={handleResetConfirm}
                                    disabled={resetProgress.isPending}
                                >
                                    {resetProgress.isPending
                                        ? "重置中..."
                                        : "确认重置"}
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

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