import { useState, useEffect } from "react";
import { Tv2, CheckCircle2, LayoutGrid } from "lucide-react";
import { useShowsProgress } from "../hooks";
import { ShowCard } from "../components/ShowCard";
import { MediaListPage, type MediaFilterOption } from "../components/MediaListPage";
import { UpNextBanner } from "../components/UpNextBanner";
import { t } from "../lib/i18n";

const FILTERS: MediaFilterOption[] = [
    { key: "watching", labelKey: "progress.watching", icon: Tv2, color: "#7c6af7" },
    {
        key: "completed",
        labelKey: "progress.completed",
        icon: CheckCircle2,
        color: "#10b981",
    },
    { key: "all", labelKey: "common.all", icon: LayoutGrid, color: "#0ea5e9" },
];

export default function TVShowsPage() {
    const [filter, setFilter] = useState("watching");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
        return () => window.clearTimeout(timer);
    }, [search]);

    const {
        data: shows,
        isLoading,
        error,
        refetch,
        isFetching,
    } = useShowsProgress(filter, debouncedSearch);

    return (
        <MediaListPage
            filters={FILTERS}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t("progress.searchPlaceholder")}
            items={shows}
            isLoading={isLoading}
            error={error}
            isFetching={isFetching}
            onRetry={() => refetch()}
            countLabel={t("progress.count", { count: shows?.length ?? 0 })}
            loadingLabel={t("progress.loading")}
            errorLabel={t("progress.loadFailed")}
            emptyLabel={t("progress.empty")}
            searchEmptyLabel={t("common.noSearchResults", { query: debouncedSearch })}
            importHint={t("common.importHint")}
            headerSlot={debouncedSearch ? undefined : <UpNextBanner />}
            renderItem={(progress, i) => (
                <ShowCard key={progress.show.id} progress={progress} index={i} />
            )}
        />
    );
}
