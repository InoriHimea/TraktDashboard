import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { Star, Tv, Calendar, Layers, Film, Info } from "lucide-react";
import { cn } from "../lib/utils";
// ─── 动画预设 ─────────────────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.35,
            delay: i * 0.07,
            ease: [0.16, 1, 0.3, 1],
        },
    }),
};
function GlassCard({ children, className }) {
    return (_jsx("div", { className: cn("rounded-2xl border border-white/[0.07]", "bg-zinc-900/50 backdrop-blur-lg", "p-4", className), children: children }));
}
// ─── Section 标题 ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
    return (_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3", children: children }));
}
export function RatingCard({ score, source = "Trakt", voteCount, className, }) {
    const stars = score != null ? Math.round((score / 10) * 5) : 0;
    const displayScore = score != null ? score.toFixed(1) : "—";
    return (_jsxs(GlassCard, { className: className, children: [_jsx(SectionLabel, { children: "\u8BC4\u5206" }), _jsxs("div", { className: "flex items-end gap-3", children: [_jsx("span", { className: "text-4xl font-extrabold tracking-tight text-white leading-none", children: displayScore }), _jsxs("div", { className: "flex flex-col gap-1 pb-0.5", children: [_jsx("div", { className: "flex items-center gap-0.5", children: Array.from({ length: 5 }).map((_, i) => (_jsx(Star, { size: 12, className: cn("transition-colors", i < stars
                                        ? "fill-purple-400 text-purple-400"
                                        : "fill-white/10 text-white/10") }, i))) }), _jsxs("span", { className: "text-[10px] text-white/30 leading-none", children: [source, voteCount != null &&
                                        ` · ${voteCount.toLocaleString()} 票`] })] })] })] }));
}
export function ShowInfoGrid({ items, columns = 2, className, }) {
    const filtered = items.filter((item) => item.value != null && item.value !== "");
    return (_jsxs(GlassCard, { className: className, children: [_jsx(SectionLabel, { children: "\u4F5C\u54C1\u4FE1\u606F" }), _jsx("div", { className: cn("grid gap-x-4 gap-y-3", columns === 2 ? "grid-cols-2" : "grid-cols-3"), children: filtered.map(({ label, value, icon }) => (_jsxs("div", { className: "flex flex-col gap-0.5 min-w-0", children: [_jsxs("span", { className: "text-[10px] text-white/30 font-medium flex items-center gap-1 truncate", children: [icon, label] }), _jsx("span", { className: "text-[13px] text-white/85 font-medium truncate", children: value ?? "—" })] }, label))) })] }));
}
export function GenreTags({ genres, className }) {
    if (!genres.length)
        return null;
    return (_jsxs(GlassCard, { className: className, children: [_jsx(SectionLabel, { children: "\u7C7B\u578B" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: genres.map((genre) => (_jsx("span", { className: cn("px-3 py-1 rounded-full text-[11px] font-medium", "bg-white/[0.07] text-white/60", "border border-white/[0.06]", "hover:bg-white/[0.12] hover:text-white/80 transition-colors cursor-default"), children: genre }, genre))) })] }));
}
export function SeasonProgressWall({ seasons, className, }) {
    if (!seasons.length)
        return null;
    return (_jsxs(GlassCard, { className: className, children: [_jsx(SectionLabel, { children: "\u5206\u5B63\u8FDB\u5EA6" }), _jsx("div", { className: "flex flex-col gap-3", children: seasons.map((season, i) => {
                    const total = season.episodeCount;
                    const watched = season.watchedCount;
                    const aired = season.airedCount ?? total;
                    const pct = total > 0 ? Math.round((watched / total) * 100) : 0;
                    const airedPct = total > 0 ? (aired / total) * 100 : 100;
                    const label = season.label ?? `第 ${season.seasonNumber} 季`;
                    const isComplete = watched >= aired && aired > 0;
                    return (_jsxs(motion.div, { custom: i, variants: fadeUp, initial: "hidden", animate: "visible", className: "flex items-center gap-3", children: [_jsx("span", { className: "text-[11px] text-white/50 w-14 shrink-0 truncate", children: label }), _jsxs("div", { className: "flex-1 relative h-1 rounded-full bg-white/[0.08] overflow-hidden", children: [_jsx("div", { className: "absolute inset-y-0 left-0 rounded-full bg-white/[0.15] transition-all duration-700", style: { width: `${airedPct}%` } }), _jsx(motion.div, { className: cn("absolute inset-y-0 left-0 rounded-full transition-colors", isComplete
                                            ? "bg-emerald-500"
                                            : "bg-purple-500"), initial: { width: 0 }, animate: {
                                            width: `${(watched / Math.max(total, 1)) * 100}%`,
                                        }, transition: {
                                            duration: 0.8,
                                            delay: i * 0.05,
                                            ease: [0.16, 1, 0.3, 1],
                                        } })] }), _jsxs("span", { className: cn("text-[11px] tabular-nums w-8 text-right shrink-0 font-medium", isComplete
                                    ? "text-emerald-400"
                                    : pct > 0
                                        ? "text-purple-400"
                                        : "text-white/25"), children: [pct, "%"] })] }, season.seasonNumber));
                }) })] }));
}
export function MetadataSidebar({ show, rating, ratingSource, ratingVotes, seasons = [], className, }) {
    // 构建信息网格数据
    const infoItems = [
        {
            label: "播出平台",
            value: show.network,
            icon: _jsx(Tv, { size: 9 }),
        },
        {
            label: "首播日期",
            value: show.firstAired
                ? new Date(show.firstAired).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                })
                : null,
            icon: _jsx(Calendar, { size: 9 }),
        },
        {
            label: "总季数",
            value: show.totalSeasons ? `${show.totalSeasons} 季` : null,
            icon: _jsx(Layers, { size: 9 }),
        },
        {
            label: "总集数",
            value: show.totalEpisodes ? `${show.totalEpisodes} 集` : null,
            icon: _jsx(Film, { size: 9 }),
        },
        {
            label: "状态",
            value: show.status,
            icon: _jsx(Info, { size: 9 }),
        },
    ];
    return (_jsxs("div", { className: cn("flex flex-col gap-3", className), children: [rating != null && (_jsx(motion.div, { custom: 0, variants: fadeUp, initial: "hidden", animate: "visible", children: _jsx(RatingCard, { score: rating, source: ratingSource, voteCount: ratingVotes }) })), _jsx(motion.div, { custom: 1, variants: fadeUp, initial: "hidden", animate: "visible", children: _jsx(ShowInfoGrid, { items: infoItems, columns: 2 }) }), (show.genres?.length ?? 0) > 0 && (_jsx(motion.div, { custom: 2, variants: fadeUp, initial: "hidden", animate: "visible", children: _jsx(GenreTags, { genres: show.genres }) })), seasons.length > 0 && (_jsx(motion.div, { custom: 3, variants: fadeUp, initial: "hidden", animate: "visible", children: _jsx(SeasonProgressWall, { seasons: seasons }) }))] }));
}
//# sourceMappingURL=MetadataSidebar.js.map