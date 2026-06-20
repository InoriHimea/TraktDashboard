import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Archive,
    Tv2,
    Film,
    LayoutGrid,
    RefreshCw,
    Trash2,
    X,
    Loader2,
    AlertTriangle,
} from "lucide-react";
import {
    useCollection,
    useSyncCollection,
    useClearRemoteCollection,
    useRemoveCollectionItem,
} from "../hooks";
import { tmdbImage } from "../lib/image";
import { t } from "../lib/i18n";
import type { UserCollectionItem } from "@trakt-dashboard/types";

type MediaFilter = "all" | "show" | "movie";

const FILTERS: { key: MediaFilter; labelKey: string; icon: typeof Tv2 }[] = [
    { key: "all", labelKey: "common.all", icon: LayoutGrid },
    { key: "show", labelKey: "collection.shows", icon: Tv2 },
    { key: "movie", labelKey: "collection.movies", icon: Film },
];

function formatBadge(item: UserCollectionItem) {
    const parts: string[] = [];
    if (item.mediaFormat) parts.push(item.mediaFormat.replace("_", " ").toUpperCase());
    if (item.resolution)
        parts.push(
            item.resolution === "uhd_4k"
                ? "4K"
                : item.resolution === "hd_1080p"
                  ? "1080p"
                  : item.resolution === "hd_720p"
                    ? "720p"
                    : item.resolution.toUpperCase(),
        );
    if (item.hdr)
        parts.push(
            item.hdr === "dolby_vision"
                ? "DV"
                : item.hdr === "hdr10_plus"
                  ? "HDR10+"
                  : item.hdr.toUpperCase(),
        );
    return parts.join(" · ");
}

