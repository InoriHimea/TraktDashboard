/**
 * EpisodeGrid — 图2风格: 横向滚动的单集缩略图列表
 *
 * 每集: 16:9 缩略图 + 底部时长胶囊 + 已看对勾 + 标题 + S·E 标签
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MoreVertical } from "lucide-react";
import { resolveEpisodeTitle, t } from "../lib/i18n";
import { resolveEpisodeStill, resolveBackdropFallback } from "../lib/image";
import { EpisodePlaceholder } from "./ui/EpisodePlaceholder";
import type { EpisodeProgress } from "@trakt-dashboard/types";

interface EpisodeGridProps {
    episodes: EpisodeProgress[];
    seasonNumber: number;
    showId: number;
    backdropPath?: string | null;
}

export function EpisodeGrid({ episodes, seasonNumber, showId, backdropPath }: EpisodeGridProps) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={seasonNumber}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {/* 横向滚动容器 — 内容多时可滚动，snap 对齐 */}
                <div
                    className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-1 px-1"
                    style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "var(--color-border) transparent",
                    }}
                >
                    {episodes.map((ep, i) => (
                        <EpisodeThumbnail
                            key={ep.episodeId}
                            episode={ep}
                            index={i}
                            seasonNumber={seasonNumber}
                            showId={showId}
                            backdropPath={backdropPath}
                        />
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

// ─── 单集缩略图卡片 ────────────────────────────────────────────────────────────

interface EpisodeThumbnailProps {
    episode: EpisodeProgress;
    index: number;
    seasonNumber: number;
    showId: number;
    backdropPath?: string | null;
}

function EpisodeThumbnail({
    episode,
    index,
    seasonNumber,
    showId,
    backdropPath,
}: EpisodeThumbnailProps) {
    const navigate = useNavigate();
    const [imgError, setImgError] = useState(false);

    const title = resolveEpisodeTitle(episode);
    const stillUrl = resolveEpisodeStill(episode.stillPath);
    // Fallback chain: stillPath → backdropPath → placeholder
    const fallbackUrl = resolveBackdropFallback(backdropPath);
    const imageUrl = stillUrl || fallbackUrl;
    const showImg = imageUrl && !imgError;
    const isWatched = episode.watched;
    const isUnaired = episode.aired === false;
    const epCode = `S${String(seasonNumber).padStart(2, "0")} · E${String(episode.episodeNumber).padStart(2, "0")}`;

    const handleClick = () => {
        if (!isUnaired) {
            navigate(`/shows/${showId}/seasons/${seasonNumber}/episodes/${episode.episodeNumber}`);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.25,
                delay: Math.min(index * 0.03, 0.35),
                ease: [0.16, 1, 0.3, 1],
            }}
            className={[
                "shrink-0 snap-start flex w-[292px] flex-col gap-2 group",
                isUnaired ? "opacity-40 cursor-default" : "cursor-pointer",
            ].join(" ")}
            onClick={handleClick}
        >
            {/* 缩略图 */}
            <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface-3)]">
                {showImg ? (
                    <img
                        src={imageUrl}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <EpisodePlaceholder
                        seasonNumber={seasonNumber}
                        episodeNumber={episode.episodeNumber}
                    />
                )}

                {/* 底部渐变 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

                {/* 底部左: 时长胶囊 */}
                {episode.runtime && (
                    <div className="absolute bottom-1.5 left-1.5">
                        <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm leading-none">
                            {t("common.minutes", { n: episode.runtime })}
                        </span>
                    </div>
                )}

                {/* 已看对勾（右上角） */}
                {isWatched && (
                    <div className="absolute top-2 left-2">
                        <div
                            style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "50%",
                                background: "linear-gradient(145deg, #f472b6, #db2777)",
                                boxShadow:
                                    "0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(244,114,182,0.6), inset 0 1px 1px rgba(255,255,255,0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Check size={14} strokeWidth={3} className="text-white" />
                        </div>
                    </div>
                )}

                {/* 未播出标签 */}
                {isUnaired && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-white/50">
                            {t("common.notAired")}
                        </span>
                    </div>
                )}

                {/* 更多按钮 (hover 显示) */}
                {!isUnaired && (
                    <button
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white/70 hover:text-white"
                        aria-label={t("episode.moreOptions")}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MoreVertical size={10} />
                    </button>
                )}
            </div>

            {/* 标题 */}
            <div className="flex min-h-[54px] shrink-0 flex-col gap-1 px-0.5">
                <p
                    className={[
                        "text-[12px] font-medium leading-snug line-clamp-2 transition-colors",
                        isWatched
                            ? "text-[var(--color-text-muted)]"
                            : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]",
                    ].join(" ")}
                >
                    {title}
                </p>
                <span className="h-3 shrink-0 truncate text-[10px] leading-3 text-[var(--color-text-muted)]">
                    {epCode}
                </span>
            </div>
        </motion.div>
    );
}
