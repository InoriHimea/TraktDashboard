import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Clock, Database, } from "lucide-react";
import { useSyncStatus, useTriggerSync, useTriggerFullSync } from "../hooks";
export default function SyncPage() {
    const { data: sync, isLoading } = useSyncStatus();
    const { mutate: triggerSync, isPending: syncing } = useTriggerSync();
    const { mutate: triggerFull, isPending: fullSyncing } = useTriggerFullSync();
    const [syncError, setSyncError] = useState(null);
    const isRunning = sync?.status === "running";
    const syncPct = isRunning && sync.total > 0
        ? Math.round((sync.progress / sync.total) * 100)
        : 0;
    const failedShows = sync?.failedShows ?? [];
    const anyPending = syncing || fullSyncing;
    const handleTriggerSync = () => {
        setSyncError(null);
        triggerSync(undefined, {
            onError: (err) => setSyncError(err instanceof Error ? err.message : "触发同步失败"),
        });
    };
    const handleTriggerFull = () => {
        setSyncError(null);
        triggerFull(undefined, {
            onError: (err) => setSyncError(err instanceof Error ? err.message : "触发全量同步失败"),
        });
    };
    return (_jsxs("div", { style: {
            maxWidth: "680px",
            margin: "0 auto",
            padding: "40px 24px",
        }, children: [_jsxs("div", { style: { marginBottom: "32px" }, children: [_jsx("h2", { style: {
                            fontFamily: "var(--font-display)",
                            fontSize: "32px",
                            color: "var(--color-text)",
                            letterSpacing: "-0.02em",
                            lineHeight: 1.1,
                            marginBottom: "6px",
                        }, children: "\u540C\u6B65" }), _jsx("p", { style: {
                            color: "var(--color-text-secondary)",
                            fontSize: "14px",
                        }, children: "\u5C06 Trakt \u89C2\u770B\u8BB0\u5F55\u4E0E TMDB \u5143\u6570\u636E\u540C\u6B65\u5230\u672C\u5730\u3002" })] }), _jsx(motion.div, { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, style: {
                    borderRadius: "var(--radius-lg)",
                    padding: "24px",
                    marginBottom: "16px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-subtle)",
                }, children: isLoading ? (_jsxs("div", { style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }, children: [_jsx(Loader2, { size: 16, className: "animate-spin", style: { color: "var(--color-accent)" } }), _jsx("span", { style: {
                                fontSize: "14px",
                                color: "var(--color-text-secondary)",
                            }, children: "\u6B63\u5728\u52A0\u8F7D\u540C\u6B65\u72B6\u6001\u2026" })] })) : isRunning ? (
                /* ── Running state ── */
                _jsxs("div", { style: {
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                    }, children: [_jsxs("div", { style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                            }, children: [_jsx(Loader2, { size: 16, className: "animate-spin", style: {
                                        color: "var(--color-accent)",
                                        flexShrink: 0,
                                    } }), _jsxs("span", { style: {
                                        fontSize: "14px",
                                        fontWeight: 500,
                                        color: "var(--color-text)",
                                    }, children: ["\u540C\u6B65\u4E2D\u2026 ", sync.progress, "/", sync.total] }), _jsxs("span", { style: {
                                        fontSize: "13px",
                                        color: "var(--color-text-muted)",
                                        marginLeft: "auto",
                                    }, children: [syncPct, "%"] })] }), _jsx("div", { style: {
                                height: "6px",
                                borderRadius: "999px",
                                overflow: "hidden",
                                background: "var(--color-surface-3)",
                            }, children: _jsx(motion.div, { style: {
                                    height: "100%",
                                    borderRadius: "999px",
                                    background: "var(--color-accent)",
                                }, animate: { width: `${syncPct}%` }, transition: { duration: 0.4 } }) }), sync.currentShow && (_jsx("p", { style: {
                                fontSize: "12px",
                                color: "var(--color-text-muted)",
                                lineHeight: 1.5,
                            }, children: sync.currentShow }))] })) : (
                /* ── Idle / completed / error state ── */
                _jsxs("div", { style: {
                        display: "flex",
                        flexDirection: "column",
                        gap: "20px",
                    }, children: [_jsxs("div", { style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                            }, children: [sync?.status === "error" ? (_jsx(AlertCircle, { size: 18, style: {
                                        color: "var(--color-error)",
                                        flexShrink: 0,
                                    } })) : sync?.status === "completed" ? (_jsx(CheckCircle2, { size: 18, style: {
                                        color: "var(--color-watched)",
                                        flexShrink: 0,
                                    } })) : (_jsx(RefreshCw, { size: 18, style: {
                                        color: "var(--color-text-muted)",
                                        flexShrink: 0,
                                    } })), _jsx("span", { style: {
                                        fontSize: "15px",
                                        fontWeight: 500,
                                        color: "var(--color-text)",
                                    }, children: sync?.status === "error"
                                        ? "同步失败"
                                        : sync?.status === "completed"
                                            ? "同步完成"
                                            : "准备就绪" })] }), sync?.status === "error" && sync.error && (_jsx("div", { style: {
                                borderRadius: "var(--radius-md)",
                                padding: "12px 16px",
                                background: "#ef444412",
                                border: "1px solid #ef444428",
                                fontSize: "13px",
                                color: "var(--color-error)",
                                lineHeight: 1.6,
                            }, children: sync.error })), sync?.lastSyncAt && (_jsxs("div", { style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "13px",
                                color: "var(--color-text-muted)",
                            }, children: [_jsx(Clock, { size: 13 }), "\u4E0A\u6B21\u540C\u6B65\uFF1A", new Date(sync.lastSyncAt).toLocaleString("zh-CN")] })), syncError && (_jsx("div", { style: {
                                borderRadius: "var(--radius-md)",
                                padding: "12px 16px",
                                background: "#ef444412",
                                border: "1px solid #ef444428",
                                fontSize: "13px",
                                color: "var(--color-error)",
                                lineHeight: 1.6,
                            }, children: syncError })), _jsxs("div", { style: {
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                            }, children: [_jsx("div", { style: {
                                        borderRadius: "var(--radius-md)",
                                        padding: "16px",
                                        background: "var(--color-surface-2)",
                                        border: "1px solid var(--color-border-subtle)",
                                    }, children: _jsxs("div", { style: {
                                            display: "flex",
                                            alignItems: "flex-start",
                                            justifyContent: "space-between",
                                            gap: "16px",
                                        }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: {
                                                            fontSize: "14px",
                                                            fontWeight: 500,
                                                            color: "var(--color-text)",
                                                            marginBottom: "4px",
                                                        }, children: "\u589E\u91CF\u540C\u6B65" }), _jsx("p", { style: {
                                                            fontSize: "12px",
                                                            color: "var(--color-text-muted)",
                                                            lineHeight: 1.6,
                                                        }, children: "\u4EC5\u540C\u6B65\u4E0A\u6B21\u4EE5\u6765\u7684\u65B0\u89C2\u770B\u8BB0\u5F55\uFF0C\u901F\u5EA6\u5FEB\u3002\u540C\u65F6\u4F1A\u62C9\u53D6 TMDB \u7684\u672C\u5730\u5316\u6807\u9898\uFF08\u6839\u636E\u8BBE\u7F6E\u4E2D\u7684\u663E\u793A\u8BED\u8A00\uFF09\u3002" })] }), _jsxs(motion.button, { onClick: handleTriggerSync, disabled: anyPending || isRunning, whileHover: anyPending || isRunning
                                                    ? {}
                                                    : { scale: 1.02 }, whileTap: anyPending || isRunning
                                                    ? {}
                                                    : { scale: 0.98 }, style: {
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "7px",
                                                    padding: "9px 18px",
                                                    borderRadius: "var(--radius-md)",
                                                    background: anyPending || isRunning
                                                        ? "var(--color-surface-3)"
                                                        : "#7c6af7",
                                                    color: anyPending || isRunning
                                                        ? "var(--color-text-muted)"
                                                        : "#fff",
                                                    fontSize: "13px",
                                                    fontWeight: 600,
                                                    border: "none",
                                                    cursor: anyPending || isRunning
                                                        ? "not-allowed"
                                                        : "pointer",
                                                    flexShrink: 0,
                                                    transition: "background 0.15s",
                                                    boxShadow: anyPending || isRunning
                                                        ? "none"
                                                        : "0 2px 12px rgba(124,106,247,0.4)",
                                                }, children: [_jsx(RefreshCw, { size: 14, className: syncing ? "animate-spin" : "" }), syncing ? "排队中…" : "立即同步"] })] }) }), _jsx("div", { style: {
                                        borderRadius: "var(--radius-md)",
                                        padding: "16px",
                                        background: "var(--color-surface-2)",
                                        border: "1px solid var(--color-border-subtle)",
                                    }, children: _jsxs("div", { style: {
                                            display: "flex",
                                            alignItems: "flex-start",
                                            justifyContent: "space-between",
                                            gap: "16px",
                                        }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: {
                                                            fontSize: "14px",
                                                            fontWeight: 500,
                                                            color: "var(--color-text)",
                                                            marginBottom: "4px",
                                                        }, children: "\u5168\u91CF\u540C\u6B65" }), _jsx("p", { style: {
                                                            fontSize: "12px",
                                                            color: "var(--color-text-muted)",
                                                            lineHeight: 1.6,
                                                        }, children: "\u91CD\u65B0\u540C\u6B65\u5168\u90E8\u5386\u53F2\u8BB0\u5F55\uFF0C\u5E76\u5F3A\u5236\u5237\u65B0\u6240\u6709\u5267\u96C6\u7684 TMDB \u5143\u6570\u636E\uFF08\u542B\u672C\u5730\u5316\u6807\u9898\u3001\u7B80\u4ECB\uFF09\u3002\u8017\u65F6\u8F83\u957F\uFF0C\u9002\u5408\u9996\u6B21\u4F7F\u7528\u6216\u4FEE\u590D\u6570\u636E\u3002" })] }), _jsxs(motion.button, { onClick: handleTriggerFull, disabled: anyPending || isRunning, whileHover: anyPending || isRunning
                                                    ? {}
                                                    : { scale: 1.02 }, whileTap: anyPending || isRunning
                                                    ? {}
                                                    : { scale: 0.98 }, style: {
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "7px",
                                                    padding: "9px 18px",
                                                    borderRadius: "var(--radius-md)",
                                                    background: anyPending || isRunning
                                                        ? "var(--color-surface-3)"
                                                        : "#0ea5e9",
                                                    color: anyPending || isRunning
                                                        ? "var(--color-text-muted)"
                                                        : "#fff",
                                                    fontSize: "13px",
                                                    fontWeight: 600,
                                                    border: anyPending || isRunning
                                                        ? "1px solid transparent"
                                                        : "1px solid #38bdf840",
                                                    cursor: anyPending || isRunning
                                                        ? "not-allowed"
                                                        : "pointer",
                                                    flexShrink: 0,
                                                    transition: "background 0.15s",
                                                    boxShadow: anyPending || isRunning
                                                        ? "none"
                                                        : "0 2px 12px rgba(14,165,233,0.35)",
                                                }, children: [_jsx(Database, { size: 14, className: fullSyncing
                                                            ? "animate-spin"
                                                            : "" }), fullSyncing ? "同步中…" : "全量同步"] })] }) })] })] })) }), failedShows.length > 0 && (_jsxs(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, style: {
                    borderRadius: "var(--radius-lg)",
                    padding: "24px",
                    background: "var(--color-surface)",
                    border: "1px solid #f59e0b22",
                }, children: [_jsxs("div", { style: {
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "16px",
                        }, children: [_jsx(AlertTriangle, { size: 15, style: { color: "var(--color-airing)" } }), _jsxs("h3", { style: {
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "var(--color-text)",
                                }, children: [failedShows.length, " \u90E8\u5267\u96C6\u540C\u6B65\u5931\u8D25"] })] }), _jsx("div", { style: {
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                        }, children: failedShows.map((f, i) => (_jsxs("div", { style: {
                                paddingBottom: i < failedShows.length - 1 ? "12px" : 0,
                                borderBottom: i < failedShows.length - 1
                                    ? "1px solid var(--color-border-subtle)"
                                    : "none",
                            }, children: [_jsx("p", { style: {
                                        fontSize: "13px",
                                        color: "var(--color-text-secondary)",
                                        fontWeight: 500,
                                        marginBottom: "2px",
                                    }, children: f.title }), _jsx("p", { style: {
                                        fontSize: "12px",
                                        color: "var(--color-error)",
                                        opacity: 0.8,
                                    }, children: f.error })] }, `${f.tmdbId}-${f.title}`))) })] }))] }));
}
//# sourceMappingURL=SyncPage.js.map