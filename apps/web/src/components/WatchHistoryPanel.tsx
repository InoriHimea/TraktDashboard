import { useState } from "react";
import { Trash2, Clock, Eye } from "lucide-react";
import { SlidingPanel } from "./SlidingPanel";
import { Button } from "./ui/Button";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { useEpisodeHistory, useShowHistory, useDeleteHistory } from "../hooks";
import { t } from "../lib/i18n";
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
            setError(err instanceof Error ? err.message : t("watchHistory.deleteError"));
        } finally {
            setDeletingId(null);
        }
    };

    const formatWatchedAt = (watchedAt: string | null) => {
        if (!watchedAt) return t("watchHistory.unknownTime");
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
                title={isEpisodeHistory ? t("watchHistory.episodeTitle") : t("watchHistory.showTitle")}
                subtitle={history && history.length > 0 ? t("watchHistory.recordCount", { count: history.length }) : undefined}
                icon={<Clock size={16} style={{ color: '#6366f1' }} />}
            >
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>

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
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>{t("watchHistory.empty")}</p>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t("watchHistory.emptyHint")}</p>
                            </div>
                        </div>
                    )}

                    {/* History entries */}
                    {!isLoading && history && history.length > 0 && history.map((entry, index) => {
                        const time = formatWatchedAt(entry.watchedAt);
                        const isDeleting = deletingId === entry.id;
                        // Alternate soft accent colors for the index badge
                        const badgeColors = [
                            { bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.25)', dot: '#6366f1' },
                            { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)', dot: '#10b981' },
                            { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', dot: '#f59e0b' },
                            { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.22)', dot: '#ef4444' },
                            { bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.25)', dot: '#8b5cf6' },
                        ];
                        const badge = badgeColors[index % badgeColors.length];

                        return (
                            <div
                                key={entry.id}
                                style={{
                                    borderRadius: '14px',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-surface-2)',
                                    overflow: 'hidden',
                                    transition: 'border-color 0.15s, box-shadow 0.15s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 10px rgba(0,0,0,0.09)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                                }}
                            >
                                {/* Entry row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px' }}>
                                    {/* Clock icon badge */}
                                    <div style={{
                                        width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                                        background: badge.bg,
                                        border: `1px solid ${badge.border}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Clock size={14} style={{ color: badge.dot }} />
                                    </div>

                                    {/* 3-line content */}
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        {/* Line 1: SxEx identifier — bold accent */}
                                        {!isEpisodeHistory && (
                                            <div style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            }}>
                                                <span style={{
                                                    fontSize: '11px', fontWeight: 700,
                                                    letterSpacing: '0.06em',
                                                    color: badge.dot,
                                                    background: badge.bg,
                                                    border: `1px solid ${badge.border}`,
                                                    borderRadius: '6px',
                                                    padding: '1px 7px',
                                                    lineHeight: '18px',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    S{String(entry.seasonNumber).padStart(2, "0")}·E{String(entry.episodeNumber).padStart(2, "0")}
                                                </span>
                                            </div>
                                        )}

                                        {/* Line 2: Episode title */}
                                        {entry.episodeTitle && (
                                            <p style={{
                                                fontSize: '13px', fontWeight: 600,
                                                color: 'var(--color-text)',
                                                lineHeight: 1.4,
                                                margin: 0,
                                                // allow wrapping for long titles
                                            }}>
                                                {entry.episodeTitle}
                                            </p>
                                        )}

                                        {/* Line 3: Time */}
                                        <p style={{
                                            fontSize: '11.5px',
                                            color: 'var(--color-text-muted)',
                                            lineHeight: 1.4,
                                            margin: 0,
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                        }}>
                                            {typeof time === 'string' ? time : (
                                                <>
                                                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{time.relative}</span>
                                                    <span style={{ opacity: 0.35 }}>·</span>
                                                    <span>{time.absolute}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    {/* Delete button */}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        color="rose"
                                        size="sm"
                                        disabled={isDeleting}
                                        icon={<Trash2 size={13} />}
                                        onClick={() => setConfirmingDelete(entry.id)}
                                        aria-label={t("watchHistory.deleteLabel")}
                                        className="h-7 w-7 flex-shrink-0 rounded-lg px-0"
                                    />
                                </div>
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
            <ConfirmDialog
                isOpen={confirmingDelete !== null}
                title={t("common.delete")}
                description={t("watchHistory.deleteConfirm")}
                confirmText={t("common.delete")}
                confirmColor="rose"
                cancelText={t("common.cancel")}
                isLoading={deletingId !== null}
                onConfirm={() => {
                    if (confirmingDelete !== null) {
                        handleDelete(confirmingDelete);
                    }
                }}
                onCancel={() => setConfirmingDelete(null)}
            />
        </>
    );
}