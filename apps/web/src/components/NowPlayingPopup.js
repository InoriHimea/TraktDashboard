import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { tmdbImage } from "../lib/image";
import { AnimatePresence, motion } from "framer-motion";
import { Tv2 } from "lucide-react";
// ─── Pure helpers (exported for property tests) ───────────────────────────────
export function computeRemainingMinutes(expiresAt, now = Date.now()) {
    return Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 60_000));
}
export function computeProgressPct(runtime, remainingMinutes) {
    if (runtime == null || runtime <= 0)
        return 0;
    const elapsed = runtime - remainingMinutes;
    return Math.min(100, Math.max(0, (elapsed / runtime) * 100));
}
export function formatSeasonEpisode(seasonNumber, episodeNumber) {
    return `S${seasonNumber}·E${episodeNumber}`;
}
// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
    return (_jsxs("div", { "data-testid": "now-playing-skeleton", style: { display: "flex", gap: "12px", padding: "16px" }, children: [_jsx("div", { style: {
                    width: "56px",
                    height: "80px",
                    borderRadius: "6px",
                    background: "var(--color-surface-3)",
                    flexShrink: 0,
                    animation: "pulse 1.5s ease-in-out infinite",
                } }), _jsxs("div", { style: {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    paddingTop: "4px",
                }, children: [_jsx("div", { style: {
                            height: "10px",
                            width: "60%",
                            borderRadius: "4px",
                            background: "var(--color-surface-3)",
                        } }), _jsx("div", { style: {
                            height: "10px",
                            width: "80%",
                            borderRadius: "4px",
                            background: "var(--color-surface-3)",
                        } }), _jsx("div", { style: {
                            height: "10px",
                            width: "40%",
                            borderRadius: "4px",
                            background: "var(--color-surface-3)",
                        } })] })] }));
}
// ─── Main component ───────────────────────────────────────────────────────────
export function NowPlayingPopup({ data, isLoading, isOpen, onClose, }) {
    const cardRef = useRef(null);
    const [posterError, setPosterError] = useState(false);
    // Reset poster error when data changes
    useEffect(() => {
        setPosterError(false);
    }, [data?.show.posterPath]);
    // Click-outside handler
    useEffect(() => {
        if (!isOpen)
            return;
        function handleClick(e) {
            if (cardRef.current &&
                !cardRef.current.contains(e.target)) {
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen, onClose]);
    // Escape key handler
    useEffect(() => {
        if (!isOpen)
            return;
        function handleKey(e) {
            if (e.key === "Escape")
                onClose();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);
    const [remainingMinutes, setRemainingMinutes] = useState(() => data ? computeRemainingMinutes(data.expiresAt) : 0);
    useEffect(() => {
        if (!data) {
            setRemainingMinutes(0);
            return;
        }
        setRemainingMinutes(computeRemainingMinutes(data.expiresAt));
        const timer = setInterval(() => {
            setRemainingMinutes(computeRemainingMinutes(data.expiresAt));
        }, 60_000);
        return () => clearInterval(timer);
    }, [data?.expiresAt]);
    const progressPct = data
        ? computeProgressPct(data.runtime, remainingMinutes)
        : 0;
    return (_jsx(AnimatePresence, { children: isOpen && (_jsxs(motion.div, { ref: cardRef, "data-testid": "now-playing-popup", initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 8 }, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] }, style: {
                position: "fixed",
                top: "64px",
                right: "16px",
                zIndex: 50,
                width: "300px",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg, 12px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
                overflow: "hidden",
            }, children: [_jsxs("div", { style: {
                        padding: "10px 14px 8px",
                        borderBottom: "1px solid var(--color-border)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                    }, children: [_jsx("span", { style: {
                                display: "inline-block",
                                width: "7px",
                                height: "7px",
                                borderRadius: "50%",
                                background: "var(--color-accent)",
                                animation: "pulse 1.5s ease-in-out infinite",
                            } }), _jsx("span", { style: {
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--color-text)",
                                letterSpacing: "0.02em",
                            }, children: "Now Playing" })] }), isLoading && !data ? (_jsx(Skeleton, {})) : data ? (_jsxs("div", { style: {
                        padding: "14px",
                        display: "flex",
                        gap: "12px",
                    }, children: [_jsx("div", { style: {
                                width: "56px",
                                height: "80px",
                                borderRadius: "6px",
                                background: "var(--color-surface-3)",
                                flexShrink: 0,
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }, children: data.show.posterPath && !posterError ? (_jsx("img", { src: tmdbImage(data.show.posterPath, "w92") ?? undefined, alt: data.show.title, onError: () => setPosterError(true), style: {
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                } })) : (_jsx(Tv2, { size: 22, style: {
                                    color: "var(--color-text-muted)",
                                }, "data-testid": "poster-placeholder" })) }), _jsxs("div", { style: {
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                            }, children: [_jsx("span", { style: {
                                        fontSize: "11px",
                                        color: "var(--color-accent)",
                                        fontWeight: 600,
                                    }, children: formatSeasonEpisode(data.episode.seasonNumber, data.episode.episodeNumber) }), _jsx("p", { style: {
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        color: "var(--color-text)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        margin: 0,
                                    }, children: data.episode.title }), _jsx("p", { style: {
                                        fontSize: "11px",
                                        color: "var(--color-text-muted)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        margin: 0,
                                    }, children: data.show.title }), _jsxs("span", { style: {
                                        fontSize: "11px",
                                        color: "var(--color-text-secondary)",
                                        marginTop: "2px",
                                    }, children: [remainingMinutes, " min remaining"] }), data.runtime != null && (_jsx("div", { style: {
                                        marginTop: "6px",
                                        height: "3px",
                                        borderRadius: "999px",
                                        background: "var(--color-surface-3)",
                                        overflow: "hidden",
                                    }, children: _jsx(motion.div, { initial: { width: 0 }, animate: {
                                            width: `${progressPct}%`,
                                        }, transition: {
                                            duration: 0.6,
                                            ease: "easeOut",
                                        }, style: {
                                            height: "100%",
                                            background: "linear-gradient(90deg, var(--color-accent), #a78bfa)",
                                            borderRadius: "999px",
                                        } }) }))] })] })) : null] })) }));
}
//# sourceMappingURL=NowPlayingPopup.js.map