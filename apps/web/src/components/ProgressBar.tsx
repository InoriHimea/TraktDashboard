import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { t } from "../lib/i18n";

interface ProgressBarProps {
    watched: number;
    aired: number;
    total: number;
    compact?: boolean;
    showLabel?: boolean;
}

export function ProgressBar({
    watched,
    aired,
    total,
    compact = false,
    showLabel = true,
}: ProgressBarProps) {
    const watchedPct = aired > 0 ? (watched / aired) * 100 : 0;
    const airedPct = total > 0 ? (aired / total) * 100 : 100;
    const unairedPct = 100 - airedPct;

    // Track height: compact = 2px pill, normal = 4px
    const trackH = compact ? "2px" : "4px";

    return (
        <div className="w-full">
            {showLabel && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums">
                        <span className="text-[var(--color-accent)] font-semibold">{watched}</span>
                        <span> / {t("episode.airedCount", { n: aired })}</span>
                        {unairedPct > 0 && total > aired && (
                            <span className="text-[var(--color-text-muted)] opacity-60">
                                {" · "}
                                {t("episode.unairedCountNum", { n: total - aired })}
                            </span>
                        )}
                    </span>
                    <span
                        className={cn(
                            "text-[12px] font-semibold tabular-nums",
                            watchedPct >= 100
                                ? "text-[var(--color-watched)]"
                                : "text-[var(--color-accent)]",
                        )}
                    >
                        {Math.round(watchedPct)}%
                    </span>
                </div>
            )}

            {/* Track */}
            <div
                className={cn(
                    "relative w-full overflow-hidden flex rounded-full bg-[var(--color-surface-3)]",
                )}
                style={{ height: trackH }}
            >
                {/* Watched — accent purple */}
                <motion.div
                    className="h-full bg-[var(--color-accent)] rounded-l-full"
                    style={{ minWidth: watched > 0 ? "3px" : 0 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(watched / Math.max(total, 1)) * 100}%` }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
                {/* Aired but unwatched — dim surface */}
                <motion.div
                    className="h-full bg-[var(--color-surface-4)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${((aired - watched) / Math.max(total, 1)) * 100}%` }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                />
                {/* Not yet aired — transparent (track bg shows through) */}
                <div className="flex-1 h-full" />
            </div>
        </div>
    );
}
