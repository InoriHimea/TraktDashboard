import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Tv2,
    Film,
    LayoutGrid,
    Clock,
    Download,
    Loader2,
    ChevronDown,
    Upload,
    X,
} from "lucide-react";
import { useInfiniteHistory, useRatings } from "../hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import type { HistoryEntry } from "@trakt-dashboard/types";
import { tmdbImage } from "../lib/utils";
import { getLocale, t } from "../lib/i18n";
import { api } from "../lib/api";

type MediaFilter = "all" | "episode" | "movie";

const FILTERS: { key: MediaFilter; labelKey: string; icon: typeof Tv2 }[] = [
    { key: "all", labelKey: "history.all", icon: LayoutGrid },
    { key: "episode", labelKey: "history.episodes", icon: Tv2 },
    { key: "movie", labelKey: "history.movies", icon: Film },
];

function formatWatchedAt(iso: string | null | undefined): string {
    if (!iso) return t("common.unknown");
    return new Date(iso).toLocaleString(getLocale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDateGroup(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return t("history.today");
    if (date.toDateString() === yesterday.toDateString()) return t("history.yesterday");
    return date.toLocaleDateString(getLocale(), { year: "numeric", month: "long", day: "numeric" });
}

function groupByDate(entries: HistoryEntry[]): [string, HistoryEntry[]][] {
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of entries) {
        const key = entry.watchedAt ? entry.watchedAt.slice(0, 10) : "unknown";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(entry);
    }
    return [...map.entries()];
}

function HistoryPosterCard({
    entry,
    index,
    rating,
}: {
    entry: HistoryEntry;
    index: number;
    rating?: number;
}) {
    const isEpisode = entry.mediaType === "episode";
    const [imgError, setImgError] = useState(false);
    const poster = isEpisode
        ? tmdbImage(entry.show?.posterPath ?? null, "w342")
        : tmdbImage(entry.movie?.posterPath ?? null, "w342");
    const href = isEpisode ? `/shows/${entry.show?.id}` : `/movies/${entry.movie?.id}`;
    const title = isEpisode
        ? (entry.show?.translatedName ?? entry.show?.title ?? "—")
        : (entry.movie?.title ?? "—");
    const episodeCode =
        isEpisode && entry.episode
            ? `S${String(entry.episode.seasonNumber).padStart(2, "0")} E${String(entry.episode.episodeNumber).padStart(2, "0")}`
            : null;
    const episodeTitle = isEpisode ? (entry.episode?.title ?? null) : null;
    const watchTime = entry.watchedAt
        ? new Date(entry.watchedAt).toLocaleTimeString(getLocale(), {
              hour: "2-digit",
              minute: "2-digit",
          })
        : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.22,
                delay: Math.min(index * 0.015, 0.3),
                ease: [0.16, 1, 0.3, 1],
            }}
        >
            <Link to={href} className="block no-underline">
                <motion.div
                    whileHover={{
                        backgroundColor: "var(--color-surface-2)",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                    }}
                    transition={{ duration: 0.12 }}
                    style={{
                        display: "flex",
                        borderRadius: "12px",
                        overflow: "hidden",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border-subtle)",
                        cursor: "pointer",
                    }}
                >
                    {/* Left: portrait poster thumbnail */}
                    <div
                        style={{
                            width: 72,
                            flexShrink: 0,
                            background: "var(--color-surface-3)",
                            position: "relative",
                        }}
                    >
                        {poster && !imgError ? (
                            <img
                                src={poster}
                                alt={title}
                                onError={() => setImgError(true)}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                }}
                                loading="lazy"
                            />
                        ) : (
                            <div
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    minHeight: 108,
                                }}
                            >
                                {isEpisode ? (
                                    <Tv2
                                        size={20}
                                        color="var(--color-text-muted)"
                                        style={{ opacity: 0.3 }}
                                    />
                                ) : (
                                    <Film
                                        size={20}
                                        color="var(--color-text-muted)"
                                        style={{ opacity: 0.3 }}
                                    />
                                )}
                            </div>
                        )}
                        {/* Media type badge — bottom of poster */}
                        <div
                            style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: "12px 4px 4px",
                                background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                                display: "flex",
                                justifyContent: "center",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 8,
                                    fontWeight: 800,
                                    letterSpacing: "0.08em",
                                    color: isEpisode ? "#a5b4fc" : "#fcd34d",
                                }}
                            >
                                {isEpisode ? "EP" : "FILM"}
                            </span>
                        </div>
                    </div>

                    {/* Right: info */}
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "11px 14px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: 4,
                        }}
                    >
                        {/* Top section */}
                        <div style={{ minWidth: 0 }}>
                            {episodeCode && (
                                <p
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: "#818cf8",
                                        margin: "0 0 3px",
                                        letterSpacing: "0.04em",
                                    }}
                                >
                                    {episodeCode}
                                </p>
                            )}
                            <h3
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "var(--color-text)",
                                    margin: 0,
                                    lineHeight: 1.35,
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                }}
                            >
                                {title}
                            </h3>
                            {episodeTitle && (
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--color-text-secondary)",
                                        margin: "3px 0 0",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {episodeTitle}
                                </p>
                            )}
                        </div>

                        {/* Bottom: time + rating */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 6,
                                marginTop: 2,
                            }}
                        >
                            {watchTime && (
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: "var(--color-text-muted)",
                                    }}
                                >
                                    {watchTime}
                                </span>
                            )}
                            {rating !== undefined ? (
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "#fbbf24",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 3,
                                        flexShrink: 0,
                                    }}
                                >
                                    ★ {rating}
                                </span>
                            ) : (
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: "var(--color-text-muted)",
                                        opacity: 0.35,
                                        flexShrink: 0,
                                    }}
                                >
                                    ☆
                                </span>
                            )}
                        </div>
                    </div>
                </motion.div>
            </Link>
        </motion.div>
    );
}

