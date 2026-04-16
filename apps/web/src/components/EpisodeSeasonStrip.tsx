import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { resolveEpisodeTitle } from "../lib/i18n";
import { resolveEpisodeStill } from "../lib/image";
import { EpisodePlaceholder } from "./ui/EpisodePlaceholder";
import type { EpisodeProgress } from "@trakt-dashboard/types";

interface EpisodeSeasonStripProps {
    episodes: EpisodeProgress[];
    seasonNumber: number;
    currentEpisodeNumber: number;
    showId: number;
}

export function EpisodeSeasonStrip({
    episodes,
    seasonNumber,
    currentEpisodeNumber,
    showId,
}: EpisodeSeasonStripProps) {
    const navigate = useNavigate();
    const currentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentRef.current) {
            currentRef.current.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
            });
        }
    }, [currentEpisodeNumber]);

    const seasonLabel =
        seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{
                    fontSize: 20, fontWeight: 700, margin: 0,
                    color: "var(--color-text-base)",
                    letterSpacing: "-0.01em",
                    display: "flex", alignItems: "center", gap: 12,
                }}>
                    SEASONS
                    <span style={{ display: "inline-block", width: 40, height: 2, background: "rgba(255,255,255,0.1)", borderRadius: 2 }} />
                    <span style={{ color: "var(--color-text-secondary)" }}>{seasonLabel.toUpperCase()}</span>
                </h2>
            </div>

            {/* Horizontal scroll */}
            <div style={{
                display: "flex",
                gap: 20,
                overflowX: "auto",
                paddingTop: 4,
                paddingBottom: 12,
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(255,255,255,0.15) transparent",
            }}>
                {episodes.map((ep) => {
                    const isCurrent = ep.episodeNumber === currentEpisodeNumber;
                    const isUnaired = ep.aired === false;
                    return (
                        <EpisodeThumbnail
                            key={ep.episodeId}
                            episode={ep}
                            seasonNumber={seasonNumber}
                            showId={showId}
                            isCurrent={isCurrent}
                            isUnaired={isUnaired}
                            ref={isCurrent ? currentRef : null}
                            onNavigate={(s, e) => navigate(`/shows/${showId}/seasons/${s}/episodes/${e}`)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// ─── Episode Thumbnail ────────────────────────────────────────────────────────

interface EpisodeThumbnailProps {
    episode: EpisodeProgress;
    seasonNumber: number;
    showId: number;
    isCurrent: boolean;
    isUnaired: boolean;
    onNavigate: (season: number, episode: number) => void;
}

const EpisodeThumbnail = React.forwardRef<
    HTMLDivElement,
    EpisodeThumbnailProps
>(({ episode, seasonNumber, isCurrent, isUnaired, onNavigate }, ref) => {
    const [imgError, setImgError] = useState(false);
    const [hovered, setHovered] = useState(false);

    const title = resolveEpisodeTitle(episode);
    const stillUrl = resolveEpisodeStill(episode.stillPath);
    const showImg = stillUrl && !imgError;
    const isWatched = episode.watched;
    const epCode = `S${String(seasonNumber).padStart(2, "0")} · E${String(episode.episodeNumber).padStart(2, "0")}`;

    return (
        <div
            ref={ref}
            style={{
                width: 280,
                flexShrink: 0,
                cursor: isUnaired ? "default" : "pointer",
                opacity: isUnaired ? 0.5 : 1,
            }}
            onClick={() => !isUnaired && onNavigate(seasonNumber, episode.episodeNumber)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            aria-current={isCurrent ? "true" : undefined}
            aria-label={`${epCode} ${title}`}
        >
            {/* Thumbnail */}
            <div style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16/9",
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: 12,
                background: "var(--color-surface-3)",
                border: "1px solid rgba(255,255,255,0.05)",
                boxShadow: hovered ? "0 12px 32px rgba(0,0,0,0.6)" : "0 4px 16px rgba(0,0,0,0.4)",
                transition: "box-shadow 0.2s ease",
            }}>
                {showImg ? (
                    <img
                        src={stillUrl}
                        alt={title}
                        style={{
                            width: "100%", height: "100%", objectFit: "cover",
                            transform: hovered ? "scale(1.08)" : "scale(1)",
                            transition: "transform 0.5s ease",
                        }}
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <EpisodePlaceholder seasonNumber={seasonNumber} episodeNumber={episode.episodeNumber} />
                )}

                {/* Gradient */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)", pointerEvents: "none" }} />

                {/* Runtime badge — bottom right */}
                {episode.runtime && (
                    <div style={{
                        position: "absolute", bottom: 8, right: 8,
                        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
                        color: "#fff", padding: "2px 7px", borderRadius: 4,
                        fontSize: 10, fontWeight: 700,
                    }}>
                        {episode.runtime}m
                    </div>
                )}

                {/* Watched checkmark — bottom right (replaces runtime position if both) */}
                {isWatched && (
                    <div style={{
                        position: "absolute", bottom: 8, right: episode.runtime ? 52 : 8,
                        width: 22, height: 22, borderRadius: "50%",
                        background: "var(--color-accent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 2px 8px rgba(124,106,247,0.5)",
                    }}>
                        <Check size={11} strokeWidth={3} color="#fff" />
                    </div>
                )}

                {/* Current episode overlay tint */}
                {isCurrent && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(124,106,247,0.1)", mixBlendMode: "overlay", pointerEvents: "none" }} />
                )}

                {/* Unaired */}
                {isUnaired && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 4, background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
                            未播出
                        </span>
                    </div>
                )}
            </div>

            {/* Title */}
            <div>
                <h4 style={{
                    fontSize: 13,
                    fontWeight: 700,
                    margin: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: isCurrent ? "var(--color-accent)" : hovered ? "var(--color-text-base)" : "var(--color-text-secondary)",
                    transition: "color 0.15s",
                }}>
                    {title || `Episode ${episode.episodeNumber}`}
                </h4>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "4px 0 0", fontWeight: 500, letterSpacing: "0.04em" }}>
                    {epCode}
                </p>
            </div>
        </div>
    );
});

EpisodeThumbnail.displayName = "EpisodeThumbnail";
