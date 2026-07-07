import { Check, Loader2, Server, X } from "lucide-react";
import type {
    JellyfinLibrary,
    JellyfinDeleteQueueEntry,
    JellyfinDeleteExclusion,
    JellyfinDeleteHistoryEntry,
} from "@trakt-dashboard/types";
import { t } from "../../lib/i18n";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { inputStyle, labelStyle } from "./shared";

interface JellyfinTabProps {
    jellyfinUrl: string;
    setJellyfinUrl: (value: string) => void;
    jellyfinApiKey: string;
    setJellyfinApiKey: (value: string) => void;
    jellyfinLibraries: JellyfinLibrary[];
    jellyfinLibrariesLoading: boolean;
    loadJellyfinLibraries: () => void;
    jellyfinAutoDeleteIds: string[];
    toggleJellyfinLibrary: (id: string) => void;
    jellyfinAutoDeleteEnabled: boolean;
    setJellyfinAutoDeleteEnabled: (value: boolean) => void;
    deleteQueue: JellyfinDeleteQueueEntry[] | undefined;
    deleteQueueLoading: boolean;
    isQueueActionPending: boolean;
    onDeferDelete: (id: number) => void;
    onNeverDelete: (id: number) => void;
    onOpenDeleteNow: (target: { id: number; title: string }) => void;
    deleteExclusions: JellyfinDeleteExclusion[] | undefined;
    exclusionsLoading: boolean;
    isRemovingExclusion: boolean;
    onRemoveExclusion: (id: number) => void;
    deleteHistory: JellyfinDeleteHistoryEntry[] | undefined;
    deleteHistoryLoading: boolean;
    deleteNowTarget: { id: number; title: string } | null;
    isDeletingNow: boolean;
    onDeleteNowConfirm: () => void;
    onDeleteNowCancel: () => void;
}

