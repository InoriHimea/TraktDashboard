import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

interface ProgressBarProps {
  watched: number
  aired: number
  total: number
  compact?: boolean
  showLabel?: boolean
}

export function ProgressBar({ watched, aired, total, compact = false, showLabel = true }: ProgressBarProps) {
  const watchedPct = aired > 0 ? (watched / aired) * 100 : 0
  const airedPct = total > 0 ? (aired / total) * 100 : 100
  const unairedPct = 100 - airedPct

  // Track height: compact = 2px pill, normal = 4px
  const trackH = compact ? '2px' : '4px'

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{watched}</span>
            <span> / {aired} 已播出</span>
            {unairedPct > 0 && total > aired && (
              <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}> · {total - aired} 未播</span>
            )}
          </span>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            color: watchedPct >= 100 ? 'var(--color-watched)' : 'var(--color-accent)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.round(watchedPct)}%
          </span>
        </div>
      )}

      {/* Track */}
      <div
        className={cn('relative w-full overflow-hidden flex')}
        style={{
          height: trackH,
          borderRadius: '999px',
          background: 'var(--color-surface-3)',
        }}
      >
        {/* Watched — accent purple */}
        <motion.div
          style={{
            height: '100%',
            background: 'var(--color-accent)',
            borderRadius: '999px 0 0 999px',
            minWidth: watched > 0 ? '3px' : 0,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${(watched / Math.max(total, 1)) * 100}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* Aired but unwatched — dim surface */}
        <motion.div
          style={{
            height: '100%',
            background: 'var(--color-surface-4)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${((aired - watched) / Math.max(total, 1)) * 100}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        />
        {/* Not yet aired — transparent (track bg shows through) */}
        <div style={{ flex: 1, height: '100%' }} />
      </div>
    </div>
  )
}
