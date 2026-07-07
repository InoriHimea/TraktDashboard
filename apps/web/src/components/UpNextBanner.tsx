import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Play } from "lucide-react";
import { useUpNext, useMarkEpisodeWatched } from "../hooks";
import { tmdbImage } from "../lib/image";
import { t } from "../lib/i18n";
import type { UpNextItem } from "@trakt-dashboard/types";

export function UpNextBanner() {
    const { data: items, isLoading } = useUpNext();
    const markWatched = useMarkEpisodeWatched();
    const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
    const [markingIds, setMarkingIds] = useState<Set<number>>(new Set());
    const scrollRef = useRef<HTMLDivElement>(null);

    if (isLoading || !items || items.length === 0) return null;

    async function handleMark(item: UpNextItem) {
        const epId = item.nextEpisode.id;
        if (markingIds.has(epId) || doneIds.has(epId)) return;
        setMarkingIds((prev) => new Set(prev).add(epId));
        try {
            await markWatched.mutateAsync({
                showId: item.showId,
                seasonNumber: item.nextEpisode.seasonNumber,
                episodeNumber: item.nextEpisode.episodeNumber,
            });
            setDoneIds((prev) => new Set(prev).add(epId));
        } catch {
            // silently ignore
        } finally {
            setMarkingIds((prev) => {
                const next = new Set(prev);
                next.delete(epId);
                return next;
            });
        }
    }

    return (
        <div style={{ marginBottom: "20px" }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                }}
            >
                <Play size={13} style={{ color: "var(--color-accent)" }} />
                <span
                    style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                    }}
                >
                    {t("upNext.title")}
                </span>
                <span
                    style={{
                        fontSize: "11px",
                        color: "var(--color-text-muted)",
                        opacity: 0.6,
                    }}
                >
                    {items.length}
                </span>
            </div>

            <div
                ref={scrollRef}
                style={{
                    display: "flex",
                    gap: "10px",
                    overflowX: "auto",
                    paddingBottom: "6px",
                    scrollbarWidth: "none",
                }}
            >
                {items.map((item) => {
                    const ep = item.nextEpisode;
                    const still = ep.stillPath
                        ? tmdbImage(ep.stillPath, "w300")
                        : item.posterPath
                          ? tmdbImage(item.posterPath, "w154")
                          : null;
                    const epCode = `S${String(ep.seasonNumber).padStart(2, "0")}·E${String(ep.episodeNumber).padStart(2, "0")}`;
                    const isMarking = markingIds.has(ep.id);
                    const isDone = doneIds.has(ep.id);

                    return (
                        <div
                            key={ep.id}
                            role="presentation"
                            style={{
                                flexShrink: 0,
                                width: "180px",
                                borderRadius: "10px",
                                border: "1px solid var(--color-border)",
                                background: "var(--color-surface-2)",
                                overflow: "hidden",
                                position: "relative",
                                transition: "border-color 0.15s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.borderColor =
                                    "var(--color-border-hover, var(--color-accent))")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.borderColor = "var(--color-border)")
                            }
                        >
                            {/* Still / Poster */}
                            <Link
                                to={`/shows/${item.showId}/seasons/${ep.seasonNumber}/episodes/${ep.episodeNumber}`}
                                style={{ display: "block", textDecoration: "none" }}
                            >
                                <div
                                    style={{
                                        width: "100%",
                                        aspectRatio: "16/9",
                                        background: "var(--color-surface-3)",
                                        overflow: "hidden",
                                        position: "relative",
                                    }}
                                >
                                    {still ? (
                                        <img
                                            src={still}
                                            alt=""
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Play
                                                size={20}
                                                style={{ color: "var(--color-text-muted)" }}
                                            />
                                        </div>
                                    )}

                                    {/* Episode code badge */}
                                    <span
                                        style={{
                                            position: "absolute",
                                            bottom: "5px",
                                            left: "6px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            letterSpacing: "0.05em",
                                            color: "#fff",
                                            background: "rgba(0,0,0,0.62)",
                                            borderRadius: "5px",
                                            padding: "2px 6px",
                                        }}
                                    >
                                        {epCode}
                                    </span>
                                </div>
                            </Link>

                            {/* Info */}
                            <div style={{ padding: "8px 10px 10px" }}>
                                <p
                                    style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        color: "var(--color-text-muted)",
                                        margin: "0 0 2px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {item.showTitle}
                                </p>
                                <p
                                    style={{
                                        fontSize: "12px",
                                        fontWeight: 500,
                                        color: "var(--color-text)",
                                        margin: "0 0 8px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        minHeight: "18px",
                                    }}
                                >
                                    {ep.title ?? epCode}
                                </p>

                                {/* Mark watched button */}
                                <button
                                    onClick={() => handleMark(item)}
                                    disabled={isMarking || isDone}
                                    title={isDone ? t("upNext.marked") : t("upNext.markWatched")}
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "5px",
                                        padding: "5px 0",
                                        borderRadius: "7px",
                                        border: isDone
                                            ? "1px solid var(--color-watched)"
                                            : "1px solid var(--color-border)",
                                        background: isDone
                                            ? "rgba(49,245,168,0.08)"
                                            : "var(--color-surface-3)",
                                        color: isDone
                                            ? "var(--color-watched)"
                                            : "var(--color-text-secondary)",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: isDone ? "default" : "pointer",
                                        transition: "all 0.15s",
                                    }}
                                >
                                    {isMarking ? (
                                        <Loader2
                                            size={11}
                                            style={{ animation: "spin 1s linear infinite" }}
                                        />
                                    ) : (
                                        <Check size={11} />
                                    )}
                                    <span>
                                        {isDone ? t("upNext.marked") : t("upNext.markWatched")}
                                    </span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
