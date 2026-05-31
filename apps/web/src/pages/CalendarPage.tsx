import { useCalendar } from "../hooks";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import isTomorrow from "dayjs/plugin/isTomorrow";
import isYesterday from "dayjs/plugin/isYesterday";
import "dayjs/locale/zh-cn"; // Ensure locale is available
import { resolveShowPoster } from "../lib/image";
import { Calendar, PlayCircle } from "lucide-react";

dayjs.extend(isToday);
dayjs.extend(isTomorrow);
dayjs.extend(isYesterday);
dayjs.locale("zh-cn");

function formatDateHeader(dateStr: string) {
    const d = dayjs(dateStr);
    if (d.isToday()) return "今天";
    if (d.isTomorrow()) return "明天";
    if (d.isYesterday()) return "昨天";
    return d.format("MM月DD日 dddd");
}

export default function CalendarPage() {
    const { data, isLoading, error } = useCalendar();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] px-8 py-8 animate-pulse">
                <div className="h-8 w-48 bg-white/5 rounded mb-8"></div>
                <div className="space-y-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i}>
                            <div className="h-6 w-32 bg-white/5 rounded mb-4"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <div className="h-24 bg-white/5 rounded-xl"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center">
                <p className="text-red-400">加载失败，请重试</p>
            </div>
        );
    }

    const dates = Object.keys(data).sort((a, b) => a.localeCompare(b));

    return (
        <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] px-6 lg:px-8 py-8 max-w-[1400px] mx-auto">
            <div className="flex items-center gap-3 mb-10">
                <div className="p-2.5 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    <Calendar size={24} />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">播出日历</h1>
            </div>

            {dates.length === 0 ? (
                <div className="text-center py-20 text-[var(--color-text-muted)]">
                    没有近期播出的剧集
                </div>
            ) : (
                <div className="space-y-12">
                    {dates.map((dateStr) => (
                        <div key={dateStr}>
                            <h2 className="text-xl font-bold mb-5 flex items-center gap-3">
                                <span>{formatDateHeader(dateStr)}</span>
                                <span className="text-sm font-normal text-[var(--color-text-muted)] bg-white/5 px-2.5 py-0.5 rounded-full">
                                    {dayjs(dateStr).format("YYYY-MM-DD")}
                                </span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {data[dateStr].map((ep) => {
                                    const posterUrl = resolveShowPoster(ep.show.posterPath, "w342");
                                    return (
                                        <Link
                                            key={ep.id}
                                            to={`/shows/${ep.show.id}`}
                                            className="group relative flex items-center gap-4 p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface-hover)] transition-all overflow-hidden"
                                        >
                                            <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden bg-white/5 relative">
                                                {posterUrl && (
                                                    <img
                                                        src={posterUrl}
                                                        alt={ep.show.title || "Poster"}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                )}
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                                            </div>
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h3 className="font-semibold text-[15px] truncate mb-1">
                                                    {ep.show.translatedName || ep.show.title}
                                                </h3>
                                                <p className="text-[13px] text-[var(--color-text-muted)] mb-2">
                                                    Season {ep.seasonNumber} • Episode {ep.episodeNumber}
                                                </p>
                                                {ep.title && (
                                                    <p className="text-[12px] text-[var(--color-text-secondary)] truncate">
                                                        {ep.title}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="absolute right-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[var(--color-accent)]">
                                                <PlayCircle size={20} />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
