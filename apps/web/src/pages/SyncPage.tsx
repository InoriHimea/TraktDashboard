import { useState } from "react";
import { motion } from "framer-motion";
import {
    RefreshCw,
    Loader2,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Clock,
    Database,
} from "lucide-react";
import { useSyncStatus, useTriggerSync, useTriggerFullSync } from "../hooks";

export default function SyncPage() {
    const { data: sync, isLoading } = useSyncStatus();
    const { mutate: triggerSync, isPending: syncing } = useTriggerSync();
    const { mutate: triggerFull, isPending: fullSyncing } =
        useTriggerFullSync();
    const [syncError, setSyncError] = useState<string | null>(null);

    const isRunning = sync?.status === "running";
    const syncPct =
        isRunning && sync.total > 0
            ? Math.round((sync.progress / sync.total) * 100)
            : 0;
    const failedShows = sync?.failedShows ?? [];
    const anyPending = syncing || fullSyncing;

    const handleTriggerSync = () => {
        setSyncError(null);
        triggerSync(undefined, {
            onError: (err) =>
                setSyncError(
                    err instanceof Error ? err.message : "触发同步失败",
                ),
        });
    };

    const handleTriggerFull = () => {
        setSyncError(null);
        triggerFull(undefined, {
            onError: (err) =>
                setSyncError(
                    err instanceof Error ? err.message : "触发全量同步失败",
                ),
        });
    };

    return (
        <div
            style={{
                maxWidth: "680px",
                margin: "0 auto",
                padding: "40px 24px",
            }}
        >
            {/* Header */}
            <div style={{ marginBottom: "32px" }}>
                <h2
                    style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "32px",
                        color: "var(--color-text)",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                        marginBottom: "6px",
                    }}
                >
                    同步
                </h2>
                <p
                    style={{
                        color: "var(--color-text-secondary)",
                        fontSize: "14px",
                    }}
                >
                    将 Trakt 观看记录与 TMDB 元数据同步到本地。
                </p>
            </div>

            {/* Status card */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    borderRadius: "var(--radius-lg)",
                    padding: "24px",
                    marginBottom: "16px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-subtle)",
                }}
            >
                {isLoading ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <Loader2
                            size={16}
                            className="animate-spin"
                            style={{ color: "var(--color-accent)" }}
                        />
                        <span
                            style={{
                                fontSize: "14px",
                                color: "var(--color-text-secondary)",
                            }}
                        >
                            正在加载同步状态…
                        </span>
                    </div>
                ) : isRunning ? (
                    /* ── Running state ── */
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                            }}
                        >
                            <Loader2
                                size={16}
                                className="animate-spin"
                                style={{
                                    color: "var(--color-accent)",
                                    flexShrink: 0,
                                }}
                            />
                            <span
                                style={{
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "var(--color-text)",
                                }}
                            >
                                同步中… {sync.progress}/{sync.total}
                            </span>
                            <span
                                style={{
                                    fontSize: "13px",
                                    color: "var(--color-text-muted)",
                                    marginLeft: "auto",
                                }}
                            >
                                {syncPct}%
                            </span>
                        </div>
                        <div
                            style={{
                                height: "6px",
                                borderRadius: "999px",
                                overflow: "hidden",
                                background: "var(--color-surface-3)",
                            }}
                        >
                            <motion.div
                                style={{
                                    height: "100%",
                                    borderRadius: "999px",
                                    background: "var(--color-accent)",
                                }}
                                animate={{ width: `${syncPct}%` }}
                                transition={{ duration: 0.4 }}
                            />
                        </div>
                        {sync.currentShow && (
                            <p
                                style={{
                                    fontSize: "12px",
                                    color: "var(--color-text-muted)",
                                    lineHeight: 1.5,
                                }}
                            >
                                {sync.currentShow}
                            </p>
                        )}
                    </div>
                ) : (
                    /* ── Idle / completed / error state ── */
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                        }}
                    >
                        {/* Status row */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                            }}
                        >
                            {sync?.status === "error" ? (
                                <AlertCircle
                                    size={18}
                                    style={{
                                        color: "var(--color-error)",
                                        flexShrink: 0,
                                    }}
                                />
                            ) : sync?.status === "completed" ? (
                                <CheckCircle2
                                    size={18}
                                    style={{
                                        color: "var(--color-watched)",
                                        flexShrink: 0,
                                    }}
                                />
                            ) : (
                                <RefreshCw
                                    size={18}
                                    style={{
                                        color: "var(--color-text-muted)",
                                        flexShrink: 0,
                                    }}
                                />
                            )}
                            <span
                                style={{
                                    fontSize: "15px",
                                    fontWeight: 500,
                                    color: "var(--color-text)",
                                }}
                            >
                                {sync?.status === "error"
                                    ? "同步失败"
                                    : sync?.status === "completed"
                                      ? "同步完成"
                                      : "准备就绪"}
                            </span>
                        </div>

                        {sync?.status === "error" && sync.error && (
                            <div
                                style={{
                                    borderRadius: "var(--radius-md)",
                                    padding: "12px 16px",
                                    background: "#ef444412",
                                    border: "1px solid #ef444428",
                                    fontSize: "13px",
                                    color: "var(--color-error)",
                                    lineHeight: 1.6,
                                }}
                            >
                                {sync.error}
                            </div>
                        )}

                        {sync?.lastSyncAt && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "13px",
                                    color: "var(--color-text-muted)",
                                }}
                            >
                                <Clock size={13} />
                                上次同步：
                                {new Date(sync.lastSyncAt).toLocaleString(
                                    "zh-CN",
                                )}
                            </div>
                        )}

                        {/* ── Sync trigger error ── */}
                        {syncError && (
                            <div
                                style={{
                                    borderRadius: "var(--radius-md)",
                                    padding: "12px 16px",
                                    background: "#ef444412",
                                    border: "1px solid #ef444428",
                                    fontSize: "13px",
                                    color: "var(--color-error)",
                                    lineHeight: 1.6,
                                }}
                            >
                                {syncError}
                            </div>
                        )}

                        {/* ── Sync buttons ── */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                            }}
                        >
                            {/* Incremental sync */}
                            <div
                                style={{
                                    borderRadius: "var(--radius-md)",
                                    padding: "16px",
                                    background: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        justifyContent: "space-between",
                                        gap: "16px",
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <p
                                            style={{
                                                fontSize: "14px",
                                                fontWeight: 500,
                                                color: "var(--color-text)",
                                                marginBottom: "4px",
                                            }}
                                        >
                                            增量同步
                                        </p>
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--color-text-muted)",
                                                lineHeight: 1.6,
                                            }}
                                        >
                                            仅同步上次以来的新观看记录，速度快。同时会拉取
                                            TMDB
                                            的本地化标题（根据设置中的显示语言）。
                                        </p>
                                    </div>
                                    <motion.button
                                        onClick={handleTriggerSync}
                                        disabled={anyPending || isRunning}
                                        whileHover={
                                            anyPending || isRunning
                                                ? {}
                                                : { scale: 1.02 }
                                        }
                                        whileTap={
                                            anyPending || isRunning
                                                ? {}
                                                : { scale: 0.98 }
                                        }
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "7px",
                                            padding: "9px 18px",
                                            borderRadius: "var(--radius-md)",
                                            background:
                                                anyPending || isRunning
                                                    ? "var(--color-surface-3)"
                                                    : "#7c6af7",
                                            color:
                                                anyPending || isRunning
                                                    ? "var(--color-text-muted)"
                                                    : "#fff",
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            border: "none",
                                            cursor:
                                                anyPending || isRunning
                                                    ? "not-allowed"
                                                    : "pointer",
                                            flexShrink: 0,
                                            transition: "background 0.15s",
                                            boxShadow:
                                                anyPending || isRunning
                                                    ? "none"
                                                    : "0 2px 12px rgba(124,106,247,0.4)",
                                        }}
                                    >
                                        <RefreshCw
                                            size={14}
                                            className={
                                                syncing ? "animate-spin" : ""
                                            }
                                        />
                                        {syncing ? "排队中…" : "立即同步"}
                                    </motion.button>
                                </div>
                            </div>

                            {/* Full sync */}
                            <div
                                style={{
                                    borderRadius: "var(--radius-md)",
                                    padding: "16px",
                                    background: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        justifyContent: "space-between",
                                        gap: "16px",
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <p
                                            style={{
                                                fontSize: "14px",
                                                fontWeight: 500,
                                                color: "var(--color-text)",
                                                marginBottom: "4px",
                                            }}
                                        >
                                            全量同步
                                        </p>
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--color-text-muted)",
                                                lineHeight: 1.6,
                                            }}
                                        >
                                            重新同步全部历史记录，并强制刷新所有剧集的
                                            TMDB
                                            元数据（含本地化标题、简介）。耗时较长，适合首次使用或修复数据。
                                        </p>
                                    </div>
                                    <motion.button
                                        onClick={handleTriggerFull}
                                        disabled={anyPending || isRunning}
                                        whileHover={
                                            anyPending || isRunning
                                                ? {}
                                                : { scale: 1.02 }
                                        }
                                        whileTap={
                                            anyPending || isRunning
                                                ? {}
                                                : { scale: 0.98 }
                                        }
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "7px",
                                            padding: "9px 18px",
                                            borderRadius: "var(--radius-md)",
                                            background:
                                                anyPending || isRunning
                                                    ? "var(--color-surface-3)"
                                                    : "#0ea5e9",
                                            color:
                                                anyPending || isRunning
                                                    ? "var(--color-text-muted)"
                                                    : "#fff",
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            border:
                                                anyPending || isRunning
                                                    ? "1px solid transparent"
                                                    : "1px solid #38bdf840",
                                            cursor:
                                                anyPending || isRunning
                                                    ? "not-allowed"
                                                    : "pointer",
                                            flexShrink: 0,
                                            transition: "background 0.15s",
                                            boxShadow:
                                                anyPending || isRunning
                                                    ? "none"
                                                    : "0 2px 12px rgba(14,165,233,0.35)",
                                        }}
                                    >
                                        <Database
                                            size={14}
                                            className={
                                                fullSyncing
                                                    ? "animate-spin"
                                                    : ""
                                            }
                                        />
                                        {fullSyncing ? "同步中…" : "全量同步"}
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Failed shows */}
            {failedShows.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        borderRadius: "var(--radius-lg)",
                        padding: "24px",
                        background: "var(--color-surface)",
                        border: "1px solid #f59e0b22",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "16px",
                        }}
                    >
                        <AlertTriangle
                            size={15}
                            style={{ color: "var(--color-airing)" }}
                        />
                        <h3
                            style={{
                                fontSize: "14px",
                                fontWeight: 500,
                                color: "var(--color-text)",
                            }}
                        >
                            {failedShows.length} 部剧集同步失败
                        </h3>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                        }}
                    >
                        {failedShows.map((f, i) => (
                            <div
                                key={`${f.tmdbId}-${f.title}`}
                                style={{
                                    paddingBottom:
                                        i < failedShows.length - 1 ? "12px" : 0,
                                    borderBottom:
                                        i < failedShows.length - 1
                                            ? "1px solid var(--color-border-subtle)"
                                            : "none",
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: "13px",
                                        color: "var(--color-text-secondary)",
                                        fontWeight: 500,
                                        marginBottom: "2px",
                                    }}
                                >
                                    {f.title}
                                </p>
                                <p
                                    style={{
                                        fontSize: "12px",
                                        color: "var(--color-error)",
                                        opacity: 0.8,
                                    }}
                                >
                                    {f.error}
                                </p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
