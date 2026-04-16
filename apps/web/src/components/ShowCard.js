import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tv2, CheckCircle2, PlayCircle } from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { tmdbImage, formatEpisode } from "../lib/utils";
const STATUS_COLOR = {
    "returning series": "var(--color-airing)",
    ended: "var(--color-ended)",
    canceled: "var(--color-error)",
    "in production": "var(--color-airing)",
};
export function ShowCard({ progress, index }) {
    const { show, watchedEpisodes, airedEpisodes, nextEpisode, completed, percentage, } = progress;
    const poster = tmdbImage(show.posterPath, "w300");
    const statusColor = STATUS_COLOR[show.status] || "var(--color-text-muted)";
    const [imgError, setImgError] = useState(false);
    // Task 13: multilingual title logic
    const primaryTitle = show.translatedName ?? show.title;
    const secondaryTitle = show.translatedName
        ? (show.originalName ?? null)
        : null;
    return (_jsx(motion.div, { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: {
            duration: 0.3,
            delay: Math.min(index * 0.03, 0.4),
            ease: [0.16, 1, 0.3, 1],
        }, children: _jsx(Link, { to: `/shows/${show.id}`, style: { textDecoration: "none", display: "block" }, children: _jsxs(motion.div, { whileHover: {
                    y: -3,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                }, transition: { duration: 0.15 }, className: "rounded-xl overflow-hidden", style: {
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-subtle)",
                    cursor: "pointer",
                }, children: [_jsxs("div", { style: {
                            position: "relative",
                            aspectRatio: "2/3",
                            background: "var(--color-surface-3)",
                        }, children: [poster && !imgError ? (_jsx("img", { src: poster, alt: show.title, onError: () => setImgError(true), style: {
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                }, loading: "lazy" })) : (_jsx("div", { style: {
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }, children: _jsx(Tv2, { size: 32, style: {
                                        color: "var(--color-text-muted)",
                                        opacity: 0.3,
                                    } }) })), completed && (_jsxs("div", { style: {
                                    position: "absolute",
                                    top: "8px",
                                    right: "8px",
                                    background: "rgba(0,0,0,0.7)",
                                    borderRadius: "999px",
                                    padding: "3px 8px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "11px",
                                    color: "var(--color-watched)",
                                    backdropFilter: "blur(4px)",
                                }, children: [_jsx(CheckCircle2, { size: 11 }), "\u5B8C\u7ED3"] })), _jsx("div", { style: {
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: "24px 10px 8px",
                                    background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
                                }, children: _jsx(ProgressBar, { watched: watchedEpisodes, aired: airedEpisodes, total: show.totalEpisodes, compact: true, showLabel: false }) })] }), _jsxs("div", { style: { padding: "10px 12px 12px" }, children: [_jsx("h3", { className: "truncate", style: {
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: "var(--color-text)",
                                    letterSpacing: "-0.01em",
                                    lineHeight: 1.3,
                                    marginBottom: secondaryTitle ? "2px" : "4px",
                                }, title: primaryTitle, children: primaryTitle }), secondaryTitle && (_jsx("p", { className: "truncate", style: {
                                    fontSize: "11px",
                                    color: "var(--color-text-muted)",
                                    marginBottom: "4px",
                                    lineHeight: 1.3,
                                }, title: secondaryTitle, children: secondaryTitle })), _jsxs("div", { className: "flex items-center gap-1.5 mb-3", children: [_jsx("span", { style: {
                                            display: "inline-block",
                                            width: "5px",
                                            height: "5px",
                                            borderRadius: "50%",
                                            background: statusColor,
                                            flexShrink: 0,
                                        } }), _jsx("span", { className: "truncate", style: {
                                            fontSize: "11px",
                                            color: "var(--color-text-muted)",
                                        }, children: show.network || show.status })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { style: {
                                            fontSize: "11px",
                                            color: "var(--color-text-muted)",
                                        }, children: [_jsx("span", { style: {
                                                    color: "var(--color-watched)",
                                                    fontWeight: 500,
                                                }, children: watchedEpisodes }), " / ", airedEpisodes] }), _jsxs("span", { style: {
                                            fontSize: "11px",
                                            color: "var(--color-text-muted)",
                                            fontWeight: 500,
                                        }, children: [percentage, "%"] })] }), nextEpisode && !completed && (_jsx("div", { className: "flex items-center justify-end mt-1.5", children: _jsxs("span", { className: "flex items-center gap-1", style: {
                                        fontSize: "10px",
                                        color: "var(--color-accent)",
                                    }, children: [_jsx(PlayCircle, { size: 10 }), formatEpisode(nextEpisode.seasonNumber, nextEpisode.episodeNumber)] }) }))] })] }) }) }));
}
//# sourceMappingURL=ShowCard.js.map