function CollectionCard({ item, index }: { item: UserCollectionItem; index: number }) {
    const remove = useRemoveCollectionItem();
    const [confirmRemove, setConfirmRemove] = useState(false);
    const isShow = item.mediaType === "show";
    const detailPath =
        isShow && item.showId
            ? `/shows/${item.showId}`
            : item.movieId
              ? `/movies/${item.movieId}`
              : null;
    const badge = formatBadge(item);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.3) }}
            style={{ position: "relative" }}
        >
            {/* Remove button */}
            {confirmRemove ? (
                <div
                    style={{
                        position: "absolute",
                        top: 5,
                        right: 5,
                        zIndex: 2,
                        display: "flex",
                        gap: 4,
                    }}
                >
                    <button
                        onClick={() =>
                            remove.mutate(item.id, { onSuccess: () => setConfirmRemove(false) })
                        }
                        style={{
                            padding: "3px 8px",
                            borderRadius: 5,
                            border: "none",
                            background: "#ef4444",
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        {t("common.confirm")}
                    </button>
                    <button
                        onClick={() => setConfirmRemove(false)}
                        style={{
                            padding: "3px 6px",
                            borderRadius: 5,
                            border: "none",
                            background: "rgba(0,0,0,0.65)",
                            color: "#fff",
                            fontSize: 10,
                            cursor: "pointer",
                        }}
                    >
                        <X size={10} />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setConfirmRemove(true)}
                    style={{
                        position: "absolute",
                        top: 5,
                        right: 5,
                        zIndex: 2,
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        border: "none",
                        background: "rgba(0,0,0,0.65)",
                        color: "var(--color-text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        backdropFilter: "blur(4px)",
                        transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
                >
                    <X size={11} />
                </button>
            )}

            <div
                style={{
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-subtle)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.18)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)";
                }}
            >
                <div
                    style={{
                        aspectRatio: "2/3",
                        overflow: "hidden",
                        background: "var(--color-surface-3)",
                        position: "relative",
                    }}
                >
                    {detailPath ? (
                        <Link to={detailPath} style={{ display: "block", height: "100%" }}>
                            {item.posterPath ? (
                                <img
                                    src={tmdbImage(item.posterPath, "w342") ?? undefined}
                                    alt={item.title}
                                    loading="lazy"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                                    {isShow ? (
                                        <Tv2 size={28} style={{ opacity: 0.25 }} />
                                    ) : (
                                        <Film size={28} style={{ opacity: 0.25 }} />
                                    )}
                                </div>
                            )}
                        </Link>
                    ) : item.posterPath ? (
                        <img
                            src={tmdbImage(item.posterPath, "w342") ?? undefined}
                            alt={item.title}
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                            {isShow ? (
                                <Tv2 size={28} style={{ opacity: 0.25 }} />
                            ) : (
                                <Film size={28} style={{ opacity: 0.25 }} />
                            )}
                        </div>
                    )}

                    {/* Type badge */}
                    <span
                        style={{
                            position: "absolute",
                            bottom: 5,
                            left: 5,
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 5px",
                            borderRadius: 4,
                            background: isShow ? "rgba(99,102,241,0.8)" : "rgba(16,185,129,0.8)",
                            color: "#fff",
                            backdropFilter: "blur(4px)",
                        }}
                    >
                        {isShow ? "SHOW" : "FILM"}
                    </span>
                </div>

                <div style={{ padding: "7px 9px 9px" }}>
                    {detailPath ? (
                        <Link to={detailPath} style={{ textDecoration: "none" }}>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--color-text)",
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
                                margin: 0,
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--color-text)",
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
                                margin: "2px 0 0",
                                fontSize: 10,
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {item.year}
                        </p>
                    )}
                    {badge && (
                        <p
                            style={{
                                margin: "3px 0 0",
                                fontSize: 9,
                                color: "var(--color-accent)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {badge}
                        </p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export default function CollectionPage() {
    const [filter, setFilter] = useState<MediaFilter>("all");
    const { data: items, isLoading } = useCollection(filter);
    const sync = useSyncCollection();
    const clearRemote = useClearRemoteCollection();
    const [clearConfirm, setClearConfirm] = useState(false);

    return (
        <div
            style={{
                minHeight: "100vh",
                paddingTop: "var(--app-nav-height)",
                padding: "0 0 40px",
            }}
        >
            <div className="app-container" style={{ paddingTop: 32 }}>
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        marginBottom: 24,
                        gap: 16,
                    }}
                >
                    <div>
                        <h1
                            style={{
                                margin: 0,
                                fontSize: "clamp(28px,4vw,44px)",
                                fontWeight: 800,
                                letterSpacing: "-0.04em",
                                color: "var(--color-text)",
                            }}
                        >
                            {t("collection.title")}
                        </h1>
                        {items && (
                            <p
                                style={{
                                    margin: "4px 0 0",
                                    fontSize: 13,
                                    color: "var(--color-text-muted)",
                                }}
                            >
                                {t("collection.count", { count: items.length })}
                            </p>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {/* Sync from Trakt */}
                        <button
                            onClick={() => sync.mutate()}
                            disabled={sync.isPending}
                            title={t("collection.syncFromTrakt")}
                            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)] disabled:opacity-50"
                        >
                            {sync.isPending ? (
                                <Loader2
                                    size={14}
                                    style={{ animation: "spin 1s linear infinite" }}
                                />
                            ) : (
                                <RefreshCw size={14} />
                            )}
                            <span className="hidden sm:inline">
                                {t("collection.syncFromTrakt")}
                            </span>
                        </button>

                        {/* Clear remote */}
                        {clearConfirm ? (
                            <div style={{ display: "flex", gap: 6 }}>
                                <button
                                    onClick={() =>
                                        clearRemote.mutate(undefined, {
                                            onSuccess: () => setClearConfirm(false),
                                        })
                                    }
                                    disabled={clearRemote.isPending}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        padding: "6px 12px",
                                        borderRadius: 7,
                                        border: "none",
                                        background: "#ef4444",
                                        color: "#fff",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {clearRemote.isPending ? (
                                        <Loader2
                                            size={12}
                                            style={{ animation: "spin 1s linear infinite" }}
                                        />
                                    ) : (
                                        <AlertTriangle size={12} />
                                    )}
                                    {t("collection.confirmClear")}
                                </button>
                                <button
                                    onClick={() => setClearConfirm(false)}
                                    style={{
                                        padding: "6px 10px",
                                        borderRadius: 7,
                                        border: "1px solid var(--color-border-subtle)",
                                        background: "transparent",
                                        color: "var(--color-text-muted)",
                                        fontSize: 12,
                                        cursor: "pointer",
                                    }}
                                >
                                    {t("common.cancel")}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setClearConfirm(true)}
                                title={t("collection.clearRemote")}
                                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:border-red-500 hover:text-red-400"
                            >
                                <Trash2 size={14} />
                                <span className="hidden sm:inline">
                                    {t("collection.clearRemote")}
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
                    {FILTERS.map(({ key, labelKey, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "6px 12px",
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                border:
                                    filter === key
                                        ? "1px solid var(--color-border-focus)"
                                        : "1px solid transparent",
                                background:
                                    filter === key
                                        ? "var(--color-accent-dim)"
                                        : "var(--color-surface-2)",
                                color:
                                    filter === key
                                        ? "var(--color-accent-light)"
                                        : "var(--color-text-muted)",
                                transition: "all 0.13s",
                            }}
                        >
                            <Icon size={12} />
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
                            minHeight: 200,
                            gap: 8,
                            color: "var(--color-text-muted)",
                        }}
                    >
                        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                    </div>
                ) : (items ?? []).length === 0 ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "60px 0",
                            color: "var(--color-text-muted)",
                        }}
                    >
                        <Archive size={40} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
                        <p style={{ margin: 0, fontSize: 13 }}>{t("collection.empty")}</p>
                        <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.6 }}>
                            {t("collection.emptyHint")}
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                            gap: 14,
                        }}
                    >
                        <AnimatePresence>
                            {(items ?? []).map((item, i) => (
                                <CollectionCard key={item.id} item={item} index={i} />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
