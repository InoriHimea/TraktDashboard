/**
 * SeasonTab — 竖版海报卡片，选中时有 layoutId 滑动高亮动画
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { resolveShowPoster } from "../lib/image";
import type { SeasonProgress } from "@trakt-dashboard/types";

interface SeasonTabProps {
    season: SeasonProgress;
    isActive: boolean;
    onClick: () => void;
}

export function SeasonTab({ season, isActive, onClick }: SeasonTabProps) {
    const [imgError, setImgError] = useState(false);
    const posterUrl = resolveShowPoster(season.posterPath, "w342");
    const showImg = posterUrl && !imgError;
    const isComplete =
        season.watchedCount >= season.airedCount && season.airedCount > 0;

    return (
        <motion.button
            onClick={onClick}
            whileTap={{ scale: 0.95 }}
            role="tab"
            aria-selected={isActive}
            aria-label={
                season.seasonNumber === 0
                    ? "Specials"
                    : `Season ${season.seasonNumber}`
            }
            className="relative overflow-visible flex flex-col items-center gap-5 shrink-0 group focus-visible:outline-none py-2"
        >
            {/* 海报 */}
            <div className="relative overflow-visible">
                <motion.div
                    className={[
                        "rounded-lg overflow-hidden transition-shadow duration-200",
                        isActive
                            ? "shadow-lg shadow-[var(--color-accent)]/30"
                            : "group-hover:shadow-md group-hover:shadow-black/30",
                    ].join(" ")}
                    animate={{ scale: isActive ? 1.03 : 1 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        width: "208px",
                        height: "313px",
                        transformOrigin: "top center",
                    }}
                >
                    {showImg ? (
                        <img
                            src={posterUrl}
                            alt={`Season ${season.seasonNumber}`}
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-white/5">
                            <span className="text-2xl text-white/40 font-black tracking-wider">
                                {season.seasonNumber === 0
                                    ? "SP"
                                    : `S${season.seasonNumber}`}
                            </span>
                        </div>
                    )}

                    {/* 选中时的紫色边框 overlay */}
                    {isActive && (
                        <motion.div
                            layoutId="season-active-ring"
                            className="absolute inset-0 rounded-lg ring-2 ring-[var(--color-accent)]"
                            transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 30,
                            }}
                        />
                    )}
                </motion.div>

                {/* 完成徽章 — 在 overflow:hidden 外面，不被裁剪 */}
                {isComplete && (
                    <div className="absolute top-2 right-2 z-10">
                        <div
                            style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                background:
                                    "linear-gradient(145deg, #4ade80, #16a34a)",
                                boxShadow:
                                    "0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(74,222,128,0.6), inset 0 1px 1px rgba(255,255,255,0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CheckCircle2
                                size={18}
                                strokeWidth={2.5}
                                className="text-white drop-shadow"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 季名 */}
            <motion.span
                className="text-[12px] font-medium leading-none"
                animate={{
                    color: isActive
                        ? "var(--color-text)"
                        : "var(--color-text-muted)",
                }}
                transition={{ duration: 0.15 }}
            >
                {season.seasonNumber === 0
                    ? "Specials"
                    : `Season ${season.seasonNumber}`}
            </motion.span>
        </motion.button>
    );
}
