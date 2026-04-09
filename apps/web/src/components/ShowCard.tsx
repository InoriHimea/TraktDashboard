import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, PlayCircle, Tv2 } from 'lucide-react'
import type { ShowProgress } from '@trakt-dashboard/types'
import { ProgressBar } from './ProgressBar'
import { tmdbImage, formatEpisode, daysAgo } from '../lib/utils'

interface ShowCardProps {
  progress: ShowProgress
  index: number
}

const STATUS_DOT: Record<string, string> = {
  'returning series': 'var(--color-airing)',
  'ended':            'var(--color-ended)',
  'canceled':         'var(--color-error)',
  'in production':    'var(--color-airing)',
}

export function ShowCard({ progress, index }: ShowCardProps) {
  const { show, watchedEpisodes, airedEpisodes, nextEpisode, lastWatchedAt, completed, percentage } = progress
  const poster = tmdbImage(show.posterPath, 'w185')
  const dotColor = STATUS_DOT[show.status] || 'var(--color-text-muted)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.025, 0.3), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/shows/${show.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <motion.div
          whileHover={{ backgroundColor: 'var(--color-surface-2)' }}
          transition={{ duration: 0.12 }}
          className="flex items-center gap-4 px-4 py-3 rounded-xl"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-subtle)',
            cursor: 'pointer',
          }}
        >
          {/* Poster — compact */}
          <div
            className="shrink-0 rounded-lg overflow-hidden"
            style={{ width: '44px', height: '64px', background: 'var(--color-surface-3)' }}
          >
            {poster ? (
              <img src={poster} alt={show.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Tv2 size={16} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
              </div>
            )}
          </div>

          {/* Title + meta — fixed width */}
          <div style={{ width: '220px', flexShrink: 0 }}>
            <h3
              className="truncate"
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.01em', marginBottom: '4px' }}
            >
              {show.title}
            </h3>
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', truncate: true }}>
                {show.network || show.status}
              </span>
            </div>
          </div>

          {/* Progress bar — flex grow */}
          <div className="flex-1 min-w-0">
            <ProgressBar
              watched={watchedEpisodes}
              aired={airedEpisodes}
              total={show.totalEpisodes}
              compact
              showLabel={false}
            />
            <div className="flex items-center justify-between mt-1">
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <span style={{ color: 'var(--color-watched)', fontWeight: 500 }}>{watchedEpisodes}</span>
                {' / '}{airedEpisodes}
                {show.totalEpisodes > airedEpisodes && (
                  <span style={{ opacity: 0.6 }}> · {show.totalEpisodes - airedEpisodes} left</span>
                )}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {percentage}%
              </span>
            </div>
          </div>

          {/* Right meta — fixed width */}
          <div className="shrink-0 flex flex-col items-end gap-1.5" style={{ width: '110px' }}>
            {completed ? (
              <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--color-watched)' }}>
                <CheckCircle2 size={11} /> Done
              </span>
            ) : nextEpisode ? (
              <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--color-accent)' }}>
                <PlayCircle size={11} />
                {formatEpisode(nextEpisode.seasonNumber, nextEpisode.episodeNumber)}
              </span>
            ) : null}
            <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              <Clock size={10} />
              {daysAgo(lastWatchedAt)}
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}
