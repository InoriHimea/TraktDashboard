import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { resolveShowPoster } from '../lib/image'
import type { SeasonProgress } from '@trakt-dashboard/types'

interface SeasonTabProps {
  season: SeasonProgress
  showPosterPath: string | null
  isActive: boolean
  onClick: () => void
}

export function SeasonTab({ season, showPosterPath, isActive, onClick }: SeasonTabProps) {
  const posterUrl = resolveShowPoster(showPosterPath, 'w342')
  const isComplete = season.watchedCount === season.airedCount && season.airedCount > 0
  const pct = season.airedCount > 0 ? Math.round((season.watchedCount / season.airedCount) * 100) : 0

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      aria-pressed={isActive}
      aria-label={`第 ${season.seasonNumber} 季，已观看 ${pct}%`}
      className={[
        'relative flex flex-col items-center gap-2 p-2.5 rounded-2xl border',
        'transition-all duration-200 min-w-[72px] group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
        isActive
          ? 'border-violet-500/50 bg-violet-500/10 shadow-lg shadow-violet-900/20'
          : 'border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/15',
      ].join(' ')}
    >
      {/* Poster thumbnail */}
      <div className="relative w-11 h-16 rounded-xl overflow-hidden bg-white/6">
        {posterUrl ? (
          <img src={posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-violet-950/50 to-slate-900/50" />
        )}
        {/* Season progress bar at bottom of poster */}
        {pct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
            <div
              className={`h-full transition-all ${pct === 100 ? 'bg-emerald-400' : 'bg-violet-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Label */}
      <span className={[
        'text-[11px] font-medium whitespace-nowrap transition-colors',
        isActive ? 'text-violet-300' : 'text-white/45 group-hover:text-white/65',
      ].join(' ')}>
        第 {season.seasonNumber} 季
      </span>

      {/* Active underline indicator */}
      {isActive && (
        <motion.div
          layoutId="season-active-bar"
          className="absolute -bottom-px left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-violet-400"
        />
      )}

      {/* Completion badge */}
      {isComplete && (
        <div className="absolute -top-1.5 -right-1.5 rounded-full shadow-lg shadow-emerald-900/50">
          <CheckCircle2 size={16} className="text-emerald-400 fill-emerald-950" />
        </div>
      )}
    </motion.button>
  )
}
