import { useState, type CSSProperties, type ReactNode } from "react";
import {
    CalendarDays,
    Check,
    CheckCheck,
    Clock,
    ExternalLink,
    Star,
    Timer,
    Trash2,
    UserRound,
} from "lucide-react";
import type { EpisodeDetailData, WatchHistoryEntry } from "@trakt-dashboard/types";
import { DateTimePickerModal } from "./DateTimePickerModal";
import { Button } from "./ui/Button";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Tag } from "./ui/Tag";
import {
    useMarkWatched,
    useEpisodeHistory,
    useDeleteHistory,
    useJellyfinEpisode,
    useDeleteJellyfinItem,
} from "../hooks";
import { fmtAirDate, fmtRuntime, t } from "../lib/i18n";
import { cn, formatEpisode } from "../lib/utils";
import { useToast } from "../lib/toast";

interface EpisodeInfoCardProps {
    data: EpisodeDetailData;
    onHistoryClick: () => void;
    isWatched: boolean;
    onRefetch: () => void;
}

type ExternalLinkTone = "imdb" | "tmdb" | "tvdb" | "trakt";

const externalLinkTokens: Record<
    ExternalLinkTone,
    { text: string; bg: string; hoverBg: string; border: string; hoverBorder: string }
> = {
    imdb: {
        text: "var(--action-amber-text)",
        bg: "var(--action-amber-surface)",
        hoverBg: "var(--action-amber-surface-hover)",
        border: "var(--action-amber-border)",
        hoverBorder: "var(--action-amber-border-hover)",
    },
    tmdb: {
        text: "var(--action-sky-text)",
        bg: "var(--action-sky-surface)",
        hoverBg: "var(--action-sky-surface-hover)",
        border: "var(--action-sky-border)",
        hoverBorder: "var(--action-sky-border-hover)",
    },
    tvdb: {
        text: "var(--action-violet-text)",
        bg: "var(--action-violet-surface)",
        hoverBg: "var(--action-violet-surface-hover)",
        border: "var(--action-violet-border)",
        hoverBorder: "var(--action-violet-border-hover)",
    },
    trakt: {
        text: "var(--action-rose-text)",
        bg: "var(--action-rose-surface)",
        hoverBg: "var(--action-rose-surface-hover)",
        border: "var(--action-rose-border)",
        hoverBorder: "var(--action-rose-border-hover)",
    },
};

type LinkPillStyle = CSSProperties & {
    "--link-text"?: string;
    "--link-bg"?: string;
    "--link-hover-bg"?: string;
    "--link-border"?: string;
    "--link-hover-border"?: string;
};

function formatDirectors(directors: string[]) {
    if (directors.length === 0) return null;
    if (directors.length <= 2) return directors.join(" / ");
    return t("episode.directorsEtc", {
        names: directors.slice(0, 2).join(" / "),
        n: directors.length,
    });
}

function EpisodeMetaItem({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-border/45 bg-[var(--color-surface-2)]/72 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase text-muted-foreground">
                <span className="text-[var(--color-accent-light)]">{icon}</span>
                {label}
            </div>
            <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        </div>
    );
}

function ExternalLinkPill({
    href,
    label,
    tone,
}: {
    href: string;
    label: string;
    tone: ExternalLinkTone;
}) {
    const token = externalLinkTokens[tone];
    const style = {
        "--link-text": token.text,
        "--link-bg": token.bg,
        "--link-hover-bg": token.hoverBg,
        "--link-border": token.border,
        "--link-hover-border": token.hoverBorder,
    } as LinkPillStyle;

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("episode.openLink", { label })}
            className={cn(
                "group inline-flex h-9 items-center gap-2 rounded-full border border-[var(--link-border)] bg-[var(--link-bg)] px-3 text-xs font-bold text-[var(--link-text)] shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--link-hover-border)] hover:bg-[var(--link-hover-bg)] hover:shadow-lg active:translate-y-0",
            )}
            style={style}
        >
            <span>{label}</span>
            <ExternalLink className="size-3.5 opacity-60 transition group-hover:opacity-100" />
        </a>
    );
}

