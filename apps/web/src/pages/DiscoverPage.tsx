import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, TrendingUp, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useDiscover, useAddToWatchlist, useRemoveFromWatchlist, useWatchlist } from "../hooks";
import { tmdbImage } from "../lib/image";
import { t } from "../lib/i18n";

type MediaType = "show" | "movie";
type Tab = "trending" | "popular";

const MEDIA_TABS: { key: MediaType; labelKey: string }[] = [
    { key: "show", labelKey: "discover.shows" },
    { key: "movie", labelKey: "discover.movies" },
];

const CONTENT_TABS: { key: Tab; icon: typeof Flame; labelKey: string }[] = [
    { key: "trending", icon: Flame, labelKey: "discover.trending" },
    { key: "popular", icon: TrendingUp, labelKey: "discover.popular" },
];

function PosterPlaceholder({ title }: { title: string }) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                background: "var(--color-surface-3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
            }}
        >
            <span
                style={{
                    fontSize: "11px",
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                }}
            >
                {title}
            </span>
        </div>
    );
}

export default function DiscoverPage() {
    const [mediaType, setMediaType] = useState<MediaType>("show");
    const [tab, setTab] = useState<Tab>("trending");

    const { data: items, isLoading, error } = useDiscover(mediaType, tab);
    const { data: watchlistItems } = useWatchlist();
    const addToWatchlist = useAddToWatchlist();
    const removeFromWatchlist = useRemoveFromWatchlist();

    const watchlistIdSet = new Set(
        watchlistItems?.flatMap((w) => ("show" in w ? [w.show.id] : [w.movie.id])) ?? [],
    );

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)]">
            <div className="app-container py-8">
                {/* Page header */}
                <div className="mb-6 flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg border border-[var(--action-cyan-border)] bg-[var(--action-cyan-surface)] text-[var(--action-cyan-text)]">
                        <TrendingUp className="size-[15px]" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-semibold leading-tight">
                            {t("discover.title")}
                        </h1>
                        <span className="text-xs text-[var(--color-text-muted)]">
                            {t("discover.subtitle")}
                        </span>
                    </div>
                </div>

                {/* Media type tabs */}
                <div
                    style={{
                        display: "flex",
                        gap: "4px",
                        marginBottom: "16px",
                        background: "var(--color-surface-2)",
                        borderRadius: "10px",
                        padding: "4px",
                        width: "fit-content",
                    }}
                >
                    {MEDIA_TABS.map(({ key, labelKey }) => (
                        <button
                            key={key}
                            onClick={() => setMediaType(key)}
                            style={{
                                padding: "6px 16px",
                                borderRadius: "7px",
                                border: "none",
                                fontSize: "13px",
                                fontWeight: 600,
                                cursor: "pointer",
                                background:
                                    mediaType === key ? "var(--color-surface)" : "transparent",
                                color:
                                    mediaType === key
                                        ? "var(--color-text)"
                                        : "var(--color-text-muted)",
                                boxShadow:
                                    mediaType === key ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                                transition: "all 0.15s",
                            }}
                        >
                            {t(labelKey)}
                        </button>
                    ))}
                </div>

                {/* Trending / Popular tabs */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
                    {CONTENT_TABS.map(({ key, icon: Icon, labelKey }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 14px",
                                borderRadius: "8px",
                                border:
                                    tab === key
                                        ? "1px solid var(--color-accent)"
                                        : "1px solid var(--color-border-subtle)",
                                background: tab === key ? "rgba(37,244,238,0.08)" : "transparent",
                                color:
                                    tab === key ? "var(--color-accent)" : "var(--color-text-muted)",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s",
                            }}
                        >
                            <Icon size={13} />
                            {t(labelKey)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {isLoading ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "240px",
                            color: "var(--color-text-muted)",
                            gap: "8px",
                        }}
                    >
                        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                        <span style={{ fontSize: "13px" }}>{t("common.loading")}</span>
                    </div>
                ) : error ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "48px 0",
                            color: "var(--color-text-muted)",
                            fontSize: "13px",
                        }}
                    >
                        {t("discover.error")}
                    </div>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                            gap: "16px",
                        }}
                    >
                        {(items ?? []).map((item, i) => {
                            const inWl = item.localId
                                ? watchlistIdSet.has(item.localId)
                                : item.inWatchlist;
                            const isPending =
                                addToWatchlist.isPending || removeFromWatchlist.isPending;

                            const detailPath =
                                item.type === "show" && item.localId
                                    ? `/shows/${item.localId}`
                                    : item.type === "movie" && item.localId
                                      ? `/movies/${item.localId}`
                                      : null;

                            return (
                                <motion.div
                                    key={`${item.traktId}-${item.type}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.4) }}
                                    style={{ position: "relative" }}
                                >
                                    {/* Rank badge */}
                                    {tab === "trending" && item.watchers != null && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "6px",
                                                left: "6px",
                                                zIndex: 2,
                                                background: "rgba(0,0,0,0.7)",
                                                borderRadius: "5px",
                                                padding: "2px 6px",
                                                fontSize: "10px",
                                                color: "var(--color-accent)",
                                                fontWeight: 700,
                                                backdropFilter: "blur(4px)",
                                            }}
                                        >
                                            {item.watchers.toLocaleString()}{" "}
                                            {t("discover.watching")}
                                        </div>
                                    )}

                                    {/* Watchlist toggle */}
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (isPending || !item.localId) return;
                                            if (inWl) {
                                                removeFromWatchlist.mutate(item.localId);
                                            } else {
                                                addToWatchlist.mutate({
                                                    type: item.type,
                                                    id: item.localId,
                                                });
                                            }
                                        }}
                                        disabled={isPending || !item.localId}
                                        title={
                                            inWl
                                                ? t("discover.removeWatchlist")
                                                : t("discover.addWatchlist")
                                        }
                                        style={{
                                            position: "absolute",
                                            top: "6px",
                                            right: "6px",
                                            zIndex: 2,
                                            width: "26px",
                                            height: "26px",
                                            borderRadius: "6px",
                                            border: "none",
                                            background: inWl
                                                ? "var(--color-accent)"
                                                : "rgba(0,0,0,0.65)",
                                            color: inWl ? "#000" : "var(--color-text-muted)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: item.localId ? "pointer" : "default",
                                            opacity: !item.localId ? 0.3 : 1,
                                            backdropFilter: "blur(4px)",
                                            transition: "background 0.15s, color 0.15s",
                                        }}
                                    >
                                        {inWl ? (
                                            <BookmarkCheck size={13} />
                                        ) : (
                                            <Bookmark size={13} />
                                        )}
                                    </button>

                                    {/* Card */}
                                    <div
                                        style={{
                                            borderRadius: "10px",
                                            overflow: "hidden",
                                            background: "var(--color-surface)",
                                            border: "1px solid var(--color-border-subtle)",
                                            boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                                            transition: "transform 0.15s, box-shadow 0.15s",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = "translateY(-3px)";
                                            e.currentTarget.style.boxShadow =
                                                "0 8px 24px rgba(0,0,0,0.22)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "";
                                            e.currentTarget.style.boxShadow =
                                                "0 2px 12px rgba(0,0,0,0.12)";
                                        }}
                                    >
                                        {/* Poster */}
                                        <div style={{ aspectRatio: "2/3", overflow: "hidden" }}>
                                            {detailPath ? (
                                                <Link
                                                    to={detailPath}
                                                    style={{ display: "block", height: "100%" }}
                                                >
                                                    {item.posterPath ? (
                                                        <img
                                                            src={
                                                                tmdbImage(
                                                                    item.posterPath,
                                                                    "w342",
                                                                ) ?? undefined
                                                            }
                                                            alt={item.title}
                                                            loading="lazy"
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                objectFit: "cover",
                                                            }}
                                                        />
                                                    ) : (
                                                        <PosterPlaceholder title={item.title} />
                                                    )}
                                                </Link>
                                            ) : item.posterPath ? (
                                                <img
                                                    src={
                                                        tmdbImage(item.posterPath, "w342") ??
                                                        undefined
                                                    }
                                                    alt={item.title}
                                                    loading="lazy"
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "cover",
                                                    }}
                                                />
                                            ) : (
                                                <PosterPlaceholder title={item.title} />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div style={{ padding: "8px 10px 10px" }}>
                                            {detailPath ? (
                                                <Link
                                                    to={detailPath}
                                                    style={{ textDecoration: "none" }}
                                                >
                                                    <p
                                                        style={{
                                                            fontSize: "12px",
                                                            fontWeight: 600,
                                                            color: "var(--color-text)",
                                                            margin: 0,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {item.title}
                                                    </p>
                                                </Link>
                                            ) : (
                                                <p
                                                    style={{
                                                        fontSize: "12px",
                                                        fontWeight: 600,
                                                        color: "var(--color-text)",
                                                        margin: 0,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {item.title}
                                                </p>
                                            )}
                                            {item.year && (
                                                <p
                                                    style={{
                                                        fontSize: "11px",
                                                        color: "var(--color-text-muted)",
                                                        margin: "2px 0 0",
                                                    }}
                                                >
                                                    {item.year}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
