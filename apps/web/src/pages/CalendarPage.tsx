import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { CalendarEpisode } from "@trakt-dashboard/types";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import isTomorrow from "dayjs/plugin/isTomorrow";
import isYesterday from "dayjs/plugin/isYesterday";
import "dayjs/locale/zh-cn";
import { Calendar, ChevronLeft, ChevronRight, Clock, MoreVertical, PlayCircle } from "lucide-react";
import { EpisodePlaceholder } from "../components/ui/EpisodePlaceholder";
import { useCalendar } from "../hooks";
import { resolveBackdropFallback, tmdbImage } from "../lib/image";
import { cn, formatEpisode } from "../lib/utils";

dayjs.extend(isToday);
dayjs.extend(isTomorrow);
dayjs.extend(isYesterday);
dayjs.locale("zh-cn");

type CalendarDayGroup = {
    date: string;
    episodes: CalendarEpisode[];
};

function dateKeyFrom(value: string | null | undefined, fallback: string) {
    const parsed = dayjs(value || fallback);
    return parsed.isValid() ? parsed.format("YYYY-MM-DD") : fallback.slice(0, 10);
}

function formatDateTitle(dateStr: string) {
    const d = dayjs(dateStr);
    if (d.isToday()) return "今天";
    if (d.isTomorrow()) return "明天";
    if (d.isYesterday()) return "昨天";
    return d.format("M月D日 dddd");
}

function formatAirTime(dateStr: string | null) {
    if (!dateStr || !/[T\s]\d{1,2}:\d{2}/.test(dateStr)) {
        return "时间待定";
    }

    const d = dayjs(dateStr);
    if (!d.isValid()) return "时间待定";

    const hour = d.hour();
    const minute = String(d.minute()).padStart(2, "0");
    const period = hour < 12 ? "上午" : "下午";
    const displayHour = hour % 12 || 12;
    return `${period} ${displayHour}:${minute}`;
}

function weekday(dateStr: string) {
    return dayjs(dateStr).format("ddd");
}