/** 删除确认弹框（多条历史时使用） */
function DeleteHistoryModal({
    entries,
    onConfirm,
    onClose,
}: {
    entries: WatchHistoryEntry[];
    onConfirm: (id: number) => void;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
                type="button"
                aria-label={t("common.close")}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="hud-panel-strong relative z-10 w-[420px] max-w-[90vw] rounded-[var(--radius-lg)] p-6 shadow-2xl">
                <h3 className="mb-1 text-base font-bold text-foreground">
                    {t("episode.deleteRecordTitle")}
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                    {t("episode.selectRecordToDelete")}
                </p>
                <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                    {entries.map((entry) => {
                        const label = entry.watchedAt
                            ? new Date(entry.watchedAt).toLocaleString("zh-CN", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                              })
                            : t("common.unknownTime");
                        return (
                            <Button
                                key={entry.id}
                                type="button"
                                variant="secondary"
                                color="rose"
                                size="md"
                                onClick={() => {
                                    onConfirm(entry.id);
                                    onClose();
                                }}
                                className="w-full justify-start"
                            >
                                {label}
                            </Button>
                        );
                    })}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    color="slate"
                    size="md"
                    onClick={onClose}
                    className="mt-4 w-full"
                >
                    {t("common.cancel")}
                </Button>
            </div>
        </div>
    );
}

