import { useState } from "react";
import { Trash2, AlertCircle, Clock, Eye } from "lucide-react";
import { SlidingPanel } from "./SlidingPanel";
import { useEpisodeHistory, useShowHistory, useDeleteHistory } from "../hooks";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);

interface WatchHistoryPanelProps {
    open: boolean;
    onClose: () => void;
    showId: number;
    seasonNumber?: number;
    episodeNumber?: number;
    onDeleted: () => void;
}

export function WatchHistoryPanel({
    open,
    onClose,
    showId,
    seasonNumber,
    episodeNumber,
    onDeleted,
}: WatchHistoryPanelProps) {
    const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isEpisodeHistory = seasonNumber !== undefined && episodeNumber !== undefined;
    const episodeHistoryQuery = useEpisodeHistory(showId, seasonNumber ?? 0, episodeNumber ?? 0);
    const showHistoryQuery = useShowHistory(showId);
    const query = isEpisodeHistory ? episodeHistoryQuery : showHistoryQuery;
    const { data: history, isLoading } = query;
    const deleteHistory = useDeleteHistory(showId);

    const handleDelete = async (historyId: number) => {
        setError(null);
        setDeletingId(historyId);
        try {
            await deleteHistory.mutateAsync(historyId);
            setConfirmingDelete(null);
            onDeleted();
        } catch (err) {
            setError(err instanceof Error ? err.message : "删除失败，请重试");
        } finally {
            setDeletingId(null);
        }
    };

    const formatWatchedAt = (watchedAt: string | null) => {
        if (!watchedAt) return "未知时间";
        try {
            const d = dayjs(watchedAt);
            return {
                relative: d.locale("zh-cn").fromNow(),
                absolute: d.format("YYYY/MM/DD HH:mm"),
            };
        } catch {
            return { relative: watchedAt, absolute: "" };
        }
    };

    return (
        <>
            <SlidingPanel
                open={open}
                onClose={onClose}
                title={isEpisodeHistory ? "观看历史" : "全剧观看历史"}
            >
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>

                    {/* Loading */}
                    {isLoading && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin border-[var(--color-accent)]" />
                        </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && (!history || history.length === 0) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: '16px', textAlign: 'center' }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '16px',
                                background: 'var(--color-surface-2)',
                                border: '1px solid var(--color-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Eye size={22} className="text-[var(--color-text-muted)]" />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>暂无观看记录</p>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>观看后记录将出现在这里</p>
                            </div>
                        </div>
                    )}

                    {/* History entries */}
                    {!isLoading && history && history.length > 0 && history.map((entry, index) => {
                        const time = formatWatchedAt(entry.watchedAt);
                        const isConfirming = confirmingDelete === entry.id;
                        const isDeleting = deletingId === entry.id;

                        return (
                            <div
                                key={entry.id}
                                style={{
                                    borderRadius: '14px',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-surface-2)',
                                    overflow: 'hidden',
                                    transition: 'border-color 0.15s',
                                }}
                            >
                                {/* Entry header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                                    {/* Index badge */}
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                                        background: 'var(--color-accent, #6366f1)1a',
                                        border: '1px solid var(--color-accent, #6366f1)33',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Clock size={14} className="text-[var(--color-accent)]" />
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Episode label for show history */}
                                        {!isEpisodeHistory && (
                                            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '2px', letterSpacing: '0.01em' }}>
                                                S{String(entry.seasonNumber).padStart(2, "0")} · E{String(entry.episodeNumber).padStart(2, "0")}
                                                {entry.episodeTitle && (
                                                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                                                        {entry.episodeTitle}
                                                    </span>
                                                )}
                                            </p>
                                        )}
                                        {/* Time */}
                                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                                            {typeof time === 'string' ? time : (
                                                <>
                                                    <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{time.relative}</span>
                                                    <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>
                                                    {time.absolute}
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    {/* Delete trigger */}
                                    {!isConfirming && (
                                        <button
                                            onClick={() => setConfirmingDelete(entry.id)}
                                            style={{
                                                width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'var(--color-text-muted)',
                                                transition: 'background 0.15s, color 0.15s',
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                            }}
                                            onMouseEnter={e => {
                                                (e.currentTarget as HTMLElement).style.background = '#fee2e2';
                                                (e.currentTarget as HTMLElement).style.color = '#ef4444';
                                            }}
                                            onMouseLeave={e => {
                                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                                (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
                                            }}
                                            aria-label="删除记录"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Inline confirm strip */}
                                {isConfirming && (
                                    <div style={{
                                        borderTop: '1px solid var(--color-border)',
                                        background: '#fff5f5',
                                        padding: '12px 16px',
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                    }}>
                                        <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                                        <p style={{ flex: 1, fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>
                                            确认删除此集的观看记录？此操作不可撤销。
                                        </p>
                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => setConfirmingDelete(null)}
                                                style={{
                                                    height: '30px', padding: '0 14px', borderRadius: '8px',
                                                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                                    border: '1px solid var(--color-border)',
                                                    background: 'var(--color-surface-2)',
                                                    color: 'var(--color-text)',
                                                    transition: 'background 0.15s',
                                                }}
                                            >
                                                取消
                                            </button>
                                            <button
                                                onClick={() => handleDelete(entry.id)}
                                                disabled={isDeleting}
                                                style={{
                                                    height: '30px', padding: '0 14px', borderRadius: '8px',
                                                    fontSize: '12px', fontWeight: 700, cursor: isDeleting ? 'default' : 'pointer',
                                                    border: 'none',
                                                    background: '#ef4444',
                                                    color: '#fff',
                                                    opacity: isDeleting ? 0.6 : 1,
                                                    transition: 'opacity 0.15s',
                                                }}
                                            >
                                                {isDeleting ? "删除中…" : "删除"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Error */}
                    {error && (
                        <div style={{
                            marginTop: '8px', padding: '12px 14px', borderRadius: '10px',
                            background: '#fef2f2', border: '1px solid #fecaca',
                            fontSize: '13px', color: '#dc2626', fontWeight: 500,
                        }}>
                            {error}
                        </div>
                    )}
                </div>
            </SlidingPanel>
        </>
    );
}