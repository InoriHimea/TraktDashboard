import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Tv2, CheckCircle2, LayoutGrid, Loader2, X, RefreshCw, } from "lucide-react";
import { useShowsProgress } from "../hooks";
import { ShowCard } from "../components/ShowCard";
const FILTERS = [
    { key: "watching", label: "Watching", icon: Tv2, color: "#7c6af7" },
    {
        key: "completed",
        label: "Completed",
        icon: CheckCircle2,
        color: "#10b981",
    },
    { key: "all", label: "All", icon: LayoutGrid, color: "#0ea5e9" },
];
export default function ProgressPage() {
    const [filter, setFilter] = useState("watching");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
        return () => window.clearTimeout(t);
    }, [search]);
    const { data: shows, isLoading, error, refetch, isFetching, } = useShowsProgress(filter, debouncedSearch);
    return (_jsxs("div", { style: { minHeight: "100vh", background: "var(--color-bg)" }, children: [_jsx("div", { style: {
                    position: "sticky",
                    top: "56px",
                    zIndex: 30,
                    background: "var(--color-bg)",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    backdropFilter: "blur(12px)",
                }, children: _jsxs("div", { style: {
                        maxWidth: "1920px",
                        margin: "0 auto",
                        padding: "12px 32px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                    }, children: [_jsx("div", { style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "2px",
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-md)",
                                padding: "3px",
                            }, children: FILTERS.map(({ key, label, icon: Icon, color }) => (_jsxs("button", { onClick: () => setFilter(key), style: {
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "5px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "13px",
                                    fontWeight: filter === key ? 600 : 400,
                                    color: filter === key
                                        ? color
                                        : "var(--color-text-secondary)",
                                    background: filter === key
                                        ? `${color}18`
                                        : "transparent",
                                    border: filter === key
                                        ? `1px solid ${color}40`
                                        : "1px solid transparent",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                }, children: [_jsx(Icon, { size: 13, color: filter === key
                                            ? color
                                            : "var(--color-text-muted)" }), label] }, key))) }), _jsxs("div", { style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flex: 1,
                                maxWidth: "320px",
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-md)",
                                padding: "6px 12px",
                            }, children: [_jsx(Search, { size: 13, style: {
                                        color: "var(--color-text-muted)",
                                        flexShrink: 0,
                                    } }), _jsx("input", { type: "text", placeholder: "Search shows\u2026", value: search, onChange: (e) => setSearch(e.target.value), style: {
                                        background: "transparent",
                                        border: "none",
                                        outline: "none",
                                        color: "var(--color-text)",
                                        fontSize: "13px",
                                        width: "100%",
                                    } }), search && (_jsx("button", { onClick: () => setSearch(""), style: {
                                        border: "none",
                                        background: "transparent",
                                        color: "var(--color-text-muted)",
                                        cursor: "pointer",
                                        padding: 0,
                                    }, children: _jsx(X, { size: 13 }) }))] }), isFetching && !isLoading && (_jsx(Loader2, { size: 14, className: "animate-spin", style: { color: "var(--color-text-muted)" } })), _jsx("span", { style: {
                                fontSize: "12px",
                                color: "var(--color-text-muted)",
                                marginLeft: "auto",
                            }, children: shows ? `${shows.length} 部剧集` : "" })] }) }), _jsx("div", { style: {
                    maxWidth: "1920px",
                    margin: "0 auto",
                    padding: "24px 32px",
                }, children: isLoading ? (_jsxs("div", { style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                        paddingTop: "80px",
                    }, children: [_jsx(Loader2, { size: 24, className: "animate-spin", style: { color: "var(--color-accent)" } }), _jsx("p", { style: {
                                color: "var(--color-text-muted)",
                                fontSize: "14px",
                            }, children: "Loading shows\u2026" })] })) : error ? (_jsxs("div", { style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                        paddingTop: "80px",
                    }, children: [_jsx("p", { style: {
                                color: "var(--color-error)",
                                fontSize: "14px",
                            }, children: "Failed to load shows." }), _jsxs("button", { onClick: () => refetch(), style: {
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
                            }, children: [_jsx(RefreshCw, { size: 13 }), " Retry"] })] })) : shows?.length === 0 ? (_jsxs(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, style: { textAlign: "center", paddingTop: "80px" }, children: [_jsx("p", { style: {
                                color: "var(--color-text-muted)",
                                fontSize: "14px",
                                marginBottom: "6px",
                            }, children: debouncedSearch
                                ? `No results for "${debouncedSearch}"`
                                : "No shows here yet." }), !debouncedSearch && (_jsx("p", { style: {
                                color: "var(--color-text-muted)",
                                fontSize: "12px",
                            }, children: "Go to Sync to import your Trakt history." }))] })) : (_jsx("div", { style: {
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                        gap: "16px",
                    }, children: _jsx(AnimatePresence, { mode: "popLayout", children: shows?.map((progress, i) => (_jsx(ShowCard, { progress: progress, index: i }, progress.show.id))) }) })) })] }));
}
//# sourceMappingURL=ProgressPage.js.map