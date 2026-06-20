import { motion } from "framer-motion";
import {
    Tv2,
    CheckCircle2,
    Clock,
    Film,
    Flame,
    Gauge,
    Loader2,
    Repeat2,
    Target,
    TrendingUp,
    Zap,
    Activity,
} from "lucide-react";
import { useStats } from "../../hooks";
import { t } from "../../lib/i18n";
import { CARD_BG, CARD_BDR, T1, T2, T3, COLORS } from "./tokens";
import { StatCard } from "./StatCard";
import { ActivityChart } from "./ActivityChart";
import { MediaComposition } from "./MediaComposition";
import { TopGenres } from "./TopGenres";
import { RecentActivity } from "./RecentActivity";
import { SignalMetrics } from "./SignalMetrics";
import type { SignalMetric } from "./SignalMetrics";
import { WatchHeatmap } from "./WatchHeatmap";
import { WatchPatterns } from "./WatchPatterns";
import { RatingDistribution } from "./RatingDistribution";

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
                    <Loader2 size={24} color={COLORS.violet.base} className="animate-spin" />
                    <p style={{ fontSize: "13px", color: T3 }}>{t("stats.loading")}</p>
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
                <p style={{ color: "#f87171", fontSize: "14px" }}>{t("stats.loadFailed")}</p>
            </div>
        );

    if (!stats) return null;

    const totalHours = Math.floor(stats.totalRuntimeMinutes / 60);
    const totalDays = (stats.totalRuntimeMinutes / (60 * 24)).toFixed(1);
    const episodeHours = Math.floor(
        (stats.totalEpisodeRuntimeMinutes ?? stats.totalRuntimeMinutes) / 60,
    );
    const movieHours = Math.floor((stats.totalMovieRuntimeMinutes ?? 0) / 60);
    const totalEntries = stats.totalEpisodesWatched + (stats.totalMovieWatches ?? 0);
    const completionRate =
        stats.totalShowsWatched > 0
            ? Math.round((stats.totalShowsCompleted / stats.totalShowsWatched) * 100)
            : 0;
    const movieWatches = stats.totalMovieWatches ?? 0;
    const mediaBreakdown = [
        { label: t("stats.legendEpisodes"), value: stats.totalEpisodesWatched, color: COLORS.cyan },
        { label: t("stats.legendMovies"), value: stats.totalMovieWatches ?? 0, color: COLORS.rose },
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
                month: t("stats.monthShort", { n: d.getMonth() + 1 }),
                count: found ? Number(found.count) : 0,
            });
        }
        return months;
    })();

    const maxBar = Math.max(...chartData.map((d) => d.count), 1);
    const activeMonths = chartData.filter((d) => d.count > 0);
    const peakMonth = chartData.reduce(
        (best, item) => (item.count > best.count ? item : best),
        chartData[0] ?? { month: t("stats.noData"), count: 0 },
    );
    // monthlyActivity only tracks episodes; use episode-only numerator so the
    // average stays consistent with the chart's episode axis.
    const monthlyAverage = Math.round(
        stats.totalEpisodesWatched / Math.max(activeMonths.length, 1),
    );
    const movieRewatchRatio =
        stats.totalMoviesWatched > 0 ? (movieWatches / stats.totalMoviesWatched).toFixed(1) : "0.0";
    const yearPctChange =
        (stats.yearComparison?.lastYear ?? 0) > 0
            ? Math.round(
                  ((stats.yearComparison.thisYear - stats.yearComparison.lastYear) /
                      stats.yearComparison.lastYear) *
                      100,
              )
            : null;
    const signalMetrics: SignalMetric[] = [
        {
            label: t("stats.metricPeakMonth"),
            value: peakMonth.count.toLocaleString("zh-CN"),
            detail: t("stats.metricPeakDetail", { month: peakMonth.month }),
            icon: Flame,
            color: COLORS.rose,
        },
        {
            label: t("stats.metricAvgMonth"),
            value: monthlyAverage.toLocaleString("zh-CN"),
            detail: t("stats.metricAvgDetail", { n: activeMonths.length || 0 }),
            icon: Gauge,
            color: COLORS.cyan,
        },
        {
            label: t("stats.metricReplay"),
            value: `${movieRewatchRatio}x`,
            detail: t("stats.metricReplayDetail", { n: movieWatches.toLocaleString("zh-CN") }),
            icon: Repeat2,
            color: COLORS.amber,
        },
        {
            label: t("stats.metricCompletion"),
            value: `${stats.totalShowsCompleted}`,
            detail: t("stats.metricCompletionDetail", { n: completionRate }),
            icon: Target,
            color: COLORS.emerald,
        },
        {
            label: t("stats.metricYearCompare"),
            value:
                yearPctChange !== null
                    ? `${yearPctChange > 0 ? "+" : ""}${yearPctChange}%`
                    : `${stats.yearComparison?.thisYear ?? 0}`,
            detail: t("stats.metricYearCompareDetail", {
                thisYear: stats.yearComparison?.thisYear ?? 0,
                lastYear: stats.yearComparison?.lastYear ?? 0,
            }),
            icon: TrendingUp,
            color: (yearPctChange ?? 0) >= 0 ? COLORS.teal : COLORS.rose,
        },
        {
            label: t("stats.metricStreak"),
            value: `${stats.longestStreakDays ?? 0}`,
            detail: t("stats.metricStreakDetail"),
            icon: Zap,
            color: COLORS.amber,
        },
        {
            label: t("stats.metricAvgDaily"),
            value: `${stats.avgDailyWatches30d ?? 0}`,
            detail: t("stats.metricAvgDailyDetail"),
            icon: Activity,
            color: COLORS.sky,
        },
    ];

    return (
        <div
            style={{
                minHeight: "calc(100svh - var(--app-nav-height))",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Content */}
            <div
                id="stats-export-container"
                style={{
                    position: "relative",
                    zIndex: 1,
                    maxWidth: "1920px",
                    margin: "0 auto",
                    padding: "40px 32px 80px",
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
                                lineHeight: 1.1,
                                marginBottom: "6px",
                            }}
                        >
                            {t("stats.title")}
                        </h2>
                        <p style={{ color: T3, fontSize: "14px" }}>{t("stats.subtitle")}</p>
                    </div>
                    <button
                        onClick={async () => {
                            const container = document.getElementById("stats-export-container");
                            if (!container) return;
                            try {
                                const html2canvas = (await import("html2canvas")).default;
                                const canvas = await html2canvas(container, {
                                    backgroundColor: window.getComputedStyle(document.body)
                                        .backgroundColor,
                                    scale: 2,
                                    useCORS: true,
                                    logging: false,
                                });
                                const link = document.createElement("a");
                                link.download = `trakt-stats-${new Date().toISOString().split("T")[0]}.png`;
                                link.href = canvas.toDataURL("image/png");
                                link.click();
                            } catch (err) {
                                console.error("Export failed", err);
                                alert(t("stats.exportFailed"));
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
                            transition: "background-color 0.2s, border-color 0.2s, box-shadow 0.2s",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "var(--color-surface-3)")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "var(--color-surface-2)")
                        }
                    >
                        {t("stats.exportImage")}
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
                        <p style={{ color: T2, fontSize: "14px" }}>{t("stats.empty")}</p>
                    </div>
                )}

                {/* ── Left / Right layout ─────────────────────────────────────────── */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
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
                                label={t("stats.cardEpisodes")}
                                value={stats.totalEpisodesWatched.toLocaleString("zh-CN")}
                                icon={Tv2}
                                sub={`${episodeHours.toLocaleString("zh-CN")}h`}
                                delay={0}
                                color={COLORS.cyan}
                                signal="EP"
                            />
                            <StatCard
                                label={t("stats.cardMovies")}
                                value={(stats.totalMoviesWatched ?? 0).toLocaleString("zh-CN")}
                                icon={Film}
                                sub={t("stats.cardMoviesSub", {
                                    count: (stats.totalMovieWatches ?? 0).toLocaleString("zh-CN"),
                                    hours: movieHours.toLocaleString("zh-CN"),
                                })}
                                delay={0.05}
                                color={COLORS.rose}
                                signal={`${movieRewatchRatio}x`}
                            />
                            <StatCard
                                label={t("stats.cardRuntime")}
                                value={`${totalHours.toLocaleString("zh-CN")}h`}
                                icon={Clock}
                                sub={t("stats.cardRuntimeSub", { days: totalDays })}
                                delay={0.1}
                                color={COLORS.amber}
                                signal="TIME"
                            />
                            <StatCard
                                label={t("stats.cardCompletion")}
                                value={`${completionRate}%`}
                                icon={CheckCircle2}
                                sub={t("stats.cardCompletionSub", {
                                    completed: stats.totalShowsCompleted,
                                    total: stats.totalShowsWatched,
                                })}
                                delay={0.15}
                                color={COLORS.emerald}
                                signal="DONE"
                            />
                        </div>

                        <SignalMetrics metrics={signalMetrics} />

                        {/* Media composition */}
                        <MediaComposition
                            totalEntries={totalEntries}
                            mediaBreakdown={mediaBreakdown}
                            maxMedia={maxMedia}
                        />

                        {/* Top genres */}
                        <TopGenres topGenres={stats.topGenres} />

                        {/* Weekday patterns */}
                        <WatchPatterns weekdayDistribution={stats.weekdayDistribution ?? []} />
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
                        <RecentActivity
                            recentlyWatched={stats.recentlyWatched}
                            recentlyWatchedMovies={stats.recentlyWatchedMovies}
                        />
                    </div>
                </div>

                {/* ── FULL-WIDTH: Watch heatmap ── */}
                <div style={{ marginTop: "24px" }}>
                    <WatchHeatmap heatmap={stats.heatmap ?? []} />
                </div>

                {/* ── FULL-WIDTH: Rating distribution ── */}
                {(stats.ratingDistribution ?? []).some((r) => r.count > 0) && (
                    <div style={{ marginTop: "24px" }}>
                        <RatingDistribution ratingDistribution={stats.ratingDistribution ?? []} />
                    </div>
                )}
            </div>
        </div>
    );
}