function groupCalendarData(data: Record<string, CalendarEpisode[]>): CalendarDayGroup[] {
    const byDate = new Map<string, CalendarEpisode[]>();

    Object.entries(data).forEach(([rawDate, episodes]) => {
        episodes.forEach((episode) => {
            const key = dateKeyFrom(episode.airDate, rawDate);
            const group = byDate.get(key) ?? [];
            group.push(episode);
            byDate.set(key, group);
        });
    });

    return [...byDate.entries()]
        .map(([date, episodes]) => ({
            date,
            episodes: [...episodes].sort((a: CalendarEpisode, b: CalendarEpisode) => {
                const aTime = a.airDate ? dayjs(a.airDate).valueOf() : 0;
                const bTime = b.airDate ? dayjs(b.airDate).valueOf() : 0;
                if (aTime !== bTime) return aTime - bTime;
                return `${a.show.translatedName ?? a.show.title}${a.seasonNumber}${a.episodeNumber}`.localeCompare(
                    `${b.show.translatedName ?? b.show.title}${b.seasonNumber}${b.episodeNumber}`,
                );
            }),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

function episodeTitle(episode: CalendarEpisode) {
    return episode.title?.trim() || `第 ${episode.episodeNumber} 集`;
}

function showTitle(episode: CalendarEpisode) {
    return episode.show.translatedName || episode.show.title;
}

function isEpisodeUnaired(episode: CalendarEpisode) {
    const airDate = dayjs(episode.airDate);
    return airDate.isValid() && airDate.isAfter(dayjs());
}

function CalendarEpisodeArtwork({ episode }: { episode: CalendarEpisode }) {
    const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
    const stillUrl = tmdbImage(episode.stillPath, "w500");
    const fallbackUrl = resolveBackdropFallback(episode.show.backdropPath);
    const imageUrl = [stillUrl, fallbackUrl].find((url): url is string => url !== null && !failedImages.has(url));

    if (!imageUrl) {
        return (
            <>
                <EpisodePlaceholder
                    seasonNumber={episode.seasonNumber}
                    episodeNumber={episode.episodeNumber}
                />
                {isEpisodeUnaired(episode) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white/55 backdrop-blur-sm">
                            未播出
                        </span>
                    </div>
                )}
            </>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={episodeTitle(episode)}
            loading="lazy"
            onError={() => setFailedImages((current) => new Set(current).add(imageUrl))}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
    );
}

function CalendarSkeleton() {
    return (
        <div className="mx-auto flex min-h-[calc(100svh-var(--app-nav-height))] w-full max-w-[1440px] animate-pulse flex-col gap-8 px-4 py-8 text-[var(--color-text)] sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-[var(--color-surface-3)]" />
                <div className="h-8 w-40 rounded-lg bg-[var(--color-surface-3)]" />
            </div>
            <div className="h-36 rounded-[var(--radius-xl)] bg-[var(--color-surface-2)]" />
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="aspect-video rounded-[var(--radius-lg)] bg-[var(--color-surface-2)]" />
                ))}
            </div>
        </div>
    );
}

export default function CalendarPage() {
    const { data, isLoading, error } = useCalendar();
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const selectedDateRef = useRef<HTMLButtonElement | null>(null);

    const dayGroups = useMemo(() => (data ? groupCalendarData(data) : []), [data]);
    const dateKeys = dayGroups.map((group) => group.date).join("|");
    const todayKey = dayjs().format("YYYY-MM-DD");

    useEffect(() => {
        if (dayGroups.length === 0) {
            setSelectedDate(null);
            return;
        }

        setSelectedDate((current) => {
            if (current && dayGroups.some((group) => group.date === current)) {
                return current;
            }

            const todayGroup = dayGroups.find((group) => group.date === todayKey);
            if (todayGroup) return todayGroup.date;

            return dayGroups.find((group) => group.date >= todayKey)?.date ?? dayGroups[0].date;
        });
    }, [dateKeys, dayGroups, todayKey]);

    useEffect(() => {
        selectedDateRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }, [selectedDate]);

    if (isLoading) return <CalendarSkeleton />;

    if (error || !data) {
        return (
            <div className="flex min-h-[calc(100svh-var(--app-nav-height))] items-center justify-center bg-[var(--color-bg)] px-6 text-[var(--color-text)]">
                <p className="text-[var(--color-error)]">加载失败，请重试</p>
            </div>
        );
    }

    const selectedIndex = Math.max(0, dayGroups.findIndex((group) => group.date === selectedDate));
    const selectedGroup = dayGroups[selectedIndex];
    const todayGroup = dayGroups.find((group) => group.date === todayKey);

    const moveDate = (step: number) => {
        if (dayGroups.length === 0) return;
        const nextIndex = Math.min(dayGroups.length - 1, Math.max(0, selectedIndex + step));
        setSelectedDate(dayGroups[nextIndex].date);
    };

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] text-[var(--color-text)]">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl border border-[var(--action-cyan-border)] bg-[var(--action-cyan-surface)] text-[var(--action-cyan-text)]">
                            <Calendar className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">播出日历</h1>
                            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                                {dayGroups.length > 0
                                    ? `${dayGroups.length} 个播出日 · ${dayGroups.reduce((count, group) => count + group.episodes.length, 0)} 集`
                                    : "没有近期播出的剧集"}
                            </p>
                        </div>
                    </div>

                    {selectedGroup && (
                        <div className="text-sm font-medium text-[var(--color-text-secondary)]">
                            {formatDateTitle(selectedGroup.date)}
                            <span className="mx-2 text-[var(--color-text-muted)]">/</span>
                            {selectedGroup.episodes.length} 集
                        </div>
                    )}
                </div>

                {dayGroups.length === 0 ? (
                    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-6 py-20 text-center text-[var(--color-text-muted)]">
                        没有近期播出的剧集
                    </div>
                ) : (
                    <>
                        <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-panel-glass-strong)] p-3 shadow-[var(--shadow-hud)]">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,var(--action-violet-surface),transparent_48%,var(--action-cyan-surface))]" />
                            <div className="relative flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-label="前一天"
                                    disabled={selectedIndex <= 0}
                                    onClick={() => moveDate(-1)}
                                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--action-slate-border)] bg-[var(--action-slate-surface)] text-[var(--action-slate-text)] transition hover:border-[var(--action-slate-border-hover)] hover:bg-[var(--action-slate-surface-hover)] disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                    <ChevronLeft className="size-5" />
                                </button>

                                <div className="episode-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
                                    {dayGroups.map((group) => {
                                        const active = group.date === selectedGroup?.date;
                                        const dots = Math.min(group.episodes.length, 2);
                                        const extra = group.episodes.length - dots;
                                        return (
                                            <button
                                                key={group.date}
                                                ref={active ? selectedDateRef : null}
                                                type="button"
                                                aria-current={active ? "date" : undefined}
                                                onClick={() => setSelectedDate(group.date)}
                                                className={cn(
                                                    "flex min-w-[76px] flex-col items-center rounded-[var(--radius-md)] border px-3 py-3 text-center transition",
                                                    active
                                                        ? "border-[var(--action-cyan-border-hover)] bg-[var(--color-surface-3)] text-[var(--color-text)] shadow-[var(--shadow-media-card-hover)]"
                                                        : "border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 text-[var(--color-text-secondary)] hover:border-[var(--action-cyan-border)] hover:bg-[var(--color-surface-hover)]",
                                                )}
                                            >
                                                <span className="text-sm font-bold">{dayjs(group.date).format("M月")}</span>
                                                <span className="mt-1 text-lg font-black leading-none tabular-nums">
                                                    {dayjs(group.date).format("D")}
                                                </span>
                                                <span className="mt-2 text-xs font-bold">{weekday(group.date)}</span>
                                                <span className="mt-2 flex min-h-4 items-center justify-center gap-1">
                                                    {Array.from({ length: dots }).map((_, index) => (
                                                        <span key={index} className="size-1.5 rounded-full bg-[var(--action-cyan-solid)]" />
                                                    ))}
                                                    {extra > 0 && (
                                                        <span className="text-[11px] font-black text-[var(--action-cyan-text)]">
                                                            +{extra}
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    aria-label="后一天"
                                    disabled={selectedIndex >= dayGroups.length - 1}
                                    onClick={() => moveDate(1)}
                                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--action-slate-border)] bg-[var(--action-slate-surface)] text-[var(--action-slate-text)] transition hover:border-[var(--action-slate-border-hover)] hover:bg-[var(--action-slate-surface-hover)] disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                    <ChevronRight className="size-5" />
                                </button>

                                <button
                                    type="button"
                                    disabled={!todayGroup}
                                    onClick={() => todayGroup && setSelectedDate(todayGroup.date)}
                                    className="hidden h-9 shrink-0 rounded-full border border-[var(--action-slate-border)] bg-[var(--action-slate-surface)] px-4 text-sm font-bold text-[var(--action-slate-text)] transition hover:border-[var(--action-slate-border-hover)] hover:bg-[var(--action-slate-surface-hover)] disabled:cursor-not-allowed disabled:opacity-35 sm:inline-flex sm:items-center"
                                >
                                    今天
                                </button>
                            </div>
                        </section>

                        {selectedGroup && (
                            <section className="flex flex-col gap-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <h2 className="text-2xl font-black">{formatDateTitle(selectedGroup.date)}</h2>
                                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                                            {dayjs(selectedGroup.date).format("YYYY-MM-DD")} · 同日 {selectedGroup.episodes.length} 集
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                    {selectedGroup.episodes.map((episode) => {
                                        return (
                                            <Link
                                                key={episode.id}
                                                to={`/shows/${episode.show.id}/seasons/${episode.seasonNumber}/episodes/${episode.episodeNumber}`}
                                                className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-[var(--shadow-media-card)] transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--color-nav-active-border)] hover:bg-[var(--color-surface-hover)] hover:shadow-[var(--shadow-media-card-hover)]"
                                            >
                                                <div className="relative aspect-video overflow-hidden bg-[var(--color-surface-3)]">
                                                    <CalendarEpisodeArtwork episode={episode} />

                                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/72 via-black/14 to-transparent" />
                                                    <div className="absolute left-2.5 top-2.5 rounded-full border border-white/20 bg-[var(--color-panel-glass-strong)] px-2.5 py-1 text-[11px] font-black tabular-nums text-foreground shadow-lg backdrop-blur-md">
                                                        {formatEpisode(episode.seasonNumber, episode.episodeNumber)}
                                                    </div>
                                                    <span
                                                        aria-hidden="true"
                                                        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/28 text-white/90 opacity-90 backdrop-blur-md transition group-hover:bg-black/42"
                                                    >
                                                        <MoreVertical className="size-4" />
                                                    </span>
                                                    <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full border border-white/20 bg-[var(--color-panel-glass-strong)] px-2.5 py-1 text-[11px] font-bold text-foreground shadow-lg backdrop-blur-md">
                                                        <Clock className="size-3" />
                                                        {formatAirTime(episode.airDate)}
                                                    </div>
                                                </div>

                                                <div className="flex min-h-[104px] flex-col gap-2 p-3">
                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-sm font-bold text-[var(--color-text)]">
                                                            {showTitle(episode)}
                                                        </h3>
                                                        <p className="mt-1 line-clamp-2 text-sm font-medium text-[var(--color-text-secondary)]">
                                                            {episodeTitle(episode)}
                                                        </p>
                                                    </div>
                                                    <div className="mt-auto flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
                                                        <span>{episode.show.network || "未知平台"}</span>
                                                        <span className="inline-flex items-center gap-1 text-[var(--action-cyan-text)]">
                                                            <PlayCircle className="size-3.5" />
                                                            详情
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
