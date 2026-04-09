import { motion } from 'framer-motion'
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Clock } from 'lucide-react'
import { useSyncStatus, useTriggerSync } from '../hooks'

export default function SyncPage() {
  const { data: sync, isLoading } = useSyncStatus()
  const { mutate: triggerSync, isPending: syncing } = useTriggerSync()

  const isRunning = sync?.status === 'running'
  const syncPct = isRunning && sync.total > 0
    ? Math.round((sync.progress / sync.total) * 100)
    : 0
  const failedShows = sync?.failedShows ?? []

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: '6px',
        }}>
          Sync
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          Sync your Trakt watch history with TMDB metadata.
        </p>
      </div>

      {/* Status card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-6 mb-4"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
      >
        {isLoading ? (
          <div className="flex items-center gap-3">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Loading sync status…</span>
          </div>
        ) : isRunning ? (
          /* Running state */
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Loader2 size={16} className="animate-spin shrink-0" style={{ color: 'var(--color-accent)' }} />
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
                Syncing… {sync.progress}/{sync.total}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {syncPct}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--color-accent)' }}
                animate={{ width: `${syncPct}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>

            {sync.currentShow && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {sync.currentShow}
              </p>
            )}
          </div>
        ) : (
          /* Idle / completed / error state */
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {sync?.status === 'error' ? (
                <AlertCircle size={16} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
              ) : sync?.status === 'completed' ? (
                <CheckCircle2 size={16} style={{ color: 'var(--color-watched)', flexShrink: 0 }} />
              ) : (
                <RefreshCw size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
                {sync?.status === 'error' ? 'Sync failed'
                  : sync?.status === 'completed' ? 'Sync completed'
                  : 'Ready to sync'}
              </span>
            </div>

            {sync?.status === 'error' && sync.error && (
              <div className="rounded-lg px-4 py-3" style={{
                background: '#ef444415',
                border: '1px solid #ef444430',
                fontSize: '13px',
                color: 'var(--color-error)',
                lineHeight: 1.5,
              }}>
                {sync.error}
              </div>
            )}

            {sync?.lastSyncAt && (
              <div className="flex items-center gap-2" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <Clock size={12} />
                Last synced: {new Date(sync.lastSyncAt).toLocaleString()}
              </div>
            )}

            <button
              onClick={() => triggerSync()}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg self-start"
              style={{
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: syncing ? 'not-allowed' : 'pointer',
                opacity: syncing ? 0.7 : 1,
              }}
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {sync?.lastSyncAt ? 'Sync now' : 'Start initial sync'}
            </button>
          </div>
        )}
      </motion.div>

      {/* Failed shows */}
      {failedShows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-6"
          style={{ background: 'var(--color-surface)', border: '1px solid #f59e0b25' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={15} style={{ color: 'var(--color-airing)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
              {failedShows.length} show{failedShows.length > 1 ? 's' : ''} failed to sync
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {failedShows.map((f, i) => (
              <div key={i} className="flex flex-col gap-1 pb-3" style={{
                borderBottom: i < failedShows.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  {f.title}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-error)', opacity: 0.85 }}>
                  {f.error}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
