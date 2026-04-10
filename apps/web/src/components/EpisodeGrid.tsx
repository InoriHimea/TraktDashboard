import { AnimatePresence, motion } from 'framer-motion'
import { EpisodeCard } from './EpisodeCard'
import type { EpisodeProgress } from '@trakt-dashboard/types'

interface EpisodeGridProps {
  episodes: EpisodeProgress[]
  seasonNumber: number
}

export function EpisodeGrid({ episodes, seasonNumber }: EpisodeGridProps) {
  const watched = episodes.filter(e => e.watched).length
  const aired   = episodes.filter(e => e.aired).length
  const unaired = episodes.length - aired

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={seasonNumber}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22 }}
      >
        {/* Summary bar */}
        <div className="flex items-center gap-4 mb-5 text-xs text-white/35">
          <span>
            <span className="text-white/65 font-semibold">{watched}</span>
            {' / '}{aired} 已观看
          </span>
          {unaired > 0 && (
            <span className="text-white/20">{unaired} 未播出</span>
          )}
          {watched === aired && aired > 0 && (
            <span className="text-emerald-400/70 font-medium">✓ 本季已看完</span>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {episodes.map((ep, i) => (
            <EpisodeCard
              key={ep.episodeId}
              episode={ep}
              index={i}
              seasonNumber={seasonNumber}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
