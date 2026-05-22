import { AnimatePresence, motion } from "framer-motion";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { t } from "../lib/i18n";

export interface MediaFilterOption {
    key: string;
    labelKey: string;
    icon: LucideIcon;
    color: string;
}

interface MediaListPageProps<T> {
    filters: MediaFilterOption[];
    filter: string;
    onFilterChange: (filter: string) => void;
    search: string;
    onSearchChange: (search: string) => void;
    searchPlaceholder: string;
    items: T[] | undefined;
    isLoading: boolean;
    error: unknown;
    isFetching: boolean;
    onRetry: () => void;
    countLabel: string;
    loadingLabel: string;
    errorLabel: string;
    emptyLabel: string;
    searchEmptyLabel: string;
    importHint: string;
    renderItem: (item: T, index: number) => React.ReactNode;
}

export function MediaListPage<T>({
    filters,
    filter,
    onFilterChange,
    search,
    onSearchChange,
    searchPlaceholder,
    items,
    isLoading,
    error,
    isFetching,
    onRetry,
    countLabel,
    loadingLabel,
    errorLabel,
    emptyLabel,
    searchEmptyLabel,
    importHint,
    renderItem,
}: MediaListPageProps<T>) {
    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
            <div className="sticky top-[56px] z-30 bg-[var(--color-bg)] border-b border-[var(--color-border-subtle)] backdrop-blur-xl">
                <div className="max-w-[1920px] mx-auto px-8 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-[3px]">
                        {filters.map(({ key, labelKey, icon: Icon, color }) => (
                            <motion.button
                                key={key}
                                onClick={() => onFilterChange(key)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-sm)] text-[13px] cursor-pointer transition-all duration-150"
                                style={{
                                    fontWeight: filter === key ? 600 : 400,
                                    color: filter === key ? color : "var(--color-text-secondary)",
                                    background: filter === key ? `${color}18` : "transparent",
                                    border: filter === key ? `1px solid ${color}40` : "1px solid transparent",
                                }}
                            >
                                <Icon
                                    size={13}
                                    color={filter === key ? color : "var(--color-text-muted)"}
                                />
                                {t(labelKey)}
                            </motion.button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 flex-1 max-w-[320px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-1.5">
                        <Search size={13} className="text-[var(--color-text-muted)] shrink-0" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            style={{
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "var(--color-text)",
                                fontSize: "13px",
                                width: "100%",
                            }}
                        />
                        {search && (
                            <button
                                onClick={() => onSearchChange("")}
                                aria-label={t("common.clearSearch")}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "var(--color-text-muted)",
                                    cursor: "pointer",
                                    padding: 0,
                                }}
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {isFetching && !isLoading && (
                        <Loader2
                            size={14}
                            className="animate-spin"
                            style={{ color: "var(--color-text-muted)" }}
                        />
                    )}

                    <span
                        style={{
                            fontSize: "12px",
                            color: "var(--color-text-muted)",
                            marginLeft: "auto",
                        }}
                    >
                        {items ? countLabel : ""}
                    </span>
                </div>
            </div>

            <div className="max-w-[1920px] mx-auto px-8 py-6">
                {isLoading ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-3 pt-20"
                    >
                        <Loader2
                            size={24}
                            className="animate-spin text-[var(--color-accent)]"
                        />
                        <p className="text-[var(--color-text-muted)] text-sm">
                            {loadingLabel}
                        </p>
                    </motion.div>
                ) : error ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-3 pt-20"
                    >
                        <p className="text-[var(--color-error)] text-sm">
                            {errorLabel}
                        </p>
                        <button
                            onClick={onRetry}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[13px] cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
                        >
                            <RefreshCw size={13} /> {t("common.retry")}
                        </button>
                    </motion.div>
                ) : items?.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center pt-20"
                    >
                        <p className="text-[var(--color-text-muted)] text-sm mb-1.5">
                            {search ? searchEmptyLabel : emptyLabel}
                        </p>
                        {!search && (
                            <p className="text-[var(--color-text-muted)] text-xs">
                                {importHint}
                            </p>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="grid gap-4"
                        style={{
                            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                        }}
                    >
                        <AnimatePresence mode="popLayout">
                            {items?.map((item, i) => renderItem(item, i))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
