import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Tv2, Film, CheckCircle2 } from "lucide-react";
import type { StatsOverview } from "@trakt-dashboard/types";
import { CARD_BG, CARD_BDR, CARD_SHD, T1, T2, T3, COLORS } from "./tokens";
import { tmdbImage } from "../../lib/utils";
import { fmtDateZh } from "../../lib/i18n";

export function RecentActivity({ recentlyWatched, recentlyWatchedMovies }: { recentlyWatched: StatsOverview["recentlyWatched"]; recentlyWatchedMovies?: StatsOverview["recentlyWatchedMovies"] }) {
    return (
        <>
            {recentlyWatched?.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                    style={{
                        background: CARD_BG,
                        border: CARD_BDR,
                        borderRadius: "16px",
                        boxShadow: CARD_SHD,
                        padding: "24px",
                    }}
                >
                    <h3
                        style={{
                            fontSize: "15px",
                            fontWeight: 600,
                            color: T1,
                            marginBottom: "20px",
                        }}
                    >
                        最近动态
                    </h3>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "14px",
                        }}
                    >
                        {recentlyWatched.slice(0, 15).map((r, i) => (
                            <motion.div
                                key={`${r.showId}-${r.seasonNumber}-${r.episodeNumber}-${r.watchedAt}`}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: 0.4 + i * 0.04 }}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                }}
                            >
                                <div
                                    style={{
                                        position: "relative",
                                        width: "min(34vw, 240px)",
                                        aspectRatio: "16 / 9",
                                        borderRadius: "12px",
                                        overflow: "hidden",
                                        background: "var(--color-surface-3)",
                                        flexShrink: 1,
                                        outline: "1px solid var(--color-border)",
                                    }}
                                >
                                    {r.stillPath || r.posterPath ? (
                                        <img
                                            src={tmdbImage(r.stillPath ?? r.posterPath, r.stillPath ? "w500" : "w342")!}
                                            alt=""
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Tv2 size={32} color="var(--color-text-muted)" />
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            position: "absolute",
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            display: "flex",
                                            justifyContent: "center",
                                            paddingBottom: "8px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                background: "rgba(0,0,0,0.75)",
                                                backdropFilter: "blur(8px)",
                                                borderRadius: "6px",
                                                padding: "4px 10px",
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                color: "rgba(255,255,255,0.95)",
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            S{String(r.seasonNumber).padStart(2, "0")}E{String(r.episodeNumber).padStart(2, "0")}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "8px",
                                            right: "8px",
                                            width: "24px",
                                            height: "24px",
                                            borderRadius: "50%",
                                            background: COLORS.emerald.base,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            boxShadow: `0 2px 8px ${COLORS.emerald.base}99`,
                                        }}
                                    >
                                        <CheckCircle2 size={14} color="#fff" strokeWidth={2.5} />
                                    </div>
                                </div>
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "6px",
                                    }}
                                >
                                    <p style={{ fontSize: "16px", color: T1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {r.showTitle}
                                    </p>
                                    <p style={{ fontSize: "14px", color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        S{String(r.seasonNumber).padStart(2, "0")}E{String(r.episodeNumber).padStart(2, "0")}
                                        {r.episodeTitle ? ` · ${r.episodeTitle}` : ""}
                                    </p>
                                    <span style={{ fontSize: "13px", color: T3 }}>
                                        {r.watchedAt ? new Date(r.watchedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '未知时间'}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {recentlyWatchedMovies && recentlyWatchedMovies.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.36 }}
                    style={{
                        background: CARD_BG,
                        border: CARD_BDR,
                        borderRadius: "16px",
                        boxShadow: CARD_SHD,
                        padding: "24px",
                    }}
                >
                    <h3 style={{ fontSize: "15px", fontWeight: 600, color: T1, marginBottom: "20px" }}>
                        最近电影
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "12px" }}>
                        {recentlyWatchedMovies.slice(0, 8).map((movie) => (
                            <div key={`${movie.movieId}-${movie.watchedAt}`} style={{ minWidth: 0 }}>
                                <div
                                    style={{
                                        aspectRatio: "2 / 3",
                                        borderRadius: "12px",
                                        overflow: "hidden",
                                        background: "var(--color-surface-3)",
                                        border: "1px solid var(--color-border-subtle)",
                                        marginBottom: "8px",
                                    }}
                                >
                                    {movie.posterPath ? (
                                        <img src={tmdbImage(movie.posterPath, "w342")!} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
                                            <Film size={22} color="var(--color-text-muted)" />
                                        </div>
                                    )}
                                </div>
                                <p style={{ fontSize: "12px", color: T1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {movie.movieTitle}
                                </p>
                                <span style={{ fontSize: "11px", color: T3 }}>
                                    {fmtDateZh(movie.watchedAt)}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </>
    );
}
