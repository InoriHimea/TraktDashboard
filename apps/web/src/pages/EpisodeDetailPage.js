import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useEpisodeDetail } from "../hooks";
import { EpisodeInfoCard } from "../components/EpisodeInfoCard";
import { EpisodeSeasonStrip } from "../components/EpisodeSeasonStrip";
import { WatchActionPanel } from "../components/WatchActionPanel";
import { WatchHistoryPanel } from "../components/WatchHistoryPanel";
import { Button } from "../components/ui/Button";
function EpisodeDetailSkeleton() {
    return (_jsx("div", { style: {
            flex: 1,
            background: "var(--color-bg)",
            padding: "40px 0",
        }, children: _jsxs("div", { style: {
                maxWidth: 1100,
                margin: "0 auto",
                padding: "0 40px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
            }, children: [_jsx("div", { style: {
                        width: 80,
                        height: 20,
                        borderRadius: 6,
                        background: "var(--color-surface-3)",
                        animation: "pulse 1.5s infinite",
                    } }), _jsx("div", { style: {
                        width: "100%",
                        height: 280,
                        borderRadius: 16,
                        background: "var(--color-surface)",
                    } }), _jsx("div", { style: {
                        width: "100%",
                        height: 220,
                        borderRadius: 16,
                        background: "var(--color-surface)",
                    } })] }) }));
}
function PageError({ onRetry }) {
    return (_jsx("div", { style: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        }, children: _jsxs("div", { style: {
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
            }, children: [_jsx("p", { style: { color: "var(--color-text-muted)", fontSize: 14 }, children: "\u52A0\u8F7D\u5931\u8D25" }), _jsx(Button, { variant: "secondary", size: "md", icon: _jsx(RefreshCw, { size: 14 }), onClick: onRetry, children: "\u91CD\u8BD5" })] }) }));
}
export default function EpisodeDetailPage() {
    const { showId, season, episode } = useParams();
    const navigate = useNavigate();
    const showIdNum = Number(showId);
    const seasonNum = Number(season);
    const episodeNum = Number(episode);
    const isValidParams = !!showId &&
        !!season &&
        !!episode &&
        Number.isInteger(showIdNum) &&
        Number.isInteger(seasonNum) &&
        Number.isInteger(episodeNum) &&
        showIdNum > 0 &&
        seasonNum >= 0 &&
        episodeNum > 0;
    // All hooks must be called unconditionally before any conditional return
    const { data, isLoading, error, refetch } = useEpisodeDetail(isValidParams ? showIdNum : 0, isValidParams ? seasonNum : 0, isValidParams ? episodeNum : 0);
    const [watchPanelOpen, setWatchPanelOpen] = useState(false);
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    if (!isValidParams) {
        return _jsx(Navigate, { to: "/progress", replace: true });
    }
    if (isLoading)
        return _jsx(EpisodeDetailSkeleton, {});
    if (error)
        return _jsx(PageError, { onRetry: () => refetch() });
    if (!data)
        return (_jsx("div", { style: {
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-muted)",
                fontSize: 14,
            }, children: "\u672A\u627E\u5230\u8BE5\u96C6" }));
    return (_jsxs("main", { style: {
            flex: 1,
            background: "var(--color-bg)",
            color: "var(--color-text)",
        }, children: [_jsxs("div", { style: {
                    maxWidth: 1200,
                    margin: "0 auto",
                    padding: "48px 40px 56px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 28,
                }, children: [_jsxs("button", { onClick: () => navigate(-1), style: {
                            alignSelf: "flex-start",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--color-text-muted)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px 0",
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = "var(--color-text)"), onMouseLeave: (e) => (e.currentTarget.style.color =
                            "var(--color-text-muted)"), children: [_jsx(ArrowLeft, { size: 15 }), "\u8FD4\u56DE"] }), _jsx(EpisodeInfoCard, { data: data, onWatchClick: () => setWatchPanelOpen(true), onHistoryClick: () => setHistoryPanelOpen(true) }), _jsx(EpisodeSeasonStrip, { episodes: data.seasonEpisodes, seasonNumber: data.seasonNumber, currentEpisodeNumber: data.episodeNumber, showId: data.showId })] }), _jsx(WatchActionPanel, { open: watchPanelOpen, onClose: () => setWatchPanelOpen(false), episodeId: data.episodeId, showId: data.showId, seasonNumber: data.seasonNumber, episodeNumber: data.episodeNumber, airDate: data.airDate, onSuccess: () => refetch() }), _jsx(WatchHistoryPanel, { open: historyPanelOpen, onClose: () => setHistoryPanelOpen(false), showId: data.showId, seasonNumber: data.seasonNumber, episodeNumber: data.episodeNumber, onDeleted: () => refetch() })] }));
}
//# sourceMappingURL=EpisodeDetailPage.js.map