export function EpisodeInfoCard({
    data,
    onHistoryClick,
    isWatched,
    onRefetch,
}: EpisodeInfoCardProps) {
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [confirmWatchOpen, setConfirmWatchOpen] = useState(false);
    const [confirmUnwatchOpen, setConfirmUnwatchOpen] = useState(false);

    const overview = data.translatedOverview ?? data.overview;
    const episodeCode = formatEpisode(data.seasonNumber, data.episodeNumber);
    const episodeTitle = data.translatedTitle ?? data.title ?? episodeCode;
    const originalTitle =
        data.translatedTitle && data.title && data.translatedTitle !== data.title
            ? data.title
            : null;
    const show = data.show;
    const showDisplayName = show.translatedName ?? show.title;
    const directorLabel = formatDirectors(data.directors);
    const runtimeLabel = fmtRuntime(data.runtime);
    const genres = show.genres?.slice(0, 3) ?? [];

    const { toast } = useToast();
    const markWatched = useMarkWatched(data.showId, data.seasonNumber, data.episodeNumber);
    const { data: historyEntries = [] } = useEpisodeHistory(
        data.showId,
        data.seasonNumber,
        data.episodeNumber,
    );
    const deleteHistory = useDeleteHistory(data.showId, data.seasonNumber, data.episodeNumber);
    const { data: jellyfinEpisode = null } = useJellyfinEpisode(
        data.show.tmdbId,
        data.seasonNumber,
        data.episodeNumber,
    );
    const deleteJellyfinItem = useDeleteJellyfinItem();
    const [confirmJellyfinDeleteOpen, setConfirmJellyfinDeleteOpen] = useState(false);

    async function handleJellyfinDelete() {
        if (!jellyfinEpisode) return;
        try {
            await deleteJellyfinItem.mutateAsync(jellyfinEpisode.id);
            toast(t("episode.deleteJellyfinSuccess"), "success");
        } catch {
            toast(t("episode.deleteJellyfinFailed"), "error");
        }
    }

    const handleMarkWatched = async (isoString: string) => {
        await markWatched.mutateAsync(isoString);
        setDatePickerOpen(false);
        onRefetch();
    };

    const handleUnwatch = async () => {
        if (historyEntries.length === 0) return;
        if (historyEntries.length === 1) {
            await deleteHistory.mutateAsync(historyEntries[0].id);
            onRefetch();
        } else {
            setDeleteModalOpen(true);
        }
    };

    const handleDeleteEntry = async (id: number) => {
        try {
            await deleteHistory.mutateAsync(id);
            setPendingDeleteId(null);
            setDeleteModalOpen(false);
            onRefetch();
        } catch (err) {
            console.error("Failed to delete history entry:", err);
        }
    };

    const traktUrl = show.traktSlug
        ? `https://trakt.tv/shows/${show.traktSlug}/seasons/${data.seasonNumber}/episodes/${data.episodeNumber}`
        : null;
    const tmdbUrl = show.tmdbId
        ? `https://www.themoviedb.org/tv/${show.tmdbId}/season/${data.seasonNumber}/episode/${data.episodeNumber}`
        : null;
    const imdbUrl = show.imdbId ? `https://www.imdb.com/title/${show.imdbId}` : null;
    const tvdbUrl = show.tvdbId ? `https://thetvdb.com/dereferrer/series/${show.tvdbId}` : null;

    const metaItems = [
        {
            label: t("episode.fieldSeasonEpisode"),
            value: t("episode.valueSeasonEpisode", {
                season: data.seasonNumber,
                episode: data.episodeNumber,
            }),
            icon: <CalendarDays className="size-3.5" />,
        },
        {
            label: t("episode.fieldFirstAir"),
            value: data.airDate ? fmtAirDate(data.airDate) : t("common.unknown"),
            icon: <Clock className="size-3.5" />,
        },
        {
            label: t("episode.fieldRuntime"),
            value: runtimeLabel || t("common.unknown"),
            icon: <Timer className="size-3.5" />,
        },
        ...(directorLabel
            ? [
                  {
                      label: t("episode.fieldDirector"),
                      value: directorLabel,
                      icon: <UserRound className="size-3.5" />,
                  },
              ]
            : []),
    ];

    return (
        <div className="flex min-w-0 flex-col">
            <div className="mb-5 flex flex-wrap items-center gap-2">
                <Tag
                    color="cyan"
                    variant="outline"
                    size="sm"
                    className="rounded-full px-3 py-1 tabular-nums"
                >
                    {episodeCode}
                </Tag>
                <span className="min-w-0 truncate text-sm font-semibold text-muted-foreground">
                    {showDisplayName}
                </span>
            </div>

            <div className="mb-6">
                <h1 className="text-3xl font-black leading-[1.08] text-foreground sm:text-4xl lg:text-5xl">
                    {episodeTitle}
                </h1>
                {originalTitle && (
                    <p className="mt-3 text-sm font-medium text-muted-foreground sm:text-base">
                        {originalTitle}
                    </p>
                )}
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metaItems.map((item) => (
                    <EpisodeMetaItem
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        value={item.value}
                    />
                ))}
            </div>

            <div className="mb-7 flex flex-wrap items-center gap-3">
                {data.traktRating != null && (
                    <div
                        className={cn(
                            "inline-flex items-center gap-3 rounded-xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                            data.traktRating >= 80 && "border-emerald-300/35 bg-emerald-300/10",
                            data.traktRating >= 60 &&
                                data.traktRating < 80 &&
                                "border-cyan-300/35 bg-cyan-300/10",
                            data.traktRating < 60 && "border-amber-300/35 bg-amber-300/10",
                        )}
                    >
                        <Star className="size-4 fill-current text-[var(--color-airing)]" />
                        <div className="leading-none">
                            <p className="text-lg font-black tabular-nums text-foreground">
                                {data.traktRating}
                                <span className="ml-0.5 text-xs text-muted-foreground">%</span>
                            </p>
                            <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">
                                {t("episode.traktRating")}
                            </p>
                        </div>
                    </div>
                )}

                {genres.map((genre) => (
                    <Tag
                        key={genre}
                        color="slate"
                        variant="outline"
                        size="sm"
                        className="rounded-full px-3 py-1"
                    >
                        {genre}
                    </Tag>
                ))}
            </div>

            <div className="mb-7 max-w-3xl">
                <p className="line-clamp-6 whitespace-pre-line text-base font-medium leading-8 text-muted-foreground/88 sm:text-lg">
                    {overview?.trim() || t("episode.noOverview")}
                </p>
            </div>

            {(imdbUrl || tmdbUrl || tvdbUrl || traktUrl) && (
                <div className="mb-8 flex flex-wrap items-center gap-2.5">
                    {imdbUrl && <ExternalLinkPill href={imdbUrl} label="IMDb" tone="imdb" />}
                    {tmdbUrl && <ExternalLinkPill href={tmdbUrl} label="TMDB" tone="tmdb" />}
                    {tvdbUrl && <ExternalLinkPill href={tvdbUrl} label="TVDB" tone="tvdb" />}
                    {traktUrl && <ExternalLinkPill href={traktUrl} label="Trakt" tone="trakt" />}
                </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border/45 pt-5 sm:flex-row sm:flex-wrap">
                <Button
                    type="button"
                    variant={isWatched ? "secondary" : "primary"}
                    color={isWatched ? "emerald" : "violet"}
                    size="md"
                    loading={markWatched.isPending || deleteHistory.isPending}
                    icon={
                        isWatched ? <CheckCheck className="size-4" /> : <Check className="size-4" />
                    }
                    onClick={
                        isWatched
                            ? () => setConfirmUnwatchOpen(true)
                            : () => setConfirmWatchOpen(true)
                    }
                    aria-label={isWatched ? t("episode.unwatch") : t("episode.markWatched")}
                    title={isWatched ? t("episode.clickToDelete") : t("episode.markWatched")}
                    className="w-full sm:w-[156px]"
                >
                    {isWatched ? t("common.watched") : t("episode.markWatchedShort")}
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    color="slate"
                    size="md"
                    icon={<Clock className="size-4" />}
                    onClick={onHistoryClick}
                    aria-label={t("episode.watchHistory")}
                    title={t("episode.watchHistory")}
                    className="w-full sm:w-[156px]"
                >
                    {t("episode.watchHistory")}
                </Button>

                {jellyfinEpisode && (
                    <Button
                        type="button"
                        variant="secondary"
                        color="rose"
                        size="md"
                        icon={<Trash2 className="size-4" />}
                        loading={deleteJellyfinItem.isPending}
                        onClick={() => setConfirmJellyfinDeleteOpen(true)}
                        aria-label={t("episode.deleteJellyfinFile")}
                        title={t("episode.deleteJellyfinFile")}
                        className="w-full sm:w-[156px]"
                    >
                        {t("episode.deleteJellyfinFile")}
                    </Button>
                )}
            </div>

            <DateTimePickerModal
                open={datePickerOpen}
                onClose={() => setDatePickerOpen(false)}
                onConfirm={handleMarkWatched}
            />

            {deleteModalOpen && (
                <DeleteHistoryModal
                    entries={historyEntries}
                    onConfirm={setPendingDeleteId}
                    onClose={() => setDeleteModalOpen(false)}
                />
            )}

            <ConfirmDialog
                isOpen={confirmWatchOpen}
                title={t("episode.markWatched")}
                description={t("episode.markWatchedDesc")}
                confirmText={t("episode.continue")}
                confirmColor="violet"
                cancelText={t("common.cancel")}
                onConfirm={() => {
                    setConfirmWatchOpen(false);
                    setDatePickerOpen(true);
                }}
                onCancel={() => setConfirmWatchOpen(false)}
            />

            <ConfirmDialog
                isOpen={pendingDeleteId !== null}
                title={t("episode.deleteRecordTitle")}
                description={t("episode.deleteRecordDesc")}
                confirmText={t("common.delete")}
                confirmColor="rose"
                cancelText={t("common.cancel")}
                isLoading={deleteHistory.isPending}
                onConfirm={async () => {
                    if (pendingDeleteId !== null) {
                        await handleDeleteEntry(pendingDeleteId);
                    }
                }}
                onCancel={() => setPendingDeleteId(null)}
            />

            <ConfirmDialog
                isOpen={confirmJellyfinDeleteOpen}
                title={t("episode.deleteJellyfinTitle")}
                description={t("episode.deleteJellyfinDesc")}
                confirmText={t("common.delete")}
                confirmColor="rose"
                cancelText={t("common.cancel")}
                isLoading={deleteJellyfinItem.isPending}
                onConfirm={async () => {
                    await handleJellyfinDelete();
                    setConfirmJellyfinDeleteOpen(false);
                }}
                onCancel={() => setConfirmJellyfinDeleteOpen(false)}
            />

            <ConfirmDialog
                isOpen={confirmUnwatchOpen}
                title={t("episode.unwatchTitle")}
                description={t("episode.unwatchDesc")}
                confirmText={t("common.delete")}
                confirmColor="rose"
                cancelText={t("common.cancel")}
                isLoading={deleteHistory.isPending}
                onConfirm={async () => {
                    try {
                        await handleUnwatch();
                        setConfirmUnwatchOpen(false);
                    } catch (err) {
                        console.error("Failed to unwatch:", err);
                    }
                }}
                onCancel={() => setConfirmUnwatchOpen(false)}
            />
        </div>
    );
}
