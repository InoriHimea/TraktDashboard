import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Check, Film, Tv2 } from "lucide-react";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import { tmdbImage } from "../lib/image";
import type { SearchResult } from "@trakt-dashboard/types";

interface SearchModalProps {
    onClose: () => void;
}

export function SearchModal({ onClose }: SearchModalProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
    const inputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    // Debounced search
    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (query.length < 2) return;
        timerRef.current = setTimeout(async () => {
            setLoading(true);
            setError(false);
            try {
                const res = await api.search.query(query);
                setResults(res.data ?? []);
            } catch {
                setError(true);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [query]);

    async function handleAdd(r: SearchResult) {
        if (addingIds.has(r.traktId) || addedIds.has(r.traktId) || r.inWatchlist) return;
        setAddingIds((prev) => new Set(prev).add(r.traktId));
        try {
            if (r.localId != null) {
                await api.watchlist.add(r.type, r.localId);
            } else {
                await api.search.watchlistAdd(r.type, r.traktId, r.tmdbId ?? undefined);
            }
            setAddedIds((prev) => new Set(prev).add(r.traktId));
        } catch {
            // silently ignore; user can retry
        } finally {
            setAddingIds((prev) => {
                const next = new Set(prev);
                next.delete(r.traktId);
                return next;
            });
        }
    }

    const isAdded = (r: SearchResult) => r.inWatchlist || addedIds.has(r.traktId);
    const isAdding = (r: SearchResult) => addingIds.has(r.traktId);

    // Below the min-length threshold, ignore stale results/error from a previous longer query.
    const displayResults = query.length >= 2 ? results : [];
    const displayError = query.length >= 2 ? error : false;

    return (
        <>
            {/* Backdrop */}
            <div
                aria-hidden="true"
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 100,
                    background: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                }}
            />

            {/* Modal */}
            <div
                style={{
                    position: "fixed",
                    top: "80px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 101,
                    width: "min(600px, calc(100vw - 32px))",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "16px",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
                    overflow: "hidden",
                }}
            >
                {/* Input row */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "14px 16px",
                        borderBottom:
                            displayResults.length > 0 || loading || displayError
                                ? "1px solid var(--color-border-subtle)"
                                : "none",
                    }}
                >
                    {loading ? (
                        <Loader2
                            size={16}
                            style={{
                                color: "var(--color-accent)",
                                flexShrink: 0,
                                animation: "spin 1s linear infinite",
                            }}
                        />
                    ) : (
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--color-text-muted)"
                            strokeWidth="2"
                            style={{ flexShrink: 0 }}
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35" />
                        </svg>
                    )}
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("search.placeholder")}
                        style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "var(--color-text)",
                            fontSize: "15px",
                            fontFamily: "var(--font-body)",
                        }}
                    />
                    <span
                        style={{
                            fontSize: "11px",
                            color: "var(--color-text-muted)",
                            flexShrink: 0,
                        }}
                    >
                        {t("search.hint")}
                    </span>
                </div>

                {/* Results / States */}
                {displayError && (
                    <div
                        style={{
                            padding: "16px",
                            fontSize: "13px",
                            color: "#f87171",
                            textAlign: "center",
                        }}
                    >
                        {t("search.error")}
                    </div>
                )}

                {!displayError && query.length >= 2 && !loading && displayResults.length === 0 && (
                    <div
                        style={{
                            padding: "24px 16px",
                            fontSize: "13px",
                            color: "var(--color-text-muted)",
                            textAlign: "center",
                        }}
                    >
                        {t("search.noResults")}
                    </div>
                )}

                {!displayError && query.length < 2 && query.length > 0 && (
                    <div
                        style={{
                            padding: "16px",
                            fontSize: "12px",
                            color: "var(--color-text-muted)",
                            textAlign: "center",
                        }}
                    >
                        {t("search.minChars")}
                    </div>
                )}

                {displayResults.length > 0 && (
                    <ul
                        style={{
                            listStyle: "none",
                            margin: 0,
                            padding: "8px 0",
                            maxHeight: "400px",
                            overflowY: "auto",
                        }}
                    >
                        {displayResults.map((r) => {
                            const poster = r.posterPath ? tmdbImage(r.posterPath, "w92") : null;
                            const added = isAdded(r);
                            const adding = isAdding(r);
                            return (
                                <li
                                    key={`${r.type}-${r.traktId}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        padding: "8px 16px",
                                        transition: "background 0.15s",
                                    }}
                                    onMouseEnter={(e) =>
                                        (e.currentTarget.style.background =
                                            "var(--color-surface-3)")
                                    }
                                    onMouseLeave={(e) =>
                                        (e.currentTarget.style.background = "transparent")
                                    }
                                >
                                    {/* Poster */}
                                    <div
                                        style={{
                                            width: 36,
                                            height: 54,
                                            borderRadius: 4,
                                            background: "var(--color-surface-3)",
                                            flexShrink: 0,
                                            overflow: "hidden",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        {poster ? (
                                            <img
                                                src={poster}
                                                alt=""
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "cover",
                                                }}
                                            />
                                        ) : r.type === "show" ? (
                                            <Tv2 size={16} color="var(--color-text-muted)" />
                                        ) : (
                                            <Film size={16} color="var(--color-text-muted)" />
                                        )}
                                    </div>

                                    {/* Title + meta */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p
                                            style={{
                                                fontSize: "14px",
                                                fontWeight: 500,
                                                color: "var(--color-text)",
                                                margin: 0,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {r.title}
                                        </p>
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--color-text-muted)",
                                                margin: "2px 0 0",
                                            }}
                                        >
                                            {r.year}
                                            {" · "}
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    padding: "1px 5px",
                                                    borderRadius: 4,
                                                    background:
                                                        r.type === "show"
                                                            ? "rgba(37,244,238,0.12)"
                                                            : "rgba(255,61,129,0.12)",
                                                    color:
                                                        r.type === "show"
                                                            ? "var(--color-accent)"
                                                            : "var(--color-accent-rose)",
                                                    fontSize: "10px",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {r.type === "show"
                                                    ? t("search.typeShow")
                                                    : t("search.typeMovie")}
                                            </span>
                                        </p>
                                    </div>

                                    {/* Add button */}
                                    <button
                                        onClick={() => handleAdd(r)}
                                        disabled={added || adding}
                                        title={
                                            added
                                                ? t("search.added")
                                                : adding
                                                  ? t("search.adding")
                                                  : t("search.addToWatchlist")
                                        }
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            padding: "5px 10px",
                                            borderRadius: 8,
                                            border: added
                                                ? "1px solid var(--color-watched)"
                                                : "1px solid var(--color-border)",
                                            background: added
                                                ? "rgba(49,245,168,0.1)"
                                                : "var(--color-surface-3)",
                                            color: added
                                                ? "var(--color-watched)"
                                                : "var(--color-text-secondary)",
                                            fontSize: "12px",
                                            fontWeight: 500,
                                            cursor: added ? "default" : "pointer",
                                            flexShrink: 0,
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {adding ? (
                                            <Loader2
                                                size={12}
                                                style={{ animation: "spin 1s linear infinite" }}
                                            />
                                        ) : added ? (
                                            <Check size={12} />
                                        ) : (
                                            <Plus size={12} />
                                        )}
                                        <span>
                                            {adding
                                                ? t("search.adding")
                                                : added
                                                  ? t("search.added")
                                                  : t("search.addToWatchlist")}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </>
    );
}
