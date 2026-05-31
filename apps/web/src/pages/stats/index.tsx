import { motion } from "framer-motion";
import {
    Tv2,
    CheckCircle2,
    Clock,
    Film,
    Loader2,
} from "lucide-react";
import { useStats } from "../../hooks";
import { CARD_BG, CARD_BDR, T1, T2, T3, COLORS } from "./tokens";
import { StatCard } from "./StatCard";
import { ActivityChart } from "./ActivityChart";
import { MediaComposition } from "./MediaComposition";
import { TopGenres } from "./TopGenres";
import { RecentActivity } from "./RecentActivity";

export default function StatsPage() {
    const { data: stats, isLoading, error } = useStats();

    if (isLoading)
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "60vh",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <Loader2
                        size={24}
                        color={COLORS.violet.base}
                        className="animate-spin"
                    />
                    <p style={{ fontSize: "13px", color: T3 }}>
                        正在加载统计数据…
                    </p>
                </div>
            </div>
        );

    if (error)
        return (
            <div
                style={{
                    padding: "48px 32px",
                    textAlign: "center",
                    minHeight: "60vh",
                }}
            >
                <p style={{ color: "#f87171", fontSize: "14px" }}>
                    统计数据加载失败，请稍后重试。
                </p>
            </div>
        );

    if (!stats) return null;

    const totalHours = Math.floor(stats.totalRuntimeMinutes / 60);
    const totalDays = (stats.totalRuntimeMinutes / (60 * 24)).toFixed(1);
    const episodeHours = Math.floor((stats.totalEpisodeRuntimeMinutes ?? stats.totalRuntimeMinutes) / 60);
    const movieHours = Math.floor((stats.totalMovieRuntimeMinutes ?? 0) / 60);
    const totalEntries = stats.totalEpisodesWatched + (stats.totalMovieWatches ?? 0);
    const completionRate = stats.totalShowsWatched > 0
        ? Math.round((stats.totalShowsCompleted / stats.totalShowsWatched) * 100)
        : 0;
    const mediaBreakdown = [
        { label: "剧集", value: stats.totalEpisodesWatched, color: COLORS.violet },
        { label: "电影", value: stats.totalMovieWatches ?? 0, color: COLORS.rose },
    ];
    const maxMedia = Math.max(...mediaBreakdown.map((d) => d.value), 1);

    const chartData = (() => {
        const months: { month: string; count: number }[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const found = stats.monthlyActivity?.find((m) => m.month === key);
            months.push({
                month: `${d.getMonth() + 1}月`,
                count: found ? Number(found.count) : 0,
            });
        }
        return months;
    })();

    const maxBar = Math.max(...chartData.map((d) => d.count), 1);

    return (
        <div
            style={{
                minHeight: "100vh",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Ambient glows */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        width: "600px",
                        height: "600px",
                        top: "-150px",
                        left: "5%",
                        background:
                            "radial-gradient(circle, rgba(124,106,247,0.08) 0%, transparent 60%)",
                        filter: "blur(80px)",
                        borderRadius: "50%",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        width: "400px",
                        height: "400px",
                        bottom: "100px",
                        right: "5%",
                        background:
                            "radial-gradient(circle, rgba(124,106,247,0.06) 0%, transparent 60%)",
                        filter: "blur(60px)",
                        borderRadius: "50%",
                    }}
                />
            </div>

            {/* Content */}
            <div
                id="stats-export-container"
                style={{
                    position: "relative",
                    zIndex: 1,
                    maxWidth: "1400px",
                    margin: "0 auto",
                    padding: "40px 24px 80px",
                    background: "var(--color-bg)", // Ensure background is captured
                }}
            >
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{
                        marginBottom: "36px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                    }}
                >
                    <div>
                        <h2
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "36px",
                                fontWeight: 400,
                                color: T1,
                                letterSpacing: "-0.02em",
                                lineHeight: 1.1,
                                marginBottom: "6px",
                            }}
                        >
                            数据统计
                        </h2>
                        <p style={{ color: T3, fontSize: "14px" }}>
                            您的观看历史概览
                        </p>
                    </div>
                    <button
                        onClick={async () => {
                            const container = document.getElementById("stats-export-container");
                            if (!container) return;
                            try {
                                const html2canvas = (await import("html2canvas")).default;
                                const canvas = await html2canvas(container, {
                                    backgroundColor: window.getComputedStyle(document.body).backgroundColor,
                                    scale: 2,
                                    useCORS: true,
                                    logging: false,
                                });
                                const link = document.createElement("a");
                                link.download = `trakt-stats-${new Date().toISOString().split('T')[0]}.png`;
                                link.href = canvas.toDataURL("image/png");
                                link.click();
                            } catch (err) {
                                console.error("Export failed", err);
                                alert("导出失败，请重试");
                            }
                        }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            background: "var(--color-surface-2)",
                            border: "1px solid var(--color-border)",
                            color: T1,
                            fontSize: "14px",
                            fontWeight: 500,
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-3)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
                    >
                        导出图片
                    </button>
                </motion.div>

                {/* Empty state */}
                {stats.totalEpisodesWatched === 0 && (
                    <div
                        style={{
                            background: CARD_BG,
                            border: CARD_BDR,
                            borderRadius: "16px",
                            padding: "24px",
                            marginBottom: "24px",
                        }}
                    >
                        <p style={{ color: T2, fontSize: "14px" }}>
                            暂无统计数据。请先在同步页面触发一次同步，完成后这里将显示您的观看趋势。
                        </p>
                    </div>
                )}

                {/* ── Left / Right layout ─────────────────────────────────────────── */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "360px minmax(0, 1fr)",
                        gap: "24px",
                        alignItems: "start",
                    }}
                >
                    {/* ── LEFT COLUMN: KPI cards + genres ── */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                        }}
                    >
                        {/* KPI cards */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                gap: "12px",
                            }}
                        >
                            <StatCard
                                label="剧集"
                                value={stats.totalEpisodesWatched.toLocaleString("zh-CN")}
                                icon={Tv2}
                                sub={`${episodeHours.toLocaleString("zh-CN")}h`}
                                delay={0}
                                color={COLORS.violet}
                            />
                            <StatCard
                                label="电影"
                                value={(stats.totalMoviesWatched ?? 0).toLocaleString("zh-CN")}
                                icon={Film}
                                sub={`${(stats.totalMovieWatches ?? 0).toLocaleString("zh-CN")} 次 · ${movieHours.toLocaleString("zh-CN")}h`}
                                delay={0.05}
                                color={COLORS.rose}
                            />
                            <StatCard
                                label="时长"
                                value={`${totalHours.toLocaleString("zh-CN")}h`}
                                icon={Clock}
                                sub={`${totalDays} 天`}
                                delay={0.1}
                                color={COLORS.amber}
                            />
                            <StatCard
                                label="完成率"
                                value={`${completionRate}%`}
                                icon={CheckCircle2}
                                sub={`${stats.totalShowsCompleted}/${stats.totalShowsWatched} 部剧`}
                                delay={0.15}
                                color={COLORS.emerald}
                            />
                        </div>

                        {/* Media composition */}
                        <MediaComposition
                            totalEntries={totalEntries}
                            mediaBreakdown={mediaBreakdown}
                            maxMedia={maxMedia}
                        />

                        {/* Top genres */}
                        <TopGenres topGenres={stats.topGenres} />
                    </div>

                    {/* ── RIGHT COLUMN: chart + recent activity ── */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "24px",
                        }}
                    >
                        {/* Monthly activity chart */}
                        <ActivityChart chartData={chartData} maxBar={maxBar} />

                        {/* Recent activity */}
                        <RecentActivity recentlyWatched={stats.recentlyWatched} recentlyWatchedMovies={stats.recentlyWatchedMovies} />
                    </div>
                </div>
            </div>
        </div>
    );
}
