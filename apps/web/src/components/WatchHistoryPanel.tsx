import { useState } from 'react'
import { Trash2, AlertCircle } from 'lucide-react'
import { SlidingPanel } from './SlidingPanel'
import { Button } from './ui/Button'
import { useEpisodeHistory, useShowHistory, useDeleteHistory } from '../hooks'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface WatchHistoryPanelProps {
  open: boolean
  onClose: () => void
  showId: number
  seasonNumber?: number
  episodeNumber?: number
  onDeleted: () => void
}

export function WatchHistoryPanel({
  open,
  onClose,
  showId,
  seasonNumber,
  episodeNumber,
  onDeleted,
}: WatchHistoryPanelProps) {
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Use episode history if season/episode provided, otherwise show history
  const isEpisodeHistory = seasonNumber !== undefined && episodeNumber !== undefined
  const episodeHistoryQuery = useEpisodeHistory(
    showId,
    seasonNumber ?? 0,
    episodeNumber ?? 0
  )
  const showHistoryQuery = useShowHistory(showId)

  const query = isEpisodeHistory ? episodeHistoryQuery : showHistoryQuery
  const { data: history, isLoading } = query

  const deleteHistory = useDeleteHistory(showId)

  const handleDelete = async (historyId: number) => {
    setError(null)
    try {
      await deleteHistory.mutateAsync(historyId)
      setConfirmingDelete(null)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败，请重试')
    }
  }

  const formatWatchedAt = (watchedAt: string | null) => {
    if (!watchedAt) return '未知时间'
    try {
      const d = dayjs(watchedAt)
      const relative = d.fromNow()
      const absolute = d.format('YYYY/MM/DD HH:mm')
      return `${relative} (${absolute})`
    } catch {
      return watchedAt
    }
  }

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      title={isEpisodeHistory ? '观看历史' : '全剧观看历史'}
    >
      <div className="p-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin border-[var(--color-accent)]" />
          </div>
        )}

        {!isLoading && (!history || history.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center mb-3">
              <AlertCircle size={20} className="text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">暂无观看记录</p>
          </div>
        )}

        {!isLoading && history && history.length > 0 && (
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]"
              >
                {/* Episode title (for show history) */}
                {!isEpisodeHistory && (
                  <div className="text-sm font-medium text-[var(--color-text)] mb-2">
                    S{String(entry.seasonNumber).padStart(2, '0')} · E
                    {String(entry.episodeNumber).padStart(2, '0')}
                    {entry.episodeTitle && ` - ${entry.episodeTitle}`}
                  </div>
                )}

                {/* Watched at */}
                <div className="text-xs text-[var(--color-text-muted)] mb-3">
                  {formatWatchedAt(entry.watchedAt)}
                </div>

                {/* Delete button or confirmation */}
                {confirmingDelete === entry.id ? (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--color-text-muted)]">确认删除此记录？</p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingDelete(null)}
                        className="flex-1 text-xs"
                      >
                        取消
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deleteHistory.isPending}
                        className="flex-1 text-xs"
                      >
                        {deleteHistory.isPending ? '删除中...' : '确认删除'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(entry.id)}
                    className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={12} />
                    删除记录
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </SlidingPanel>
  )
}
