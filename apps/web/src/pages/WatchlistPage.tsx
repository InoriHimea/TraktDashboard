import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tv2, Film, LayoutGrid, Trash2, Loader2, Search } from "lucide-react";
import { useWatchlist, useRemoveFromWatchlist } from "../hooks";
import type { WatchlistShowItem, WatchlistMovieItem } from "@trakt-dashboard/types";
import { tmdbImage } from "../lib/utils";
import { getLocale, t } from "../lib/i18n";
import { useToast } from "../lib/toast";

type FilterType = "all" | "shows" | "movies";

const FILTERS: { key: FilterType; labelKey: string; icon: typeof Tv2 }[] = [
    { key: "all", labelKey: "watchlist.all", icon: LayoutGrid },
    { key: "shows", labelKey: "watchlist.shows", icon: Tv2 },
    { key: "movies", labelKey: "watchlist.movies", icon: Film },
];

function isShowItem(item: WatchlistShowItem | WatchlistMovieItem): item is WatchlistShowItem {
    return "show" in item;
}

function WatchlistCard({
    item,
    index,
    onRemove,
    removing,
}: {
    item: WatchlistShowItem | WatchlistMovieItem;
    index: number;
    onRemove: (id: number) => void;
    removing: boolean;
}) {
    const [imgError, setImgError] = useState(false);
    const isShow = isShowItem(item);
    const media = isShow ? item.show : item.movie;
    const poster = tmdbImage(media.posterPath, "w500");
    const href = isShow ? `/shows/${media.id}` : `/movies/${media.id}`;
    const addedDate = new Date(item.addedAt).toLocaleDateString(getLocale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            className="group relative overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-xl hover:shadow-black/20"
        >
            <Link to={href} className="block">
                <div className="aspect-[2/3] relative overflow-hidden bg-[var(--color-surface-3)]">
                    {poster && !imgError ? (
                        <img
                            src={poster}
                            alt={media.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            {isShow ? (
                                <Tv2 className="w-10 h-10 text-[var(--color-text-muted)]" />
                            ) : (
                                <Film className="w-10 h-10 text-[var(--color-text-muted)]" />
                            )}
                        </div>
                    )}
                    <div className="absolute top-2 left-2">
                        <span
                            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md"
                            style={{
                                background: isShow
                                    ? "linear-gradient(135deg, rgba(124,106,247,0.9), rgba(124,106,247,0.45))"
                                    : "linear-gradient(135deg, rgba(16,185,129,0.9), rgba(16,185,129,0.45))",
                            }}
                        >
                            {isShow ? t("watchlist.shows") : t("watchlist.movies")}
                        </span>
                    </div>
                </div>
                <div className="min-h-[86px] p-3.5">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-text)]">
                        {media.title}
                    </h3>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                        {t("watchlist.addedOn", { date: addedDate })}
                    </p>
                </div>
            </Link>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    onRemove(item.id);
                }}
                disabled={removing}
                className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/60 p-2 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity hover:bg-red-600 group-hover:opacity-100 disabled:opacity-50"
                title={t("watchlist.removeFromWatchlist")}
            >
                {removing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                )}
            </button>
        </motion.div>
    );
}

export default function WatchlistPage() {
    const [filter, setFilter] = useState<FilterType>("all");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [removingId, setRemovingId] = useState<number | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
        return () => window.clearTimeout(timer);
    }, [search]);

    const {
        data: items,
        isLoading,
        error,
        refetch,
    } = useWatchlist(filter === "all" ? undefined : filter);
    const removeFromWatchlist = useRemoveFromWatchlist();

    const filtered = items?.filter((item) => {
        if (!debouncedSearch) return true;
        const media = isShowItem(item) ? item.show : item.movie;
        return media.title.toLowerCase().includes(debouncedSearch.toLowerCase());
    });

    const handleRemove = async (id: number) => {
        setRemovingId(id);
        try {
            await removeFromWatchlist.mutateAsync(id);
            toast(t("watchlist.removeSuccess"), "success");
        } catch {
            toast(t("watchlist.removeFailed"), "error", {
                label: t("common.retry"),
                onClick: () => handleRemove(id),
            });
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] text-[var(--color-text)]">
            <div className="app-container py-8">
                {/* Header */}
                <div className="mb-7 flex flex-col gap-2">
                    <h1 className="text-[clamp(28px,4vw,52px)] font-bold leading-none tracking-[-0.045em] text-[var(--color-text)]">
                        {t("watchlist.title")}
                    </h1>
                    {filtered && (
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {t("watchlist.count", { count: filtered.length })}
                        </p>
                    )}
                </div>

                {/* Filters + Search */}
                <div className="mb-7 flex flex-col gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2 shadow-lg shadow-black/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
                        {FILTERS.map(({ key, labelKey, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                                    filter === key
                                        ? "border-[var(--color-border-focus)] bg-[var(--color-accent-dim)] text-[var(--color-accent-light)]"
                                        : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {t(labelKey)}
                            </button>
                        ))}
                    </div>
                    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-muted)] sm:max-w-md">
                        <Search className="h-4 w-4 shrink-0" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t("watchlist.searchPlaceholder")}
                            className="min-w-0 flex-1 bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none"
                        />
                    </label>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)]">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        {t("watchlist.loading")}
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <p className="text-[var(--color-error)]">{t("watchlist.loadFailed")}</p>
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm"
                        >
                            Retry
                        </button>
                    </div>
                ) : !filtered?.length ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2 text-[var(--color-text-muted)]">
                        <LayoutGrid className="w-10 h-10 opacity-30" />
                        <p className="font-medium">{t("watchlist.empty")}</p>
                        <p className="text-sm">{t("watchlist.emptyHint")}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-5">
                        {filtered.map((item, index) => (
                            <WatchlistCard
                                key={item.id}
                                item={item}
                                index={index}
                                onRemove={handleRemove}
                                removing={removingId === item.id}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
