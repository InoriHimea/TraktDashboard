import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Trash2, AlertCircle } from "lucide-react";
import { SlidingPanel } from "./SlidingPanel";
import { Button } from "./ui/Button";
import { useEpisodeHistory, useShowHistory, useDeleteHistory } from "../hooks";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
dayjs.extend(relativeTime);
export function WatchHistoryPanel({ open, onClose, showId, seasonNumber, episodeNumber, onDeleted, }) {
    const [confirmingDelete, setConfirmingDelete] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    // Use episode history if season/episode provided, otherwise show history
    const isEpisodeHistory = seasonNumber !== undefined && episodeNumber !== undefined;
    const episodeHistoryQuery = useEpisodeHistory(showId, seasonNumber ?? 0, episodeNumber ?? 0);
    const showHistoryQuery = useShowHistory(showId);
    const query = isEpisodeHistory ? episodeHistoryQuery : showHistoryQuery;
    const { data: history, isLoading } = query;
    const deleteHistory = useDeleteHistory(showId);
    const handleDelete = async (historyId) => {
        setError(null);
        setDeletingId(historyId);
        try {
            await deleteHistory.mutateAsync(historyId);
            setConfirmingDelete(null);
            onDeleted();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "删除失败，请重试");
        }
        finally {
            setDeletingId(null);
        }
    };
    const formatWatchedAt = (watchedAt) => {
        if (!watchedAt)
            return "未知时间";
        try {
            const d = dayjs(watchedAt);
            const relative = d.locale("zh-cn").fromNow();
            const absolute = d.format("YYYY/MM/DD HH:mm");
            return `${relative} (${absolute})`;
        }
        catch {
            return watchedAt;
        }
    };
    return (_jsx(SlidingPanel, { open: open, onClose: onClose, title: isEpisodeHistory ? "观看历史" : "全剧观看历史", children: _jsxs("div", { className: "p-6", children: [isLoading && (_jsx("div", { className: "flex items-center justify-center py-12", children: _jsx("div", { className: "w-6 h-6 rounded-full border-2 border-t-transparent animate-spin border-[var(--color-accent)]" }) })), !isLoading && (!history || history.length === 0) && (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [_jsx("div", { className: "w-12 h-12 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center mb-3", children: _jsx(AlertCircle, { size: 20, className: "text-[var(--color-text-muted)]" }) }), _jsx("p", { className: "text-sm text-[var(--color-text-muted)]", children: "\u6682\u65E0\u89C2\u770B\u8BB0\u5F55" })] })), !isLoading && history && history.length > 0 && (_jsx("div", { className: "space-y-3", children: history.map((entry) => (_jsxs("div", { className: "p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]", children: [!isEpisodeHistory && (_jsxs("div", { className: "text-sm font-medium text-[var(--color-text)] mb-2", children: ["S", String(entry.seasonNumber).padStart(2, "0"), " ", "\u00B7 E", String(entry.episodeNumber).padStart(2, "0"), entry.episodeTitle &&
                                        ` - ${entry.episodeTitle}`] })), _jsx("div", { className: "text-xs text-[var(--color-text-muted)] mb-3", children: formatWatchedAt(entry.watchedAt) }), confirmingDelete === entry.id ? (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs text-[var(--color-text-muted)]", children: "\u786E\u8BA4\u5220\u9664\u6B64\u8BB0\u5F55\uFF1F" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setConfirmingDelete(null), className: "flex-1 text-xs", children: "\u53D6\u6D88" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: () => handleDelete(entry.id), disabled: deletingId === entry.id, className: "flex-1 text-xs", children: deletingId === entry.id
                                                    ? "删除中..."
                                                    : "确认删除" })] })] })) : (_jsxs("button", { onClick: () => setConfirmingDelete(entry.id), className: "flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors", children: [_jsx(Trash2, { size: 12 }), "\u5220\u9664\u8BB0\u5F55"] }))] }, entry.id))) })), error && (_jsx("div", { className: "mt-4 p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-sm text-red-400", children: error }))] }) }));
}
//# sourceMappingURL=WatchHistoryPanel.js.map