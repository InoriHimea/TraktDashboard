import { useEffect, useRef, useState } from "react";
import { tmdbImage } from "../lib/image";
import { AnimatePresence, motion } from "framer-motion";
import { Tv2 } from "lucide-react";
import type { NowPlayingEpisode } from "@trakt-dashboard/types";

interface NowPlayingPopupProps {
    data: NowPlayingEpisode | null;
    isLoading: boolean;
    isOpen: boolean;
    onClose: () => void;
}

// ─── Pure helpers (exported for property tests) ───────────────────────────────

export function computeRemainingMinutes(
    expiresAt: string,
    now = Date.now(),
): number {
    return Math.max(
        0,
        Math.round((new Date(expiresAt).getTime() - now) / 60_000),
    );
}

export function computeProgressPct(
    runtime: number | null,
    remainingMinutes: number,
): number {
    if (runtime == null || runtime <= 0) return 0;
    const elapsed = runtime - remainingMinutes;
    return Math.min(100, Math.max(0, (elapsed / runtime) * 100));
}

export function formatSeasonEpisode(
    seasonNumber: number,
    episodeNumber: number,
): string {
    return `S${seasonNumber}·E${episodeNumber}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
    return (
        <div
            data-testid="now-playing-skeleton"
            style={{ display: "flex", gap: "12px", padding: "16px" }}
        >
            <div
                style={{
                    width: "56px",
                    height: "80px",
                    borderRadius: "6px",
                    background: "var(--color-surface-3)",
                    flexShrink: 0,
                    animation: "pulse 1.5s ease-in-out infinite",
                }}
            />
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    paddingTop: "4px",
                }}
            >
                <div
                    style={{
                        height: "10px",
                        width: "60%",
                        borderRadius: "4px",
                        background: "var(--color-surface-3)",
                    }}
                />
                <div
                    style={{
                        height: "10px",
                        width: "80%",
                        borderRadius: "4px",
                        background: "var(--color-surface-3)",
                    }}
                />
                <div
                    style={{
                        height: "10px",
                        width: "40%",
                        borderRadius: "4px",
                        background: "var(--color-surface-3)",
                    }}
                />
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NowPlayingPopup({
    data,
    isLoading,
    isOpen,
    onClose,
}: NowPlayingPopupProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [posterError, setPosterError] = useState(false);

    // Reset poster error when data changes
    useEffect(() => {
        setPosterError(false);
    }, [data?.show.posterPath]);

    // Click-outside handler
    useEffect(() => {
        if (!isOpen) return;
        function handleClick(e: MouseEvent) {
            if (
                cardRef.current &&
                !cardRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen, onClose]);

    // Escape key handler
    useEffect(() => {
        if (!isOpen) return;
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    const [remainingMinutes, setRemainingMinutes] = useState<number>(() =>
        data ? computeRemainingMinutes(data.expiresAt) : 0,
    );

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

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={cardRef}
                    data-testid="now-playing-popup"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    style={{
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
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "10px 14px 8px",
                            borderBottom: "1px solid var(--color-border)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                        }}
                    >
                        <span
                            style={{
                                display: "inline-block",
                                width: "7px",
                                height: "7px",
                                borderRadius: "50%",
                                background: "var(--color-accent)",
                                animation: "pulse 1.5s ease-in-out infinite",
                            }}
                        />
                        <span
                            style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--color-text)",
                                letterSpacing: "0.02em",
                            }}
                        >
                            Now Playing
                        </span>
                    </div>

                    {/* Body */}
                    {isLoading && !data ? (
                        <Skeleton />
                    ) : data ? (
                        <div
                            style={{
                                padding: "14px",
                                display: "flex",
                                gap: "12px",
                            }}
                        >
                            {/* Poster */}
                            <div
                                style={{
                                    width: "56px",
                                    height: "80px",
                                    borderRadius: "6px",
                                    background: "var(--color-surface-3)",
                                    flexShrink: 0,
                                    overflow: "hidden",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {data.show.posterPath && !posterError ? (
                                    <img
                                        src={
                                            tmdbImage(
                                                data.show.posterPath,
                                                "w92",
                                            ) ?? undefined
                                        }
                                        alt={data.show.title}
                                        onError={() => setPosterError(true)}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                ) : (
                                    <Tv2
                                        size={22}
                                        style={{
                                            color: "var(--color-text-muted)",
                                        }}
                                        data-testid="poster-placeholder"
                                    />
                                )}
                            </div>

                            {/* Info */}
                            <div
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "4px",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: "11px",
                                        color: "var(--color-accent)",
                                        fontWeight: 600,
                                    }}
                                >
                                    {formatSeasonEpisode(
                                        data.episode.seasonNumber,
                                        data.episode.episodeNumber,
                                    )}
                                </span>
                                <p
                                    style={{
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        color: "var(--color-text)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        margin: 0,
                                    }}
                                >
                                    {data.episode.title}
                                </p>
                                <p
                                    style={{
                                        fontSize: "11px",
                                        color: "var(--color-text-muted)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        margin: 0,
                                    }}
                                >
                                    {data.show.title}
                                </p>
                                <span
                                    style={{
                                        fontSize: "11px",
                                        color: "var(--color-text-secondary)",
                                        marginTop: "2px",
                                    }}
                                >
                                    {remainingMinutes} min remaining
                                </span>

                                {/* Progress bar */}
                                {data.runtime != null && (
                                    <div
                                        style={{
                                            marginTop: "6px",
                                            height: "3px",
                                            borderRadius: "999px",
                                            background:
                                                "var(--color-surface-3)",
                                            overflow: "hidden",
                                        }}
                                    >
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{
                                                width: `${progressPct}%`,
                                            }}
                                            transition={{
                                                duration: 0.6,
                                                ease: "easeOut",
                                            }}
                                            style={{
                                                height: "100%",
                                                background:
                                                    "linear-gradient(90deg, var(--color-accent), #a78bfa)",
                                                borderRadius: "999px",
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
