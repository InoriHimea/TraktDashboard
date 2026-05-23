import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tv2, Film, LayoutGrid, Trash2, Loader2 } from "lucide-react";
import { useWatchlist, useRemoveFromWatchlist } from "../hooks";
import type { WatchlistShowItem, WatchlistMovieItem } from "@trakt-dashboard/types";
import { tmdbImage } from "../lib/utils";
import { t } from "../lib/i18n";
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
    const poster = tmdbImage(media.posterPath, "w300");
    const href = isShow ? `/tv-shows/${media.id}` : `/movies/${media.id}`;
    const addedDate = new Date(item.addedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            className="group relative rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
        >
            <Link to={href} className="block">
                <div className="aspect-[2/3] relative overflow-hidden bg-[var(--color-surface-alt)]">
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
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                                background: isShow ? "rgba(124,106,247,0.85)" : "rgba(16,185,129,0.85)",
                                color: "#fff",
                            }}
                        >
                            {isShow ? t("watchlist.shows") : t("watchlist.movies")}
                        </span>
                    </div>
                </div>
                <div className="p-3">
                    <h3 className="text-sm font-semibold text-[var(--color-text)] line-clamp-2 leading-snug">
                        {media.title}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
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
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
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

    const { data: items, isLoading, error, refetch } = useWatchlist(
        filter === "all" ? undefined : filter,
    );
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
            toast(t("watchlist.removeFailed"), "error");
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">
                        {t("watchlist.title")}
                    </h1>
                    {filtered && (
                        <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            {t("watchlist.count", { count: filtered.length })}
                        </p>
                    )}
                </div>

                {/* Filters + Search */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="flex gap-2">
                        {FILTERS.map(({ key, labelKey, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    filter === key
                                        ? "bg-[var(--color-accent)] text-white"
                                        : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {t(labelKey)}
                            </button>
                        ))}
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("watchlist.searchPlaceholder")}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
