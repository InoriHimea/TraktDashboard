import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SeasonTab — 竖版海报卡片，选中时有 layoutId 滑动高亮动画
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { resolveShowPoster } from "../lib/image";
export function SeasonTab({ season, isActive, onClick }) {
    const [imgError, setImgError] = useState(false);
    const posterUrl = resolveShowPoster(season.posterPath, "w342");
    const showImg = posterUrl && !imgError;
    const isComplete = season.watchedCount >= season.airedCount && season.airedCount > 0;
    return (_jsxs(motion.button, { onClick: onClick, whileTap: { scale: 0.95 }, role: "tab", "aria-selected": isActive, "aria-label": season.seasonNumber === 0
            ? "Specials"
            : `Season ${season.seasonNumber}`, className: "relative overflow-visible flex flex-col items-center gap-5 shrink-0 group focus-visible:outline-none py-2", children: [_jsxs("div", { className: "relative overflow-visible", children: [_jsxs(motion.div, { className: [
                            "rounded-lg overflow-hidden transition-shadow duration-200",
                            isActive
                                ? "shadow-lg shadow-[var(--color-accent)]/30"
                                : "group-hover:shadow-md group-hover:shadow-black/30",
                        ].join(" "), animate: { scale: isActive ? 1.03 : 1 }, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] }, style: {
                            width: "208px",
                            height: "313px",
                            transformOrigin: "top center",
                        }, children: [showImg ? (_jsx("img", { src: posterUrl, alt: `Season ${season.seasonNumber}`, className: "w-full h-full object-cover", onError: () => setImgError(true) })) : (_jsx("div", { className: "w-full h-full bg-[var(--color-surface-3)] flex items-center justify-center", children: _jsx("span", { className: "text-[11px] text-white/30 font-bold", children: season.seasonNumber === 0
                                        ? "SP"
                                        : `S${season.seasonNumber}` }) })), isActive && (_jsx(motion.div, { layoutId: "season-active-ring", className: "absolute inset-0 rounded-lg ring-2 ring-[var(--color-accent)]", transition: {
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 30,
                                } }))] }), isComplete && (_jsx("div", { className: "absolute top-2 right-2 z-10", children: _jsx("div", { style: {
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                background: "linear-gradient(145deg, #4ade80, #16a34a)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(74,222,128,0.6), inset 0 1px 1px rgba(255,255,255,0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }, children: _jsx(CheckCircle2, { size: 18, strokeWidth: 2.5, className: "text-white drop-shadow" }) }) }))] }), _jsx(motion.span, { className: "text-[12px] font-medium leading-none", animate: {
                    color: isActive
                        ? "var(--color-text)"
                        : "var(--color-text-muted)",
                }, transition: { duration: 0.15 }, children: season.seasonNumber === 0
                    ? "Specials"
                    : `Season ${season.seasonNumber}` })] }));
}
//# sourceMappingURL=SeasonTab.js.map