type ImportResult = { imported: number; skipped: number; errors: string[] } | null;

export default function HistoryPage() {
    const [filter, setFilter] = useState<MediaFilter>("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const qc = useQueryClient();

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        setImporting(true);
        setImportResult(null);
        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as unknown;
            const entries = Array.isArray(parsed)
                ? parsed
                : (parsed as Record<string, unknown>)?.entries;
            if (!Array.isArray(entries)) throw new Error(t("history.import.invalidFormat"));
            const result = await api.history.import(entries);
            setImportResult({
                imported: result.imported,
                skipped: result.skipped,
                errors: result.errors,
            });
            if (result.imported > 0) {
                qc.invalidateQueries({ queryKey: queryKeys.history.all });
            }
        } catch (err) {
            setImportResult({ imported: 0, skipped: 0, errors: [String(err)] });
        } finally {
            setImporting(false);
        }
    }

    const { data: ratingsData } = useRatings();
    const ratingsMap = new Map<string, number>();
    for (const r of ratingsData ?? []) {
        if (r.mediaType === "show" && r.showId != null)
            ratingsMap.set(`show:${r.showId}`, r.rating);
        if (r.mediaType === "movie" && r.movieId != null)
            ratingsMap.set(`movie:${r.movieId}`, r.rating);
    }

    const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, error, refetch } =
        useInfiniteHistory(filter, startDate || undefined, endDate || undefined);

    const loadedEntries = data?.pages.flatMap((p) => p.entries) ?? [];
    const total = data?.pages.at(-1)?.total ?? 0;
    const groups = groupByDate(loadedEntries);

    const exportUrl = api.history.export(
        filter,
        "csv",
        startDate || undefined,
        endDate || undefined,
    );

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] text-[var(--color-text)]">
            <div className="app-container py-8">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg border border-[var(--action-cyan-border)] bg-[var(--action-cyan-surface)] text-[var(--action-cyan-text)]">
                            <Clock className="size-[15px]" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h1 className="text-lg font-semibold leading-tight">
                                {t("history.title")}
                            </h1>
                            {total > 0 && (
                                <span className="text-xs text-[var(--color-text-muted)]">
                                    {t("history.count", { count: total })}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Import JSON */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={handleImport}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)] disabled:opacity-50"
                            title={t("history.import.button")}
                        >
                            {importing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4" />
                            )}
                            <span className="hidden sm:inline">{t("history.import.button")}</span>
                        </button>
                        {/* Export CSV */}
                        <a
                            href={exportUrl}
                            download="watch-history.csv"
                            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                            title={t("history.exportCsv")}
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">{t("history.exportCsv")}</span>
                        </a>
                    </div>
                </div>

                {/* Import result banner */}
                {importResult && (
                    <div
                        className={`mb-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                            importResult.errors.length > 0
                                ? "border-red-800/40 bg-red-950/30 text-red-300"
                                : "border-green-800/40 bg-green-950/30 text-green-300"
                        }`}
                    >
                        <div>
                            <p className="font-semibold">
                                {t("history.import.resultTitle", {
                                    imported: importResult.imported,
                                    skipped: importResult.skipped,
                                })}
                            </p>
                            {importResult.errors.length > 0 && (
                                <ul className="mt-1 list-disc pl-4 text-xs opacity-80">
                                    {importResult.errors.slice(0, 5).map((e, i) => (
                                        <li key={i}>{e}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <button
                            onClick={() => setImportResult(null)}
                            className="mt-0.5 shrink-0 opacity-60 hover:opacity-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Controls */}
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    {/* Media type filter */}
                    <div className="flex gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
                        {FILTERS.map(({ key, labelKey, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
                                    filter === key
                                        ? "border-[var(--color-border-focus)] bg-[var(--color-accent-dim)] text-[var(--color-accent-light)]"
                                        : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {t(labelKey)}
                            </button>
                        ))}
                    </div>

                    {/* Date range */}
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)] [color-scheme:dark]"
                            placeholder={t("history.startDate")}
                        />
                        <span>–</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)] [color-scheme:dark]"
                            placeholder={t("history.endDate")}
                        />
                        {(startDate || endDate) && (
                            <button
                                onClick={() => {
                                    setStartDate("");
                                    setEndDate("");
                                }}
                                className="text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
                            >
                                {t("common.clearSearch")}
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)]">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {t("history.loading")}
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-3 py-20">
                        <p className="text-[var(--color-error)]">{t("history.loadFailed")}</p>
                        <button
                            onClick={() => refetch()}
                            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm text-white"
                        >
                            {t("common.retry")}
                        </button>
                    </div>
                ) : loadedEntries.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-20 text-[var(--color-text-muted)]">
                        <Clock className="h-10 w-10 opacity-30" />
                        <p className="font-medium">{t("history.empty")}</p>
                        <p className="text-sm">{t("history.emptyHint")}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {(() => {
                            let cardCursor = 0;
                            return groups.map(([dateKey, groupEntries], gi) => {
                                const startIdx = cardCursor;
                                cardCursor += groupEntries.length;
                                return (
                                    <motion.section
                                        key={dateKey}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: gi * 0.04 }}
                                    >
                                        <h2 className="mb-4 text-sm font-bold text-[var(--color-text)]">
                                            {dateKey === "unknown"
                                                ? t("common.unknown")
                                                : formatDateGroup(dateKey)}
                                            <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                                                {groupEntries.length} 条
                                            </span>
                                        </h2>
                                        <div
                                            className="grid gap-3"
                                            style={{
                                                gridTemplateColumns:
                                                    "repeat(auto-fill, minmax(min(100%, 360px), 1fr))",
                                            }}
                                        >
                                            {groupEntries.map((entry, i) => {
                                                const ratingKey =
                                                    entry.mediaType === "episode"
                                                        ? `show:${entry.show?.id}`
                                                        : `movie:${entry.movie?.id}`;
                                                return (
                                                    <HistoryPosterCard
                                                        key={entry.id}
                                                        entry={entry}
                                                        index={startIdx + i}
                                                        rating={ratingsMap.get(ratingKey)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </motion.section>
                                );
                            });
                        })()}

                        {/* Load more */}
                        {(hasNextPage || isFetchingNextPage) && (
                            <div className="flex justify-center mt-2">
                                {isFetchingNextPage ? (
                                    <div className="inline-flex items-center gap-2 px-6 py-2.5 text-sm text-[var(--color-text-muted)]">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {t("history.loading")}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fetchNextPage()}
                                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-2.5 text-sm text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                        {t("history.loadMore")}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
