import { useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { t } from "../lib/i18n";
import { Button } from "./ui/Button";

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
    hideFilters?: boolean;
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
    hideFilters = false,
}: MediaListPageProps<T>) {
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (
                e.key === "/" &&
                document.activeElement?.tagName !== "INPUT" &&
                document.activeElement?.tagName !== "TEXTAREA"
            ) {
                e.preventDefault();
                searchRef.current?.focus();
            }
            if (e.key === "Escape" && document.activeElement === searchRef.current) {
                onSearchChange("");
                searchRef.current?.blur();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onSearchChange]);

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)]">
            <div className="sticky top-[var(--app-nav-height)] z-30 bg-[var(--color-bg)] border-b border-[var(--color-border-subtle)] backdrop-blur-xl">
                <div className="app-container py-3 flex items-center gap-3 flex-wrap">
                    {!hideFilters && (
                        <div className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg shadow-black/10">
                            {filters.map(({ key, labelKey, icon: Icon, color }) => {
                                const active = filter === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => onFilterChange(key)}
                                        className={`halo halo-hover inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors${active ? " is-selected" : ""}`}
                                        style={{
                                            color: active ? color : "var(--color-text-secondary)",
                                            background: active ? `${color}18` : "transparent",
                                            borderColor: "transparent",
                                        }}
                                    >
                                        <Icon
                                            size={13}
                                            color={active ? color : "var(--color-text-muted)"}
                                        />
                                        {t(labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 shadow-lg shadow-black/10 sm:max-w-[380px]">
                        <Search size={13} className="text-[var(--color-text-muted)] shrink-0" />
                        <input
                            ref={searchRef}
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

            <div className="app-container py-6">
                {isLoading ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-3 pt-20"
                    >
                        <Loader2 size={24} className="animate-spin text-[var(--color-accent)]" />
                        <p className="text-[var(--color-text-muted)] text-sm">{loadingLabel}</p>
                    </motion.div>
                ) : error ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-3 pt-20"
                    >
                        <p className="text-[var(--color-error)] text-sm">{errorLabel}</p>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<RefreshCw size={13} />}
                            onClick={onRetry}
                        >
                            {t("common.retry")}
                        </Button>
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
                            <p className="text-[var(--color-text-muted)] text-xs">{importHint}</p>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="grid gap-5"
                        style={{
                            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
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
