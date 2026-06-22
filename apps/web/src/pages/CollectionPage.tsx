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
    ChevronRight,
    Disc3,
} from "lucide-react";
import {
    useCollection,
    useSyncCollection,
    useClearRemoteCollection,
    useRemoveCollectionItem,
    useCollectionShowEpisodes,
    useCollectionCapacity,
    usePruneRemoteCollection,
} from "../hooks";
import { tmdbImage } from "../lib/image";
import { t } from "../lib/i18n";
import { useToast } from "../lib/toast";
import type { UserCollectionItem, CollectionShowEpisodes } from "@trakt-dashboard/types";

type MediaFilter = "all" | "show" | "movie";

const FILTERS: { key: MediaFilter; labelKey: string; icon: typeof Tv2 }[] = [
    { key: "all", labelKey: "common.all", icon: LayoutGrid },
    { key: "show", labelKey: "collection.shows", icon: Tv2 },
    { key: "movie", labelKey: "collection.movies", icon: Film },
];

function formatBadge(item: {
    mediaFormat?: string | null;
    resolution?: string | null;
    hdr?: string | null;
    audio?: string | null;
    audioChannels?: string | null;
}) {
    const parts: string[] = [];
    if (item.mediaFormat) parts.push(item.mediaFormat.replace(/_/g, " ").toUpperCase());
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
                  : item.hdr === "hdr10"
                    ? "HDR10"
                    : item.hdr === "hlg"
                      ? "HLG"
                      : item.hdr.toUpperCase(),
        );
    if (item.audio)
        parts.push(
            item.audio === "dolby_atmos"
                ? "Atmos"
                : item.audio === "dolby_truehd"
                  ? "TrueHD"
                  : item.audio === "dts_x"
                    ? "DTS:X"
                    : item.audio === "dts_ma"
                      ? "DTS-MA"
                      : item.audio === "dts_hra"
                        ? "DTS-HRA"
                        : item.audio === "dd_plus"
                          ? "DD+"
                          : item.audio === "aac"
                            ? "AAC"
                            : item.audio === "mp3"
                              ? "MP3"
                              : item.audio.replace(/_/g, " ").toUpperCase(),
        );
    if (item.audioChannels) parts.push(item.audioChannels);
    return parts.join(" · ");
}

// ── Shared modal shell ────────────────────────────────────────────────────────

