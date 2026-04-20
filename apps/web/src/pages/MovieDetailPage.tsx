import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Film, Clock, Calendar, Eye, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { useMovieDetail, useMovieHistory, useMarkMovieWatched, useDeleteMovieHistory } from "../hooks";
import { tmdbImage } from "../lib/utils";
import { t } from "../lib/i18n";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 40px" }}>
                <div style={{ display: "flex", gap: "40px", alignItems: "flex-start" }} className="animate-pulse">
                    <div style={{ width: "220px", aspectRatio: "2/3", borderRadius: "16px", background: "rgba(255,255,255,0.05)", flexShrink: 0 }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", paddingTop: "8px" }}>
                        <div style={{ height: "36px", width: "280px", borderRadius: "8px", background: "rgba(255,255,255,0.07)" }} />
                        <div style={{ height: "12px", width: "160px", borderRadius: "999px", background: "rgba(255,255,255,0.04)" }} />
                        <div style={{ height: "80px", width: "100%", borderRadius: "8px", background: "rgba(255,255,255,0.03)" }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── MovieDetailPage ──────────────────────────────────────────────────────────

export default function MovieDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const movieId = Number(id);
    const isValidId = Number.isInteger(movieId) && movieId > 0;

    const { data: progress, isLoading, error, refetch } = useMovieDetail(isValidId ? movieId : 0);
    const { data: history, isLoading: historyLoading } = useMovieHistory(isValidId ? movieId : 0);
    const markWatched = useMarkMovieWatched(isValidId ? movieId : 0);
    const deleteHistory = useDeleteMovieHistory(isValidId ? movieId : 0);

    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [imgError, setImgError] = useState(false);
    const [backdropError, setBackdropError] = useState(false);

    if (isLoading) return <PageSkeleton />;

    if (error) {
        return (
            <div style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                    <p style={{ color: "var(--color-error)", fontSize: "14px" }}>加载失败，请重试</p>
                    <button
                        onClick={() => refetch()}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "var(--radius-md)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", fontSize: "13px", cursor: "pointer" }}
                    >
                        <RefreshCw size={13} /> 重新加载
                    </button>
                </div>
            </div>
        );
    }

    if (!progress) {
        return (
            <div style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>未找到该电影</p>
                    <button
                        onClick={() => navigate(-1)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "var(--radius-md)", background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer" }}
                    >
                        <ArrowLeft size={13} /> 返回
                    </button>
                </div>
            </div>
        );
    }

    const { movie, watchCount, lastWatchedAt } = progress;
    const poster = tmdbImage(movie.posterPath, "w342");
    const backdrop = tmdbImage(movie.backdropPath, "w1280");

    const handleMarkWatched = () => {
        markWatched.mutate(new Date().toISOString());
    };

    const handleDeleteHistory = async (historyId: number) => {
        await deleteHistory.mutateAsync(historyId);
        setDeleteConfirmId(null);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    };

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)" }}>
            {/* Backdrop hero */}
            {backdrop && !backdropError && (
                <div style={{ position: "relative", width: "100%", height: "320px", overflow: "hidden" }}>
                    <img
                        src={backdrop}
                        alt=""
                        onError={() => setBackdropError(true)}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, var(--color-bg) 100%)" }} />
                </div>
            )}

            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 40px", marginTop: backdrop && !backdropError ? "-120px" : "0", position: "relative" }}>
                {/* Back button */}
                <button
                    onClick={() => navigate(-1)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "var(--radius-md)", background: "rgba(0,0,0,0.4)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", marginBottom: "24px", backdropFilter: "blur(8px)" }}
                >
                    <ArrowLeft size={13} /> 返回
                </button>

                {/* Main content */}
                <div style={{ display: "flex", gap: "40px", alignItems: "flex-start" }}>
                    {/* Poster */}
                    <div style={{ width: "220px", flexShrink: 0 }}>
                        <div style={{ aspectRatio: "2/3", borderRadius: "16px", overflow: "hidden", background: "var(--color-surface-3)", border: "1px solid var(--color-border-subtle)" }}>
                            {poster && !imgError ? (
                                <img
                                    src={poster}
                                    alt={movie.title}
                                    onError={() => setImgError(true)}
                                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                />
                            ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Film size={48} style={{ color: "var(--color-text-muted)", opacity: 0.3 }} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: "12px" }}>
                            {movie.title}
                        </h1>

                        {/* Meta row */}
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                            {movie.releaseDate && (
                                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--color-text-muted)" }}>
                                    <Calendar size={13} />
                                    {new Date(movie.releaseDate).getFullYear()}
                                </span>
                            )}
                            {movie.runtime && (
                                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--color-text-muted)" }}>
                                    <Clock size={13} />
                                    {movie.runtime} 分钟
                                </span>
                            )}
                            {movie.genres && movie.genres.length > 0 && (
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {movie.genres.map((g) => (
                                        <span key={g} style={{ padding: "2px 8px", borderRadius: "999px", background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: "11px", color: "var(--color-text-muted)" }}>
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Overview */}
                        {movie.overview && (
                            <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: "24px", maxWidth: "640px" }}>
                                {movie.overview}
                            </p>
                        )}

                        {/* Watch stats */}
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                            <div style={{ padding: "10px 16px", borderRadius: "var(--radius-md)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                                <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px" }}>{t("movies.watchCount")}</div>
                                <div style={{ fontSize: "20px", fontWeight: 700, color: watchCount > 0 ? "var(--color-watched)" : "var(--color-text-muted)" }}>
                                    {watchCount}
                                </div>
                            </div>
                            {lastWatchedAt && (
                                <div style={{ padding: "10px 16px", borderRadius: "var(--radius-md)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "2px" }}>{t("movies.lastWatched")}</div>
                                    <div style={{ fontSize: "13px", fontWeight: 500 }}>{formatDate(lastWatchedAt)}</div>
                                </div>
                            )}
                        </div>

                        {/* Mark as watched button */}
                        <button
                            onClick={handleMarkWatched}
                            disabled={markWatched.isPending}
                            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", fontSize: "14px", fontWeight: 600, border: "none", cursor: markWatched.isPending ? "not-allowed" : "pointer", opacity: markWatched.isPending ? 0.7 : 1 }}
                        >
                            {markWatched.isPending ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                            标记为已观看
                        </button>
                    </div>
                </div>

                {/* Watch history */}
                <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid var(--color-border-subtle)" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
                        {t("watchHistory.showTitle")}
                        {history && history.length > 0 && (
                            <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "8px" }}>
                                {t("watchHistory.recordCount", { count: history.length })}
                            </span>
                        )}
                    </h2>

                    {historyLoading ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-text-muted)", fontSize: "13px" }}>
                            <Loader2 size={14} className="animate-spin" /> {t("common.loading")}
                        </div>
                    ) : !history || history.length === 0 ? (
                        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{t("watchHistory.empty")}</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <AnimatePresence>
                                {history.map((entry) => (
                                    <motion.div
                                        key={entry.id}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)" }}
                                    >
                                        <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                                            {formatDate(entry.watchedAt) ?? t("watchHistory.unknownTime")}
                                        </span>
                                        {deleteConfirmId === entry.id ? (
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <button
                                                    onClick={() => handleDeleteHistory(entry.id)}
                                                    disabled={deleteHistory.isPending}
                                                    style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--color-error)", color: "#fff", fontSize: "12px", border: "none", cursor: "pointer" }}
                                                >
                                                    {t("common.confirm")}
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(null)}
                                                    style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--color-surface-3)", color: "var(--color-text-muted)", fontSize: "12px", border: "1px solid var(--color-border)", cursor: "pointer" }}
                                                >
                                                    {t("common.cancel")}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setDeleteConfirmId(entry.id)}
                                                title={t("watchHistory.deleteLabel")}
                                                style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "var(--radius-sm)", background: "transparent", border: "1px solid transparent", color: "var(--color-text-muted)", fontSize: "12px", cursor: "pointer" }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
