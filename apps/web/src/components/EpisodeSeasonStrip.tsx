import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Clock } from "lucide-react";
import { cn, formatEpisode } from "../lib/utils";
import { resolveEpisodeStill } from "../lib/image";
import { resolveEpisodeTitle } from "../lib/i18n";
import { EpisodePlaceholder } from "./ui/EpisodePlaceholder";
import { Tag } from "./ui/Tag";
import type { EpisodeProgress } from "@trakt-dashboard/types";

interface EpisodeSeasonStripProps {
    episodes: EpisodeProgress[];
    seasonNumber: number;
    currentEpisodeNumber: number;
    showId?: number | string;
    watched: boolean;
    fallbackImageUrl?: string | null;
}

export function EpisodeSeasonStrip({
    episodes,
    seasonNumber,
    currentEpisodeNumber,
    showId,
    watched,
    fallbackImageUrl,
}: EpisodeSeasonStripProps) {
    const currentRef = useRef<HTMLButtonElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (currentRef.current) {
            currentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }, [currentEpisodeNumber, watched]);

    const seasonLabel = seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;
    const watchedCount = episodes.reduce((count, episode) => count + (episode.watched ? 1 : 0), 0);

    return (
        <div className="flex w-full flex-col pb-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-foreground">
                            {seasonLabel}
                        </h2>
                        <div className="h-px w-16 bg-gradient-to-r from-[var(--color-accent)]/60 to-transparent" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                        {episodes.length} 集
                        {episodes.length > 0 && (
                            <span className="text-muted-foreground/50"> / 当前 {formatEpisode(seasonNumber, currentEpisodeNumber)}</span>
                        )}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {watchedCount > 0 && (
                        <Tag color="emerald" variant="outline" size="sm" className="rounded-full px-3 py-1">
                            {watchedCount} 已看
                        </Tag>
                    )}
                    {episodes.length > watchedCount && (
                        <Tag color="slate" variant="outline" size="sm" className="rounded-full px-3 py-1">
                            {episodes.length - watchedCount} 未看
                        </Tag>
                    )}
                </div>
            </div>

            {episodes.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-border/45 bg-[var(--color-surface-2)]/60 px-5 py-10 text-center text-sm font-medium text-muted-foreground">
                    暂无本季剧集
                </div>
            ) : (
                <div
                    className={cn(
                        watched
                            ? "episode-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-8 pt-2 scroll-smooth sm:gap-5"
                            : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4",
                    )}
                >
                    {episodes.map((episode) => {
                        const isCurrent = Number(episode.episodeNumber) === Number(currentEpisodeNumber);
                        const isUnaired = episode.aired === false;
                        const stillUrl = resolveEpisodeStill(episode.stillPath);
                        const thumbUrl = stillUrl ?? fallbackImageUrl ?? null;
                        const title = resolveEpisodeTitle(episode);
                        const code = formatEpisode(seasonNumber, episode.episodeNumber);

                        return (
                            <button
                                key={episode.episodeNumber}
                                ref={isCurrent ? currentRef : null}
                                type="button"
                                aria-current={isCurrent ? "true" : undefined}
                                onClick={() => navigate(`/shows/${showId}/seasons/${seasonNumber}/episodes/${episode.episodeNumber}`)}
                                className={cn(
                                    "group rounded-[var(--radius-lg)] border p-1.5 text-left transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
                                    watched && "w-[286px] flex-none snap-center sm:w-[320px]",
                                    isCurrent
                                        ? "border-[var(--color-accent)]/70 bg-[var(--color-accent)]/12 shadow-[0_0_0_1px_rgba(37,244,238,0.16),0_18px_42px_rgba(37,244,238,0.08)]"
                                        : "border-border/35 bg-[var(--color-surface-2)]/38 hover:border-[var(--color-accent)]/35 hover:bg-[var(--color-surface-2)]/72",
                                    isUnaired && "opacity-60",
                                )}
                            >
                                <div
                                    className={cn(
                                        "relative mb-3 aspect-video overflow-hidden rounded-[var(--radius-md)] bg-zinc-950 shadow-xl",
                                        !isCurrent && "ring-1 ring-white/5",
                                    )}
                                >
                                    {thumbUrl ? (
                                        <img
                                            src={thumbUrl}
                                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                            alt={title}
                                        />
                                    ) : (
                                        <EpisodePlaceholder
                                            seasonNumber={seasonNumber}
                                            episodeNumber={episode.episodeNumber}
                                        />
                                    )}
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/82 via-black/20 to-transparent" />
                                    <div className="absolute left-2 top-2 rounded-full border border-white/20 bg-[var(--color-panel-glass-strong)] px-2 py-1 text-[10px] font-black tabular-nums text-foreground shadow-lg backdrop-blur-md">
                                        {code}
                                    </div>
                                    <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1.5">
                                        {episode.watched && (
                                            <Tag
                                                color="emerald"
                                                variant="3d"
                                                size="sm"
                                                icon={<Check className="size-3" strokeWidth={4} />}
                                                className="rounded-full px-2 py-0.5 shadow-lg shadow-emerald-500/20"
                                            >
                                                已看
                                            </Tag>
                                        )}
                                        {isUnaired && (
                                            <Tag color="amber" variant="3d" size="sm" className="rounded-full px-2 py-0.5">
                                                未播
                                            </Tag>
                                        )}
                                    </div>
                                    {episode.runtime && (
                                        <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full border border-white/20 bg-[var(--color-panel-glass-strong)] px-2 py-1 text-[10px] font-bold text-foreground backdrop-blur-md">
                                            <Clock className="size-3" />
                                            {episode.runtime}分钟
                                        </div>
                                    )}
                                </div>
                                <div className="px-1 pb-1">
                                    <h3
                                        className={cn(
                                            "line-clamp-2 min-h-[40px] text-sm font-bold leading-snug transition-colors",
                                            isCurrent
                                                ? "text-[var(--color-accent-light)]"
                                                : "text-foreground group-hover:text-[var(--color-accent-light)]",
                                        )}
                                    >
                                        {title}
                                    </h3>
                                    <p className="mt-1 text-xs font-medium text-muted-foreground/70">
                                        第 {episode.episodeNumber} 集
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
