import { useState } from "react";
import { motion } from "framer-motion";
import { Monitor, Tv2, Film, Sun, Sunset, Moon, Cloud } from "lucide-react";
import { useScreenTime } from "../../hooks";
import { CARD_BG, CARD_BDR, CARD_SHD, T1, T2, T3, COLORS } from "./tokens";

type Tab = "all" | "episodes" | "movies";

const TABS: { key: Tab; label: string; color: (typeof COLORS)[keyof typeof COLORS] }[] = [
    { key: "all", label: "媒体", color: COLORS.violet },
    { key: "episodes", label: "剧集", color: COLORS.cyan },
    { key: "movies", label: "电影", color: COLORS.amber },
];

const PEAK_LABELS = [
    { key: "morning" as const, label: "上午", icon: Sun, range: "06–12 时" },
    { key: "afternoon" as const, label: "下午", icon: Sunset, range: "12–18 时" },
    { key: "evening" as const, label: "晚上", icon: Cloud, range: "18–22 时" },
    { key: "night" as const, label: "夜间", icon: Moon, range: "22–06 时" },
];

function fmtMinutes(m: number) {
    if (m === 0) return "0 分钟";
    const h = Math.floor(m / 60);
    const min = m % 60;
    if (h === 0) return `${min} 分钟`;
    if (min === 0) return `${h} 小时`;
    return `${h} 小时 ${min} 分钟`;
}

function shortDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const isToday = dateStr === new Date().toISOString().slice(0, 10);
    return isToday ? "今天" : dayNames[d.getDay()];
}

