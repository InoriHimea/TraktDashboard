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
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
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
        style={{
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginBottom: '16px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Loading sync status…</span>
          </div>
        ) : isRunning ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
                Syncing… {sync.progress}/{sync.total}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {syncPct}%
              </span>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', overflow: 'hidden', background: 'var(--color-surface-3)' }}>
              <motion.div
                style={{ height: '100%', borderRadius: '999px', background: 'var(--color-accent)' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Status row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {sync?.status === 'error' ? (
                <AlertCircle size={18} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
              ) : sync?.status === 'completed' ? (
                <CheckCircle2 size={18} style={{ color: 'var(--color-watched)', flexShrink: 0 }} />
              ) : (
                <RefreshCw size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text)' }}>
                {sync?.status === 'error' ? 'Sync failed'
                  : sync?.status === 'completed' ? 'Sync completed'
                  : 'Ready to sync'}
              </span>
            </div>

            {sync?.status === 'error' && sync.error && (
              <div style={{
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                background: '#ef444412',
                border: '1px solid #ef444428',
                fontSize: '13px',
                color: 'var(--color-error)',
                lineHeight: 1.6,
              }}>
                {sync.error}
              </div>
            )}

            {sync?.lastSyncAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                <Clock size={13} />
                Last synced: {new Date(sync.lastSyncAt).toLocaleString()}
              </div>
            )}

            {/* CTA button */}
            <div>
              <motion.button
                onClick={() => triggerSync()}
                disabled={syncing}
                whileHover={syncing ? {} : { scale: 1.02, boxShadow: '0 4px 20px var(--color-accent-glow)' }}
                whileTap={syncing ? {} : { scale: 0.98 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: syncing ? 'var(--color-surface-3)' : 'var(--color-accent)',
                  color: syncing ? 'var(--color-text-muted)' : '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  letterSpacing: '-0.01em',
                  transition: 'background 0.15s',
                }}
              >
                <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Queuing…' : sync?.lastSyncAt ? 'Sync now' : 'Start initial sync'}
              </motion.button>
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
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            background: 'var(--color-surface)',
            border: '1px solid #f59e0b22',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={15} style={{ color: 'var(--color-airing)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
              {failedShows.length} show{failedShows.length > 1 ? 's' : ''} failed to sync
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {failedShows.map((f, i) => (
              <div key={i} style={{
                paddingBottom: i < failedShows.length - 1 ? '12px' : 0,
                borderBottom: i < failedShows.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: '2px' }}>
                  {f.title}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--color-error)', opacity: 0.8 }}>
                  {f.error}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
