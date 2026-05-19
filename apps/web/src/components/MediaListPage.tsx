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
        <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
            <div
                style={{
                    position: "sticky",
                    top: "56px",
                    zIndex: 30,
                    background: "var(--color-bg)",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    backdropFilter: "blur(12px)",
                }}
            >
                <div
                    style={{
                        maxWidth: "1920px",
                        margin: "0 auto",
                        padding: "12px 32px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "2px",
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            padding: "3px",
                        }}
                    >
                        {filters.map(({ key, labelKey, icon: Icon, color }) => (
                            <button
                                key={key}
                                onClick={() => onFilterChange(key)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "5px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "13px",
                                    fontWeight: filter === key ? 600 : 400,
                                    color:
                                        filter === key
                                            ? color
                                            : "var(--color-text-secondary)",
                                    background:
                                        filter === key
                                            ? `${color}18`
                                            : "transparent",
                                    border:
                                        filter === key
                                            ? `1px solid ${color}40`
                                            : "1px solid transparent",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                }}
                            >
                                <Icon
                                    size={13}
                                    color={
                                        filter === key
                                            ? color
                                            : "var(--color-text-muted)"
                                    }
                                />
                                {t(labelKey)}
                            </button>
                        ))}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flex: 1,
                            maxWidth: "320px",
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            padding: "6px 12px",
                        }}
                    >
                        <Search
                            size={13}
                            style={{
                                color: "var(--color-text-muted)",
                                flexShrink: 0,
                            }}
                        />
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

            <div
                style={{
                    maxWidth: "1920px",
                    margin: "0 auto",
                    padding: "24px 32px",
                }}
            >
                {isLoading ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                            paddingTop: "80px",
                        }}
                    >
                        <Loader2
                            size={24}
                            className="animate-spin"
                            style={{ color: "var(--color-accent)" }}
                        />
                        <p
                            style={{
                                color: "var(--color-text-muted)",
                                fontSize: "14px",
                            }}
                        >
                            {loadingLabel}
                        </p>
                    </div>
                ) : error ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                            paddingTop: "80px",
                        }}
                    >
                        <p
                            style={{
                                color: "var(--color-error)",
                                fontSize: "14px",
                            }}
                        >
                            {errorLabel}
                        </p>
                        <button
                            onClick={onRetry}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "8px 14px",
                                borderRadius: "var(--radius-md)",
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                                color: "var(--color-text-secondary)",
                                fontSize: "13px",
                                cursor: "pointer",
                            }}
                        >
                            <RefreshCw size={13} /> {t("common.retry")}
                        </button>
                    </div>
                ) : items?.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ textAlign: "center", paddingTop: "80px" }}
                    >
                        <p
                            style={{
                                color: "var(--color-text-muted)",
                                fontSize: "14px",
                                marginBottom: "6px",
                            }}
                        >
                            {search ? searchEmptyLabel : emptyLabel}
                        </p>
                        {!search && (
                            <p
                                style={{
                                    color: "var(--color-text-muted)",
                                    fontSize: "12px",
                                }}
                            >
                                {importHint}
                            </p>
                        )}
                    </motion.div>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(150px, 1fr))",
                            gap: "16px",
                        }}
                    >
                        <AnimatePresence mode="popLayout">
                            {items?.map((item, i) => renderItem(item, i))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