export function ScreenTime() {
    const [tab, setTab] = useState<Tab>("all");
    const { data, isLoading } = useScreenTime(7);

    const activeTab = TABS.find((t) => t.key === tab)!;
    const color = activeTab.color;

    const getValue = (obj: { all: number; episodes: number; movies: number }) => obj[tab];

    const maxBar = data ? Math.max(...data.daily.map((d) => getValue(d)), 1) : 1;

    const totalMinutes = data ? getValue(data.totals) : 0;
    const avgMinutes = data ? getValue(data.averages) : 0;
    const awakePct = data ? getValue(data.awake_pct) : 0;
    const maxPeak = data ? Math.max(...PEAK_LABELS.map((p) => getValue(data.peaks[p.key])), 1) : 1;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{
                background: CARD_BG,
                border: CARD_BDR,
                borderRadius: "16px",
                boxShadow: CARD_SHD,
                padding: "20px 24px 24px",
            }}
        >
            {/* Header row */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: 8,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Monitor size={14} color={color.light} />
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T3,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                        }}
                    >
                        屏幕时间
                    </span>
                    {data && (
                        <span style={{ fontSize: 10, color: T3 }}>
                            {data.daily[0]?.date} · {data.daily[data.daily.length - 1]?.date}
                        </span>
                    )}
                </div>

                {/* 3 tabs */}
                <div
                    style={{
                        display: "flex",
                        gap: 4,
                        background: "var(--color-surface-2)",
                        borderRadius: 8,
                        padding: 3,
                    }}
                >
                    {TABS.map(({ key, label, color: tc }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 10px",
                                borderRadius: 6,
                                border: "none",
                                background: tab === key ? tc.bg : "transparent",
                                color: tab === key ? tc.light : T3,
                                fontSize: 12,
                                fontWeight: tab === key ? 700 : 500,
                                cursor: "pointer",
                                transition: "all 0.15s",
                            }}
                        >
                            {key === "episodes" && <Tv2 size={11} />}
                            {key === "movies" && <Film size={11} />}
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div
                    style={{
                        height: 160,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <span style={{ fontSize: 12, color: T3 }}>加载中…</span>
                </div>
            ) : data ? (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 24,
                        alignItems: "stretch",
                    }}
                >
                    {/* LEFT: daily bars — stretches to match right panel height */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <p style={{ fontSize: 11, color: T3, marginBottom: 6 }}>每日明细</p>

                        {/* Row 1: value labels */}
                        <div
                            style={{
                                display: "flex",
                                gap: 6,
                                height: 14,
                                marginBottom: 3,
                                flexShrink: 0,
                            }}
                        >
                            {data.daily.map((d) => {
                                const val = getValue(d);
                                return (
                                    <div
                                        key={d.date}
                                        style={{ flex: 1, textAlign: "center", overflow: "hidden" }}
                                    >
                                        <span
                                            style={{ fontSize: 8, color: T3, whiteSpace: "nowrap" }}
                                        >
                                            {val > 0
                                                ? fmtMinutes(val)
                                                      .replace(" 小时", "h")
                                                      .replace(" 分钟", "m")
                                                : ""}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Row 2: bars — flex:1 so they fill remaining height */}
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                gap: 6,
                                alignItems: "flex-end",
                                minHeight: 64,
                            }}
                        >
                            {data.daily.map((d) => {
                                const val = getValue(d);
                                const pct = val / maxBar;
                                return (
                                    <motion.div
                                        key={d.date}
                                        initial={{ scaleY: 0 }}
                                        animate={{ scaleY: val > 0 ? 1 : 0 }}
                                        style={{
                                            flex: 1,
                                            height: `${Math.max(pct * 100, val > 0 ? 2 : 0)}%`,
                                            borderRadius: "4px 4px 2px 2px",
                                            background: val > 0 ? color.base : "transparent",
                                            opacity: val > 0 ? 0.85 : 0,
                                            transformOrigin: "bottom",
                                            transition: "height 0.4s ease, background 0.2s",
                                        }}
                                    />
                                );
                            })}
                        </div>

                        {/* Row 3: day labels */}
                        <div style={{ display: "flex", gap: 6, marginTop: 4, flexShrink: 0 }}>
                            {data.daily.map((d) => (
                                <div key={d.date} style={{ flex: 1, textAlign: "center" }}>
                                    <span style={{ fontSize: 9, color: T3, whiteSpace: "nowrap" }}>
                                        {shortDate(d.date)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: stats */}
                    <div
                        style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 220 }}
                    >
                        {/* Row 1: 总计 + 每日平均 */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div
                                style={{
                                    background: color.bg,
                                    borderRadius: 10,
                                    padding: "10px 12px",
                                    border: `1px solid ${color.base}22`,
                                }}
                            >
                                <p style={{ fontSize: 10, color: T3, marginBottom: 3 }}>总计</p>
                                <p
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: color.light,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {fmtMinutes(totalMinutes)}
                                </p>
                            </div>
                            <div
                                style={{
                                    background: "var(--color-surface-2)",
                                    borderRadius: 10,
                                    padding: "10px 12px",
                                    border: CARD_BDR,
                                }}
                            >
                                <p style={{ fontSize: 10, color: T3, marginBottom: 3 }}>每日平均</p>
                                <p
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: T1,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {fmtMinutes(avgMinutes)}
                                </p>
                            </div>
                        </div>

                        {/* Row 2: 清醒时间 + sub totals */}
                        <div
                            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
                        >
                            <div
                                style={{
                                    background: "var(--color-surface-2)",
                                    borderRadius: 10,
                                    padding: "8px 10px",
                                    border: CARD_BDR,
                                }}
                            >
                                <p style={{ fontSize: 9, color: T3, marginBottom: 2 }}>清醒时间</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: T1 }}>
                                    {awakePct}%
                                </p>
                            </div>
                            <div
                                style={{
                                    background: COLORS.cyan.bg,
                                    borderRadius: 10,
                                    padding: "8px 10px",
                                    border: `1px solid ${COLORS.cyan.base}22`,
                                }}
                            >
                                <p style={{ fontSize: 9, color: T3, marginBottom: 2 }}>剧集</p>
                                <p
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: COLORS.cyan.light,
                                    }}
                                >
                                    {Math.floor(data.totals.episodes / 60)}h
                                    {data.totals.episodes % 60 > 0
                                        ? `${data.totals.episodes % 60}m`
                                        : ""}
                                </p>
                            </div>
                            <div
                                style={{
                                    background: COLORS.amber.bg,
                                    borderRadius: 10,
                                    padding: "8px 10px",
                                    border: `1px solid ${COLORS.amber.base}22`,
                                }}
                            >
                                <p style={{ fontSize: 9, color: T3, marginBottom: 2 }}>电影</p>
                                <p
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: COLORS.amber.light,
                                    }}
                                >
                                    {Math.floor(data.totals.movies / 60)}h
                                    {data.totals.movies % 60 > 0
                                        ? `${data.totals.movies % 60}m`
                                        : ""}
                                </p>
                            </div>
                        </div>

                        {/* Peak hours */}
                        <div
                            style={{
                                background: "var(--color-surface-2)",
                                borderRadius: 10,
                                padding: "10px 12px",
                                border: CARD_BDR,
                            }}
                        >
                            <p style={{ fontSize: 10, color: T3, marginBottom: 8 }}>高峰时段</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {PEAK_LABELS.map(({ key, label, icon: Icon }) => {
                                    const val = getValue(data.peaks[key]);
                                    const pct = maxPeak > 0 ? (val / maxPeak) * 100 : 0;
                                    return (
                                        <div
                                            key={key}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 7,
                                            }}
                                        >
                                            <Icon
                                                size={11}
                                                color={T3}
                                                style={{ flexShrink: 0, width: 12 }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    color: T2,
                                                    width: 24,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {label}
                                            </span>
                                            <div
                                                style={{
                                                    flex: 1,
                                                    height: 4,
                                                    borderRadius: 2,
                                                    background: "var(--color-surface-3)",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                                    style={{
                                                        height: "100%",
                                                        borderRadius: 2,
                                                        background: color.base,
                                                        opacity: 0.85,
                                                    }}
                                                />
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    color: T3,
                                                    width: 16,
                                                    textAlign: "right",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {val}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </motion.div>
    );
}
