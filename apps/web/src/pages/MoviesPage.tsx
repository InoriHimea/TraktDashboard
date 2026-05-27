import { useState, useEffect } from "react";
import { Eye, EyeOff, LayoutGrid } from "lucide-react";
import { useMoviesProgress } from "../hooks";
import { MovieCard } from "../components/MovieCard";
import { MediaListPage, type MediaFilterOption } from "../components/MediaListPage";
import { t } from "../lib/i18n";

const FILTERS: MediaFilterOption[] = [
    { key: "watched", labelKey: "movies.watched", icon: Eye, color: "#10b981" },
    {
        key: "unwatched",
        labelKey: "movies.unwatched",
        icon: EyeOff,
        color: "#f59e0b",
    },
    { key: "all", labelKey: "common.all", icon: LayoutGrid, color: "#0ea5e9" },
];

export default function MoviesPage() {
    const [filter, setFilter] = useState("watched");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const timer = window.setTimeout(
            () => setDebouncedSearch(search.trim()),
            280,
        );
        return () => window.clearTimeout(timer);
    }, [search]);

    const {
        data: movies,
        isLoading,
        error,
        refetch,
        isFetching,
    } = useMoviesProgress(filter, debouncedSearch);

    return (
        <MediaListPage
            filters={FILTERS}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t("movies.searchPlaceholder")}
            items={movies}
            isLoading={isLoading}
            error={error}
            isFetching={isFetching}
            onRetry={() => refetch()}
            countLabel={t("movies.count", { count: movies?.length ?? 0 })}
            loadingLabel={t("movies.loading")}
            errorLabel={t("movies.loadFailed")}
            emptyLabel={t("movies.empty")}
            searchEmptyLabel={t("common.noSearchResults", { query: debouncedSearch })}
            importHint={t("common.importHint")}
            renderItem={(progress, i) => (
                <MovieCard key={progress.movie.id} movie={progress} index={i} />
            )}
            hideFilters
        />
    );
}
