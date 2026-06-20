import { useEffect, useRef, useState } from "react";
import { tmdbImage } from "../lib/image";
import { AnimatePresence, motion } from "framer-motion";
import { Tv2, CheckCircle2 } from "lucide-react";
import type { NowPlayingEpisode, JellyfinNowPlaying } from "@trakt-dashboard/types";
import { useMarkEpisodeWatched, useMarkMovieWatched } from "../hooks";
import { t } from "../lib/i18n";

interface NowPlayingPopupProps {
    data: NowPlayingEpisode | null;
    jellyfinData?: JellyfinNowPlaying | null;
    isLoading: boolean;
    isOpen: boolean;
    onClose: () => void;
    triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

// ─── Pure helpers (exported for property tests) ───────────────────────────────

export function computeRemainingMinutes(expiresAt: string, now = Date.now()): number {
    return Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 60_000));
}

export function computeProgressPct(runtime: number | null, remainingMinutes: number): number {
    if (runtime == null || runtime <= 0) return 0;
    const elapsed = runtime - remainingMinutes;
    return Math.min(100, Math.max(0, (elapsed / runtime) * 100));
}

export function formatSeasonEpisode(seasonNumber: number, episodeNumber: number): string {
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

function JellyfinBody({ jd, onClose }: { jd: JellyfinNowPlaying; onClose: () => void }) {
    const markEp = useMarkEpisodeWatched();
    const markMovie = useMarkMovieWatched(jd.localMovieId ?? 0);
    const [marked, setMarked] = useState(false);

    const canMark =
        jd.mediaType === "episode"
            ? !!(jd.localShowId && jd.seasonNumber != null && jd.episodeNumber != null)
            : !!jd.localMovieId;

    async function handleMark() {
        if (!canMark || marked) return;
        try {
            if (jd.mediaType === "episode") {
                await markEp.mutateAsync({
                    showId: jd.localShowId!,
                    seasonNumber: jd.seasonNumber!,
                    episodeNumber: jd.episodeNumber!,
                });
            } else {
                await markMovie.mutateAsync(new Date().toISOString());
            }
            setMarked(true);
            setTimeout(onClose, 1000);
        } catch {
            // ignore
        }
    }

    const isPending = markEp.isPending || markMovie.isPending;

    return (
        <div style={{ padding: "14px", display: "flex", gap: "12px" }}>
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
                {jd.posterUrl ? (
                    <img
                        src={jd.posterUrl}
                        alt={jd.seriesTitle ?? jd.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                    />
                ) : (
                    <Tv2 size={22} style={{ color: "var(--color-text-muted)" }} />
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
                {jd.mediaType === "episode" &&
                    jd.seasonNumber != null &&
                    jd.episodeNumber != null && (
                        <span
                            style={{
                                fontSize: "11px",
                                color: "var(--color-accent)",
                                fontWeight: 600,
                            }}
                        >
                            {formatSeasonEpisode(jd.seasonNumber, jd.episodeNumber)}
                        </span>
                    )}
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
                    {jd.mediaType === "episode" ? jd.title : jd.title}
                </p>
                {jd.seriesTitle && (
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
                        {jd.seriesTitle}
                    </p>
                )}
                {jd.isPaused && (
                    <span
                        style={{
                            fontSize: "11px",
                            color: "var(--color-text-secondary)",
                            marginTop: "2px",
                        }}
                    >
                        {t("nowPlaying.paused")}
                    </span>
                )}

                {/* Progress bar */}
                <div
                    style={{
                        marginTop: "6px",
                        height: "3px",
                        borderRadius: "999px",
                        background: "var(--color-surface-3)",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            height: "100%",
                            width: `${jd.progressPct}%`,
                            background: "linear-gradient(90deg, var(--color-accent), #a78bfa)",
                            borderRadius: "999px",
                            transition: "width 0.6s ease",
                        }}
                    />
                </div>

                {/* Mark watched button */}
                {canMark && (
                    <button
                        onClick={handleMark}
                        disabled={isPending || marked}
                        style={{
                            marginTop: "8px",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            background: marked
                                ? "var(--color-watched, #22c55e)"
                                : "var(--color-accent)",
                            border: "none",
                            color: "#fff",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: isPending || marked ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            opacity: isPending ? 0.7 : 1,
                            transition: "background 0.2s",
                        }}
                    >
                        {marked ? (
                            <>
                                <CheckCircle2 size={12} />
                                {t("nowPlaying.marked")}
                            </>
                        ) : (
                            t("nowPlaying.catchUp")
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

export function NowPlayingPopup({
    data,
    jellyfinData,
    isLoading,
    isOpen,
    onClose,
    triggerRef,
}: NowPlayingPopupProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [posterError, setPosterError] = useState(false);
    const [trackedPoster, setTrackedPoster] = useState(data?.show.posterPath);

    // Reset the poster error when the poster changes, during render.
    if (data?.show.posterPath !== trackedPoster) {
        setTrackedPoster(data?.show.posterPath);
        setPosterError(false);
    }

    // Click-outside handler — excludes the trigger button to prevent immediate close
    useEffect(() => {
        if (!isOpen) return;
        function handleClick(e: MouseEvent) {
            const target = e.target as Node;
            if (triggerRef?.current?.contains(target)) return;
            if (cardRef.current && !cardRef.current.contains(target)) {
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen, onClose, triggerRef]);

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
    const [trackedExpiry, setTrackedExpiry] = useState(data?.expiresAt);

    // Re-sync the countdown when the air-time changes, during render.
    if (data?.expiresAt !== trackedExpiry) {
        setTrackedExpiry(data?.expiresAt);
        setRemainingMinutes(data ? computeRemainingMinutes(data.expiresAt) : 0);
    }

    // Tick the countdown every minute while a session is active (interval-only
    // setState is not flagged, unlike a synchronous set in the effect body).
    useEffect(() => {
        if (!data) return;
        const timer = setInterval(() => {
            setRemainingMinutes(computeRemainingMinutes(data.expiresAt));
        }, 60_000);
        return () => clearInterval(timer);
    }, [data]);

    const progressPct = data ? computeProgressPct(data.runtime, remainingMinutes) : 0;

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
                        top: "calc(var(--app-nav-height) + 8px)",
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
                                background:
                                    jellyfinData && !data ? "#06b6d4" : "var(--color-accent)",
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
                            {jellyfinData && !data
                                ? t("nowPlaying.jellyfinTitle")
                                : t("nowPlaying.title")}
                        </span>
                    </div>

                    {/* Body */}
                    {isLoading && !data && !jellyfinData ? (
                        <Skeleton />
                    ) : !data && jellyfinData ? (
                        <JellyfinBody jd={jellyfinData} onClose={onClose} />
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
                                        src={tmdbImage(data.show.posterPath, "w92") ?? undefined}
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
                                            background: "var(--color-surface-3)",
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
