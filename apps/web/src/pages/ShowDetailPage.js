import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PageSkeleton() {
    return (_jsx("div", { className: "min-h-screen bg-[var(--color-bg)]", children: _jsx("div", { className: "max-w-[1100px] mx-auto px-6 lg:px-8 py-8", children: _jsxs("div", { className: "flex gap-8 items-start animate-pulse", children: [_jsxs("div", { className: "flex-1 min-w-0 flex flex-col gap-6", children: [_jsxs("div", { className: "flex gap-8", children: [_jsx("div", { className: "w-[200px] aspect-[2/3] rounded-2xl bg-white/[0.05] shrink-0" }), _jsxs("div", { className: "flex-1 flex flex-col gap-3 pt-2", children: [_jsx("div", { className: "h-9 w-64 rounded-lg bg-white/[0.07]" }), _jsx("div", { className: "h-3 w-40 rounded-full bg-white/[0.04]" }), _jsx("div", { className: "h-3 w-28 rounded-full bg-white/[0.04]" }), _jsx("div", { className: "h-20 w-full rounded-lg bg-white/[0.03]" })] })] }), _jsx("div", { className: "flex gap-3", children: [90, 90, 90, 90].map((w, i) => (_jsx("div", { className: "h-[130px] rounded-xl bg-white/[0.03]", style: { width: w } }, i))) })] }), _jsxs("div", { className: "w-[260px] shrink-0 flex flex-col gap-3", children: [_jsx("div", { className: "h-32 rounded-xl bg-white/[0.03]" }), _jsx("div", { className: "h-24 rounded-xl bg-white/[0.03]" })] })] }) }) }));
}
// ─── Error state ──────────────────────────────────────────────────────────────
function PageError({ onRetry }) {
    return (_jsx("div", { className: "min-h-screen bg-[var(--color-bg)] flex items-center justify-center", children: _jsxs("div", { className: "text-center flex flex-col items-center gap-4", children: [_jsx("div", { className: "w-14 h-14 rounded-xl bg-red-950/40 border border-red-500/15 flex items-center justify-center", children: _jsx("span", { className: "text-xl", children: "\u26A0" }) }), _jsx("p", { className: "text-[var(--color-text-muted)] text-sm", children: "\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5" }), _jsx(Button, { variant: "secondary", size: "md", icon: _jsx(RefreshCw, { size: 13 }), onClick: onRetry, children: "\u91CD\u65B0\u52A0\u8F7D" })] }) }));
}
// ─── ShowDetailPage ───────────────────────────────────────────────────────────
export default function ShowDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const showId = Number(id);
    const isValidId = Number.isInteger(showId) && showId > 0;
    const { data: progress, isLoading, error, refetch, } = useShowDetail(isValidId ? showId : 0);
    const [activeSeason, setActiveSeason] = useState(null);
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [resetError, setResetError] = useState(null);
    const episodesRef = useRef(null);
    const resetProgress = useResetProgress(isValidId ? showId : 0);
    if (isLoading)
        return _jsx(PageSkeleton, {});
    if (error)
        return _jsx(PageError, { onRetry: () => refetch() });
    if (!progress) {
        return (_jsx("div", { className: "min-h-screen bg-[var(--color-bg)] flex items-center justify-center", children: _jsxs("div", { className: "text-center flex flex-col items-center gap-3", children: [_jsx("p", { className: "text-[var(--color-text-muted)] text-base", children: "\u672A\u627E\u5230\u8BE5\u5267\u96C6" }), _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(ArrowLeft, { size: 13 }), onClick: () => navigate(-1), children: "\u8FD4\u56DE" })] }) }));
    }
    const { seasons, show } = progress;
    const currentSeasonNumber = activeSeason ?? seasons[0]?.seasonNumber ?? 1;
    const currentSeason = seasons.find((s) => s.seasonNumber === currentSeasonNumber) ??
        seasons[0];
    // Compute overall progress
    const totalEpisodes = show.totalEpisodes ?? seasons.reduce((s, x) => s + x.episodeCount, 0);
    const totalWatched = seasons.reduce((s, x) => s + x.watchedCount, 0);
    const isComplete = totalEpisodes > 0 && totalWatched >= totalEpisodes;
    const handleResetConfirm = async () => {
        setResetError(null);
        try {
            await resetProgress.mutateAsync();
            setResetConfirmOpen(false);
        }
        catch (err) {
            setResetError(err instanceof Error ? err.message : "重置失败，请重试");
        }
    };
    function scrollToEpisodes() {
        episodesRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }
    return (_jsxs("div", { className: "min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]", children: [_jsxs("div", { style: { width: "100%", padding: "24px 40px" }, children: [_jsx(HeroSection, { progress: progress, onWatchClick: scrollToEpisodes }), isComplete && (_jsxs("div", { className: "flex items-center gap-3 mt-4 px-6 lg:px-10", children: [_jsx(Button, { variant: "secondary", size: "md", onClick: () => setResetConfirmOpen(true), children: "\u518D\u770B\u4E00\u904D..." }), _jsx(Button, { variant: "ghost", size: "md", icon: _jsx(History, { size: 15 }), onClick: () => setHistoryPanelOpen(true), children: "\u89C2\u770B\u5386\u53F2" })] })), !isComplete && (_jsx("div", { className: "flex items-center gap-3 mt-4 px-6 lg:px-10", children: _jsx(Button, { variant: "ghost", size: "md", icon: _jsx(History, { size: 15 }), onClick: () => setHistoryPanelOpen(true), children: "\u89C2\u770B\u5386\u53F2" }) })), _jsxs("div", { ref: episodesRef, style: {
                            marginTop: "40px",
                            paddingTop: "32px",
                            borderTop: "1px solid var(--color-border-subtle)",
                        }, children: [_jsxs("div", { style: {
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    marginBottom: "24px",
                                    fontSize: "14px",
                                }, children: [_jsx("span", { style: {
                                            fontWeight: 600,
                                            color: "var(--color-text)",
                                        }, children: "Seasons" }), _jsx("span", { style: { color: "var(--color-text-muted)" }, children: "/" }), _jsx("span", { style: { color: "var(--color-text-muted)" }, children: currentSeasonNumber === 0
                                            ? "Specials"
                                            : `Season ${currentSeasonNumber}` })] }), seasons.length > 0 && (_jsx("div", { style: {
                                    display: "flex",
                                    gap: "24px",
                                    marginBottom: "40px",
                                    overflowX: "auto",
                                    paddingBottom: "8px",
                                    scrollbarWidth: "none",
                                }, role: "tablist", "aria-label": "\u9009\u62E9\u5B63\u5EA6", children: seasons.map((s) => (_jsx(SeasonTab, { season: s, isActive: s.seasonNumber === currentSeasonNumber, onClick: () => setActiveSeason(s.seasonNumber) }, s.seasonNumber))) })), _jsx("div", { style: {
                                    paddingTop: "24px",
                                    borderTop: "1px solid var(--color-border-subtle)",
                                }, children: _jsx(AnimatePresence, { mode: "wait", children: currentSeason ? (_jsx(EpisodeGrid, { episodes: currentSeason.episodes, seasonNumber: currentSeasonNumber, showId: showId }, currentSeasonNumber)) : (_jsx(motion.p, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "text-[var(--color-text-muted)] text-sm py-10 text-center", children: "\u6682\u65E0\u5267\u96C6\u6570\u636E" })) }) })] })] }), _jsx(AnimatePresence, { children: resetConfirmOpen && (_jsxs(_Fragment, { children: [_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 bg-black/60 backdrop-blur-sm z-50", onClick: () => {
                                setResetConfirmOpen(false);
                                setResetError(null);
                            } }), _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95, y: 10 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 10 }, className: "fixed z-50 bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-[420px] max-w-[90vw] p-6", style: {
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                            }, onClick: (e) => e.stopPropagation(), children: [_jsx("h3", { className: "text-lg font-semibold text-[var(--color-text)] mb-2", children: "\u518D\u770B\u4E00\u904D\uFF1F" }), _jsx("p", { className: "text-sm text-[var(--color-text-muted)] mb-4", children: "\u8FD9\u5C06\u91CD\u7F6E\u89C2\u770B\u8FDB\u5EA6\uFF0C\u4F46\u6240\u6709\u5386\u53F2\u8BB0\u5F55\u4F1A\u5B8C\u6574\u4FDD\u7559\u3002\u4F60\u53EF\u4EE5\u968F\u65F6\u5728\u89C2\u770B\u5386\u53F2\u4E2D\u67E5\u770B\u4E4B\u524D\u7684\u8BB0\u5F55\u3002" }), resetError && (_jsx("div", { className: "mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-sm text-red-400", children: resetError })), _jsxs("div", { className: "flex gap-3 justify-end", children: [_jsx(Button, { variant: "ghost", size: "md", onClick: () => {
                                                setResetConfirmOpen(false);
                                                setResetError(null);
                                            }, disabled: resetProgress.isPending, children: "\u53D6\u6D88" }), _jsx(Button, { variant: "primary", size: "md", onClick: handleResetConfirm, disabled: resetProgress.isPending, children: resetProgress.isPending
                                                ? "重置中..."
                                                : "确认重置" })] })] })] })) }), _jsx(WatchHistoryPanel, { open: historyPanelOpen, onClose: () => setHistoryPanelOpen(false), showId: showId, onDeleted: () => refetch() })] }));
}
//# sourceMappingURL=ShowDetailPage.js.map