function ModalShell({
    item,
    subtitle,
    onClose,
    children,
}: {
    item: UserCollectionItem;
    subtitle: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(6px)",
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: 560,
                    maxHeight: "85vh",
                    borderRadius: 14,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-subtle)",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        borderBottom: "1px solid var(--color-border-subtle)",
                        flexShrink: 0,
                    }}
                >
                    {item.posterPath && (
                        <img
                            src={tmdbImage(item.posterPath, "w92") ?? undefined}
                            alt={item.title}
                            style={{ width: 36, height: 54, borderRadius: 5, objectFit: "cover" }}
                        />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 15,
                                fontWeight: 700,
                                color: "var(--color-text)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {item.title}
                        </p>
                        <p
                            style={{
                                margin: "2px 0 0",
                                fontSize: 11,
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {subtitle}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            border: "none",
                            background: "var(--color-surface-2)",
                            color: "var(--color-text-muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
                <div style={{ overflowY: "auto", padding: "12px 16px 16px", flex: 1 }}>
                    {children}
                </div>
            </motion.div>
        </div>
    );
}

// ── CollectionMovieModal ──────────────────────────────────────────────────────

function CollectionMovieModal({
    item,
    onClose,
}: {
    item: UserCollectionItem;
    onClose: () => void;
}) {
    const badge = formatBadge(item);
    const fields: [string, string | null | undefined][] = [
        ["媒体格式", item.mediaFormat?.replace(/_/g, " ").toUpperCase() ?? null],
        [
            "分辨率",
            item.resolution === "uhd_4k"
                ? "4K"
                : item.resolution === "hd_1080p"
                  ? "1080p"
                  : item.resolution === "hd_720p"
                    ? "720p"
                    : (item.resolution?.toUpperCase() ?? null),
        ],
        [
            "HDR",
            item.hdr === "dolby_vision"
                ? "Dolby Vision"
                : item.hdr === "hdr10_plus"
                  ? "HDR10+"
                  : item.hdr === "hdr10"
                    ? "HDR10"
                    : (item.hdr?.toUpperCase() ?? null),
        ],
        [
            "音频",
            item.audio === "dolby_atmos"
                ? "Dolby Atmos"
                : item.audio === "dolby_truehd"
                  ? "TrueHD"
                  : item.audio === "dts_x"
                    ? "DTS:X"
                    : item.audio === "dts_ma"
                      ? "DTS-MA"
                      : (item.audio?.replace(/_/g, " ").toUpperCase() ?? null),
        ],
        ["声道", item.audioChannels ?? null],
        ["入库时间", item.collectedAt ? new Date(item.collectedAt).toLocaleDateString() : null],
    ];
    const activeFields = fields.filter(([, v]) => v);

    return (
        <ModalShell item={item} subtitle={t("collection.specDetail")} onClose={onClose}>
            {activeFields.length === 0 ? (
                <p
                    style={{
                        textAlign: "center",
                        padding: "32px 0",
                        color: "var(--color-text-muted)",
                        fontSize: 13,
                    }}
                >
                    {t("collection.noSpecData")}
                </p>
            ) : (
                <div
                    style={{
                        borderRadius: 8,
                        border: "1px solid var(--color-border-subtle)",
                        overflow: "hidden",
                    }}
                >
                    {activeFields.map(([label, value], idx) => (
                        <div
                            key={label}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "9px 14px",
                                borderTop:
                                    idx > 0 ? "1px solid var(--color-border-subtle)" : undefined,
                                background: "var(--color-surface-2)",
                            }}
                        >
                            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                                {label}
                            </span>
                            <span
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "var(--color-accent)",
                                }}
                            >
                                {value}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {badge && (
                <p
                    style={{
                        margin: "10px 0 0",
                        fontSize: 10,
                        color: "var(--color-text-muted)",
                        textAlign: "center",
                    }}
                >
                    {badge}
                </p>
            )}
        </ModalShell>
    );
}

// ── CollectionEpisodeModal ────────────────────────────────────────────────────

function CollectionEpisodeModal({
    item,
    onClose,
}: {
    item: UserCollectionItem;
    onClose: () => void;
}) {
    const { data: seasons, isLoading } = useCollectionShowEpisodes(item.showId);

    return (
        <ModalShell item={item} subtitle={t("collection.episodeDetail")} onClose={onClose}>
            {isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                    <Loader2
                        size={20}
                        style={{
                            animation: "spin 1s linear infinite",
                            color: "var(--color-text-muted)",
                        }}
                    />
                </div>
            ) : !seasons || Object.keys(seasons).length === 0 ? (
                <p
                    style={{
                        textAlign: "center",
                        padding: "32px 0",
                        color: "var(--color-text-muted)",
                        fontSize: 13,
                    }}
                >
                    {t("collection.noEpisodeData")}
                </p>
            ) : (
                <CollectionSeasonList seasons={seasons} />
            )}
        </ModalShell>
    );
}

function CollectionSeasonList({ seasons }: { seasons: CollectionShowEpisodes }) {
    const sortedSeasons = Object.keys(seasons)
        .map(Number)
        .sort((a, b) => a - b);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {sortedSeasons.map((seasonNum) => {
                const episodes = seasons[String(seasonNum)];
                return (
                    <div key={seasonNum}>
                        <p
                            style={{
                                margin: "0 0 6px",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--color-text-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}
                        >
                            {t("common.season", { n: seasonNum })}
                        </p>
                        <div
                            style={{
                                borderRadius: 8,
                                border: "1px solid var(--color-border-subtle)",
                                overflow: "hidden",
                            }}
                        >
                            {episodes.map((ep, idx) => {
                                const badge = formatBadge(ep);
                                return (
                                    <div
                                        key={ep.episode}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "8px 12px",
                                            borderTop:
                                                idx > 0
                                                    ? "1px solid var(--color-border-subtle)"
                                                    : undefined,
                                            background: "var(--color-surface-2)",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: "var(--color-text)",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            E{String(ep.episode).padStart(2, "0")}
                                        </span>
                                        {badge ? (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    color: "var(--color-accent)",
                                                    letterSpacing: "0.04em",
                                                }}
                                            >
                                                {badge}
                                            </span>
                                        ) : (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    color: "var(--color-text-muted)",
                                                    opacity: 0.5,
                                                }}
                                            >
                                                —
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function CollectionCard({
    item,
    index,
    onViewDetail,
}: {
    item: UserCollectionItem;
    index: number;
    onViewDetail?: () => void;
}) {
    const remove = useRemoveCollectionItem();
    const { toast } = useToast();
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
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
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                if (!remove.isPending) setConfirmRemove(false);
            }}
        >
            {/* Remove button — visible only on hover or while confirming */}
            <div
                style={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    zIndex: 2,
                    display: "flex",
                    gap: 4,
                    opacity: isHovered || confirmRemove ? 1 : 0,
                    transition: "opacity 0.15s",
                    pointerEvents: isHovered || confirmRemove ? "auto" : "none",
                }}
            >
                {confirmRemove ? (
                    <>
                        <button
                            onClick={() =>
                                remove.mutate(item.id, {
                                    onSuccess: () => setConfirmRemove(false),
                                    onError: () => {
                                        setConfirmRemove(false);
                                        toast(t("collection.removeFailed"), "error");
                                    },
                                })
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
                    </>
                ) : (
                    <button
                        onClick={() => setConfirmRemove(true)}
                        style={{
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
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "var(--color-text-muted)")
                        }
                    >
                        <X size={11} />
                    </button>
                )}
            </div>

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
                    {onViewDetail && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onViewDetail();
                            }}
                            style={{
                                marginTop: 5,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "3px 7px",
                                borderRadius: 5,
                                border: "1px solid var(--color-border-subtle)",
                                background: "var(--color-surface-2)",
                                color: "var(--color-text-muted)",
                                fontSize: 9,
                                fontWeight: 600,
                                cursor: "pointer",
                                width: "100%",
                                justifyContent: "center",
                                transition: "color 0.12s, border-color 0.12s",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = "var(--color-accent)";
                                e.currentTarget.style.borderColor = "var(--color-border-focus)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = "var(--color-text-muted)";
                                e.currentTarget.style.borderColor = "var(--color-border-subtle)";
                            }}
                        >
                            <Disc3 size={9} />
                            {isShow ? t("collection.viewEpisodes") : t("collection.viewSpecs")}
                            <ChevronRight size={9} />
                        </button>
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
    const { data: capacity } = useCollectionCapacity();
    const prune = usePruneRemoteCollection();
    const { toast } = useToast();
    const [clearConfirm, setClearConfirm] = useState(false);
    const [pruneConfirm, setPruneConfirm] = useState(false);
    const [modalItem, setModalItem] = useState<UserCollectionItem | null>(null);

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
                        {/* Remote capacity bar */}
                        {capacity && (
                            <div style={{ marginTop: 10, width: 220 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: 10,
                                        color: capacity.nearLimit
                                            ? "#f87171"
                                            : capacity.pct >= 70
                                              ? "#fbbf24"
                                              : "var(--color-text-muted)",
                                        marginBottom: 3,
                                        fontWeight: 600,
                                    }}
                                >
                                    <span>{t("collection.remoteCapacity")}</span>
                                    <span>
                                        {capacity.used.toLocaleString("zh-CN")} /{" "}
                                        {capacity.limit.toLocaleString("zh-CN")} ({capacity.pct}%)
                                    </span>
                                </div>
                                <div
                                    style={{
                                        height: 4,
                                        borderRadius: 2,
                                        background: "var(--color-surface-2)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            width: `${Math.min(capacity.pct, 100)}%`,
                                            borderRadius: 2,
                                            background: capacity.nearLimit
                                                ? "#ef4444"
                                                : capacity.pct >= 70
                                                  ? "#f59e0b"
                                                  : "var(--color-accent)",
                                            transition: "width 0.4s ease",
                                        }}
                                    />
                                </div>
                            </div>
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

                        {/* Prune oldest remote items — only shown when ≥70% full */}
                        {capacity &&
                            capacity.pct >= 70 &&
                            (pruneConfirm ? (
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                        onClick={() =>
                                            prune.mutate(80, {
                                                onSuccess: (res) => {
                                                    setPruneConfirm(false);
                                                    if (res.data.freed > 0)
                                                        toast(
                                                            t("collection.pruneSuccess", {
                                                                freed: String(res.data.freed),
                                                            }),
                                                            "success",
                                                        );
                                                },
                                                onError: () => {
                                                    setPruneConfirm(false);
                                                    toast(t("collection.pruneFailed"), "error");
                                                },
                                            })
                                        }
                                        disabled={prune.isPending}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 5,
                                            padding: "6px 12px",
                                            borderRadius: 7,
                                            border: "none",
                                            background: "#f59e0b",
                                            color: "#000",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {prune.isPending ? (
                                            <Loader2
                                                size={12}
                                                style={{ animation: "spin 1s linear infinite" }}
                                            />
                                        ) : (
                                            <AlertTriangle size={12} />
                                        )}
                                        {t("collection.confirmPrune")}
                                    </button>
                                    <button
                                        onClick={() => setPruneConfirm(false)}
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
                                    onClick={() => setPruneConfirm(true)}
                                    title={t("collection.pruneRemote")}
                                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:border-amber-500 hover:text-amber-400"
                                >
                                    <Archive size={14} />
                                    <span className="hidden sm:inline">
                                        {t("collection.pruneRemote")}
                                    </span>
                                </button>
                            ))}

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
                                <CollectionCard
                                    key={item.id}
                                    item={item}
                                    index={i}
                                    onViewDetail={() => setModalItem(item)}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Detail modal — episodes for shows, format specs for movies */}
            <AnimatePresence>
                {modalItem && modalItem.mediaType === "show" && (
                    <CollectionEpisodeModal item={modalItem} onClose={() => setModalItem(null)} />
                )}
                {modalItem && modalItem.mediaType === "movie" && (
                    <CollectionMovieModal item={modalItem} onClose={() => setModalItem(null)} />
                )}
            </AnimatePresence>
        </div>
    );
}
