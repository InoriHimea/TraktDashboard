import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, PlayCircle } from 'lucide-react'
import type { ShowProgress } from '@trakt-dashboard/types'
import { ProgressBar } from './ProgressBar'
import { tmdbImage, formatEpisode, daysAgo, cn } from '../lib/utils'

interface ShowCardProps {
  progress: ShowProgress
  index: number
}

const STATUS_COLOR: Record<string, string> = {
  'returning series': 'var(--color-airing)',
  'ended': 'var(--color-ended)',
  'canceled': '#ef4444',
  'in production': 'var(--color-airing)',
  default: 'var(--color-text-muted)',
}

export function ShowCard({ progress, index }: ShowCardProps) {
  const { show, watchedEpisodes, airedEpisodes, nextEpisode, lastWatchedAt, completed, percentage } = progress
  const poster = tmdbImage(show.posterPath, 'w185')
  const statusColor = STATUS_COLOR[show.status] || STATUS_COLOR.default

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/shows/${show.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="flex gap-4 p-4 rounded-xl"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-subtle)',
            cursor: 'pointer',
          }}
        >
          {/* Poster */}
          <div
            className="shrink-0 rounded-lg overflow-hidden"
            style={{ width: '52px', height: '78px', background: 'var(--color-surface-3)' }}
          >
            {poster ? (
              <img src={poster} alt={show.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span style={{ fontSize: '20px', opacity: 0.3 }}>🎬</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3
                className="truncate"
                style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.3 }}
              >
                {show.title}
              </h3>
              {completed && (
                <span className="shrink-0 flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--color-watched)' }}>
                  <CheckCircle2 size={12} />
                  Done
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-3">
              <span style={{ fontSize: '12px', color: statusColor, fontWeight: 500 }}>
                {show.status.charAt(0).toUpperCase() + show.status.slice(1)}
              </span>
              {show.network && (
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {show.network}
                </span>
              )}
              <span className="flex items-center gap-1" style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                <Clock size={11} />
                {daysAgo(lastWatchedAt)}
              </span>
            </div>

            <ProgressBar
              watched={watchedEpisodes}
              aired={airedEpisodes}
              total={show.totalEpisodes}
              compact
              showLabel={false}
            />

            <div className="flex items-center justify-between mt-2">
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <span style={{ color: 'var(--color-watched)', fontWeight: 500 }}>{watchedEpisodes}</span>
                {' / '}{airedEpisodes} aired
                {show.totalEpisodes > airedEpisodes && (
                  <span> · {show.totalEpisodes - airedEpisodes} upcoming</span>
                )}
              </span>
              {nextEpisode && !completed && (
                <span
                  className="flex items-center gap-1"
                  style={{ fontSize: '11px', color: 'var(--color-accent)' }}
                >
                  <PlayCircle size={11} />
                  Next: {formatEpisode(nextEpisode.seasonNumber, nextEpisode.episodeNumber)}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}
