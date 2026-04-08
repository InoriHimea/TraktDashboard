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

  const h = compact ? 'h-1' : 'h-2'

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: 'var(--color-watched)', fontWeight: 500 }}>{watched}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> / {aired} aired</span>
            </span>
            {unairedPct > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                · {total - aired} upcoming
              </span>
            )}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(watchedPct)}%
          </span>
        </div>
      )}

      <div
        className={cn('relative w-full rounded-full overflow-hidden flex', h)}
        style={{ background: 'var(--color-surface-3)' }}
      >
        {/* Watched segment */}
        <motion.div
          className={cn('rounded-l-full', h)}
          style={{ background: 'var(--color-watched)', minWidth: watched > 0 ? '4px' : 0 }}
          initial={{ width: 0 }}
          animate={{ width: `${(watched / Math.max(total, 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* Aired but not watched */}
        <motion.div
          className={h}
          style={{
            background: 'var(--color-unwatched)',
            border: '1px solid var(--color-border)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${((aired - watched) / Math.max(total, 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        />
        {/* Not yet aired */}
        <motion.div
          className={cn('rounded-r-full', h)}
          style={{ background: 'transparent', borderTop: '1px dashed var(--color-border)', borderBottom: '1px dashed var(--color-border)' }}
          initial={{ width: 0 }}
          animate={{ width: `${unairedPct}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
        />
      </div>
    </div>
  )
}