export function JellyfinTab({
    jellyfinUrl,
    setJellyfinUrl,
    jellyfinApiKey,
    setJellyfinApiKey,
    jellyfinLibraries,
    jellyfinLibrariesLoading,
    loadJellyfinLibraries,
    jellyfinAutoDeleteIds,
    toggleJellyfinLibrary,
    jellyfinAutoDeleteEnabled,
    setJellyfinAutoDeleteEnabled,
    deleteQueue,
    deleteQueueLoading,
    isQueueActionPending,
    onDeferDelete,
    onNeverDelete,
    onOpenDeleteNow,
    deleteExclusions,
    exclusionsLoading,
    isRemovingExclusion,
    onRemoveExclusion,
    deleteHistory,
    deleteHistoryLoading,
    deleteNowTarget,
    isDeletingNow,
    onDeleteNowConfirm,
    onDeleteNowCancel,
}: JellyfinTabProps) {
    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                }}
            >
                <Server size={14} style={{ color: "var(--color-text-secondary)" }} />
                <span
                    style={{
                        ...labelStyle,
                        marginBottom: 0,
                    }}
                >
                    {t("settings.jellyfinTitle")}
                </span>
            </div>
            <p
                style={{
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                    marginBottom: "16px",
                    lineHeight: 1.5,
                }}
            >
                {t("settings.jellyfinSubtitle")}
            </p>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                }}
            >
                <div>
                    <label htmlFor="settings-jellyfin-url" style={labelStyle}>
                        {t("settings.jellyfinUrl")}
                    </label>
                    <input
                        id="settings-jellyfin-url"
                        type="url"
                        value={jellyfinUrl}
                        onChange={(e) => setJellyfinUrl(e.target.value)}
                        placeholder={t("settings.jellyfinUrlPlaceholder")}
                        style={inputStyle}
                        autoComplete="off"
                    />
                </div>
                <div>
                    <label htmlFor="settings-jellyfin-key" style={labelStyle}>
                        {t("settings.jellyfinApiKey")}
                    </label>
                    <input
                        id="settings-jellyfin-key"
                        type="password"
                        value={jellyfinApiKey}
                        onChange={(e) => setJellyfinApiKey(e.target.value)}
                        placeholder={t("settings.jellyfinApiKeyPlaceholder")}
                        style={inputStyle}
                        autoComplete="new-password"
                    />
                </div>
                <div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "8px",
                        }}
                    >
                        <span
                            style={{
                                ...labelStyle,
                                marginBottom: 0,
                            }}
                        >
                            {t("settings.jellyfinAutoDeleteLibraries")}
                        </span>
                        <button
                            type="button"
                            onClick={loadJellyfinLibraries}
                            disabled={jellyfinLibrariesLoading}
                            style={{
                                fontSize: "12px",
                                padding: "4px 10px",
                                borderRadius: "var(--radius-sm)",
                                background: "var(--color-surface-3)",
                                border: "1px solid var(--color-border)",
                                color: "var(--color-text-secondary)",
                                cursor: jellyfinLibrariesLoading ? "not-allowed" : "pointer",
                            }}
                        >
                            {jellyfinLibrariesLoading
                                ? t("common.loading")
                                : t("settings.jellyfinLoadLibraries")}
                        </button>
                    </div>
                    <p
                        style={{
                            fontSize: "12px",
                            color: "var(--color-text-muted)",
                            marginBottom: "8px",
                            lineHeight: 1.5,
                        }}
                    >
                        {t("settings.jellyfinAutoDeleteLibrariesHint")}
                    </p>
                    {jellyfinLibraries.length > 0 && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                padding: "10px",
                                borderRadius: "var(--radius-md)",
                                background: "var(--color-surface-3)",
                                border: "1px solid var(--color-border)",
                            }}
                        >
                            {jellyfinLibraries.map((lib) => (
                                <label
                                    key={lib.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        fontSize: "13px",
                                        color: "var(--color-text)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={jellyfinAutoDeleteIds.includes(lib.id)}
                                        onChange={() => toggleJellyfinLibrary(lib.id)}
                                    />
                                    <span>{lib.name}</span>
                                    {lib.collectionType && (
                                        <span
                                            style={{
                                                fontSize: "11px",
                                                color: "var(--color-text-muted)",
                                            }}
                                        >
                                            ({lib.collectionType})
                                        </span>
                                    )}
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* 自动删除总开关 */}
                <div>
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "13px",
                            color: "var(--color-text)",
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={jellyfinAutoDeleteEnabled}
                            onChange={(e) => setJellyfinAutoDeleteEnabled(e.target.checked)}
                            style={{
                                accentColor: "var(--color-accent)",
                            }}
                        />
                        {t("settings.jellyfinAutoDeleteEnabled")}
                    </label>
                    <p
                        style={{
                            fontSize: "12px",
                            color: jellyfinAutoDeleteEnabled
                                ? "var(--color-text-muted)"
                                : "#f59e0b",
                            marginTop: "6px",
                            lineHeight: 1.5,
                        }}
                    >
                        {jellyfinAutoDeleteEnabled
                            ? t("settings.jellyfinAutoDeleteEnabledHint")
                            : t("settings.jellyfinAutoDeleteDisabledHint")}
                    </p>
                </div>

                {/* 待删除队列 */}
                <div>
                    <span
                        style={{
                            ...labelStyle,
                            marginBottom: "4px",
                        }}
                    >
                        {t("settings.jellyfinDeleteQueueTitle")}
                    </span>
                    <p
                        style={{
                            fontSize: "12px",
                            color: "var(--color-text-muted)",
                            marginBottom: "8px",
                            lineHeight: 1.5,
                        }}
                    >
                        {t("settings.jellyfinDeleteQueueHint")}
                    </p>
                    {deleteQueueLoading ? (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                padding: "8px 0",
                            }}
                        >
                            <Loader2
                                size={16}
                                style={{
                                    animation: "spin 1s linear infinite",
                                    color: "var(--color-text-muted)",
                                }}
                            />
                        </div>
                    ) : (deleteQueue?.length ?? 0) === 0 ? (
                        <p
                            style={{
                                fontSize: "12px",
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {t("settings.jellyfinDeleteQueueEmpty")}
                        </p>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "5px",
                            }}
                        >
                            {deleteQueue!.map((entry) => {
                                const title = entry.show?.title ?? entry.movie?.title ?? "—";
                                const scope = entry.show
                                    ? entry.seasonNumber === null
                                        ? t("settings.jellyfinDeleteQueueWholeShow")
                                        : t("settings.jellyfinDeleteQueueSeason", {
                                              season: entry.seasonNumber,
                                          })
                                    : null;
                                return (
                                    <div
                                        key={entry.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "7px 10px",
                                            borderRadius: 8,
                                            background: "var(--color-surface-2)",
                                            border: "1px solid rgba(248,113,113,0.2)",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: "11px",
                                                color: "var(--color-text)",
                                                flex: 1,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {title}
                                            {scope ? ` · ${scope}` : ""}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: "10px",
                                                color: "var(--color-text-muted)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {new Date(entry.queuedAt).toLocaleDateString()}
                                        </span>
                                        <button
                                            type="button"
                                            disabled={isQueueActionPending}
                                            onClick={() => onDeferDelete(entry.id)}
                                            style={{
                                                fontSize: "10px",
                                                padding: "3px 8px",
                                                borderRadius: 6,
                                                border: "1px solid var(--color-border)",
                                                background: "var(--color-surface-3)",
                                                color: "var(--color-text-secondary)",
                                                cursor: isQueueActionPending
                                                    ? "not-allowed"
                                                    : "pointer",
                                                flexShrink: 0,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {t("settings.jellyfinDeleteDefer")}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isQueueActionPending}
                                            onClick={() => onNeverDelete(entry.id)}
                                            style={{
                                                fontSize: "10px",
                                                padding: "3px 8px",
                                                borderRadius: 6,
                                                border: "1px solid rgba(248,113,113,0.35)",
                                                background: "rgba(248,113,113,0.08)",
                                                color: "#f87171",
                                                cursor: isQueueActionPending
                                                    ? "not-allowed"
                                                    : "pointer",
                                                flexShrink: 0,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {t("settings.jellyfinDeleteNever")}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isQueueActionPending}
                                            onClick={() =>
                                                onOpenDeleteNow({
                                                    id: entry.id,
                                                    title: title + (scope ? ` · ${scope}` : ""),
                                                })
                                            }
                                            style={{
                                                fontSize: "10px",
                                                padding: "3px 8px",
                                                borderRadius: 6,
                                                border: "1px solid rgba(248,113,113,0.5)",
                                                background: "rgba(248,113,113,0.16)",
                                                color: "#f87171",
                                                cursor: isQueueActionPending
                                                    ? "not-allowed"
                                                    : "pointer",
                                                flexShrink: 0,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {t("settings.jellyfinDeleteNow")}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 排除列表（永不删除 / 推迟中） */}
                <div>
                    <span
                        style={{
                            ...labelStyle,
                            marginBottom: "4px",
                        }}
                    >
                        {t("settings.jellyfinExclusionsTitle")}
                    </span>
                    <p
                        style={{
                            fontSize: "12px",
                            color: "var(--color-text-muted)",
                            marginBottom: "8px",
                            lineHeight: 1.5,
                        }}
                    >
                        {t("settings.jellyfinExclusionsHint")}
                    </p>
                    {exclusionsLoading ? (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                padding: "8px 0",
                            }}
                        >
                            <Loader2
                                size={16}
                                style={{
                                    animation: "spin 1s linear infinite",
                                    color: "var(--color-text-muted)",
                                }}
                            />
                        </div>
                    ) : (deleteExclusions?.length ?? 0) === 0 ? (
                        <p
                            style={{
                                fontSize: "12px",
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {t("settings.jellyfinExclusionsEmpty")}
                        </p>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "5px",
                            }}
                        >
                            {deleteExclusions!.map((ex) => {
                                const scope =
                                    ex.seasonNumber !== null
                                        ? t("settings.jellyfinDeleteQueueSeason", {
                                              season: ex.seasonNumber,
                                          })
                                        : ex.showId
                                          ? t("settings.jellyfinDeleteQueueWholeShow")
                                          : null;
                                const modeLabel =
                                    ex.mode === "never"
                                        ? t("settings.jellyfinExclusionNever")
                                        : t("settings.jellyfinExclusionDeferUntil", {
                                              date: ex.deferUntil
                                                  ? new Date(ex.deferUntil).toLocaleDateString()
                                                  : "—",
                                          });
                                return (
                                    <div
                                        key={ex.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "7px 10px",
                                            borderRadius: 8,
                                            background: "var(--color-surface-2)",
                                            border: `1px solid ${ex.mode === "never" ? "rgba(248,113,113,0.25)" : "rgba(245,158,11,0.25)"}`,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: "11px",
                                                color: "var(--color-text)",
                                                flex: 1,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {ex.title}
                                            {scope ? ` · ${scope}` : ""}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: "10px",
                                                color: ex.mode === "never" ? "#f87171" : "#f59e0b",
                                                fontWeight: 600,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {modeLabel}
                                        </span>
                                        <button
                                            type="button"
                                            disabled={isRemovingExclusion}
                                            onClick={() => onRemoveExclusion(ex.id)}
                                            title={t("settings.jellyfinExclusionRemove")}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                width: 20,
                                                height: 20,
                                                borderRadius: "50%",
                                                border: "none",
                                                background: "var(--color-surface-3)",
                                                color: "var(--color-text-secondary)",
                                                cursor: isRemovingExclusion
                                                    ? "not-allowed"
                                                    : "pointer",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 删除历史 */}
                <div>
                    <span
                        style={{
                            ...labelStyle,
                            marginBottom: "4px",
                        }}
                    >
                        {t("settings.jellyfinDeleteHistoryTitle")}
                    </span>
                    {deleteHistoryLoading ? (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                padding: "8px 0",
                            }}
                        >
                            <Loader2
                                size={16}
                                style={{
                                    animation: "spin 1s linear infinite",
                                    color: "var(--color-text-muted)",
                                }}
                            />
                        </div>
                    ) : (deleteHistory?.length ?? 0) === 0 ? (
                        <p
                            style={{
                                fontSize: "12px",
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {t("settings.jellyfinDeleteHistoryEmpty")}
                        </p>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "5px",
                            }}
                        >
                            {deleteHistory!.map((entry) => {
                                const statusColor =
                                    entry.status === "deleted"
                                        ? "#10b981"
                                        : entry.status === "failed"
                                          ? "#ef4444"
                                          : "#f59e0b";
                                const statusLabel =
                                    entry.status === "deleted"
                                        ? t("settings.jellyfinDeleteStatusDeleted")
                                        : entry.status === "failed"
                                          ? t("settings.jellyfinDeleteStatusFailed")
                                          : t("settings.jellyfinDeleteStatusNotFound");
                                const scope =
                                    entry.seasonNumber !== null
                                        ? t("settings.jellyfinDeleteQueueSeason", {
                                              season: entry.seasonNumber,
                                          })
                                        : entry.showId
                                          ? t("settings.jellyfinDeleteQueueWholeShow")
                                          : null;
                                return (
                                    <div
                                        key={entry.id}
                                        style={{
                                            padding: "7px 10px",
                                            borderRadius: 8,
                                            background: "var(--color-surface-2)",
                                            border: `1px solid ${statusColor}33`,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                            }}
                                        >
                                            {entry.status === "deleted" ? (
                                                <Check
                                                    size={12}
                                                    style={{
                                                        color: statusColor,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            ) : (
                                                <X
                                                    size={12}
                                                    style={{
                                                        color: statusColor,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            )}
                                            <span
                                                style={{
                                                    fontSize: "11px",
                                                    color: "var(--color-text)",
                                                    flex: 1,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {entry.title}
                                                {scope ? ` · ${scope}` : ""}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: "10px",
                                                    color: statusColor,
                                                    flexShrink: 0,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {statusLabel}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: "10px",
                                                    color: "var(--color-text-muted)",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {new Date(entry.processedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {entry.status === "failed" && entry.errorMessage && (
                                            <p
                                                title={entry.errorMessage}
                                                style={{
                                                    fontSize: "10px",
                                                    color: "var(--color-text-muted)",
                                                    margin: "4px 0 0 20px",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {entry.errorMessage}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={deleteNowTarget !== null}
                title={t("settings.jellyfinDeleteNowConfirmTitle")}
                description={t("settings.jellyfinDeleteNowConfirmDesc", {
                    title: deleteNowTarget?.title ?? "",
                })}
                confirmText={t("settings.jellyfinDeleteNow")}
                confirmColor="rose"
                cancelText={t("common.cancel")}
                isLoading={isDeletingNow}
                onConfirm={onDeleteNowConfirm}
                onCancel={onDeleteNowCancel}
            />
        </div>
    );
}
