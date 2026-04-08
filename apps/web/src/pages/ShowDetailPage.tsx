import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ChevronDown, ChevronUp, CheckCircle2,
  Circle, Clock, ExternalLink, Tv2, Calendar
} from 'lucide-react'
import { useShowDetail } from '../hooks'
import { ProgressBar } from '../components/ProgressBar'
import { tmdbImage, formatEpisode, daysAgo, pluralize, cn } from '../lib/utils'
import type { SeasonProgress, EpisodeProgress } from '@trakt-dashboard/types'

const STATUS_COLOR: Record<string, string> = {
  'returning series': 'var(--color-airing)',
  'ended': 'var(--color-ended)',
  'canceled': '#ef4444',
  'in production': 'var(--color-airing)',
}

export default function ShowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: progress, isLoading } = useShowDetail(Number(id))
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([1]))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="px-8 py-12 text-center">
        <p style={{ color: 'var(--color-text-muted)' }}>Show not found.</p>
      </div>
    )
  }

  const { show, watchedEpisodes, airedEpisodes, lastWatchedAt, completed, seasons } = progress
  const backdrop = tmdbImage(show.backdropPath, 'w1280')
  const poster = tmdbImage(show.posterPath, 'w342')
  const statusColor = STATUS_COLOR[show.status] || 'var(--color-text-muted)'

  function toggleSeason(n: number) {
    setExpandedSeasons(prev => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Backdrop hero */}
      <div className="relative w-full" style={{ height: '260px' }}>
        {backdrop ? (
          <>
            <img src={backdrop} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to bottom, transparent 0%, var(--color-bg) 90%)'
            }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: 'var(--color-surface)' }} />
        )}

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-8 flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-sm"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      {/* Show info */}
      <div className="px-8 -mt-16 relative z-10">
        <div className="flex gap-6 mb-8">
          {/* Poster */}
          <div
            className="shrink-0 rounded-xl overflow-hidden shadow-2xl"
            style={{ width: '110px', height: '165px', background: 'var(--color-surface-3)', flexShrink: 0 }}
          >
            {poster ? (
              <img src={poster} alt={show.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Tv2 size={32} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
              </div>
            )}
          </div>

          <div className="flex-1 pt-16">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '28px',
                  color: 'var(--color-text)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                }}>
                  {show.title}
                </h2>
                <div className="flex items-center gap-3 mt-1.5">
                  <span style={{ fontSize: '13px', color: statusColor, fontWeight: 500 }}>
                    {show.status.charAt(0).toUpperCase() + show.status.slice(1)}
                  </span>
                  {show.network && (
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {show.network}
                    </span>
                  )}
                  {show.firstAired && (
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {new Date(show.firstAired).getFullYear()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                {show.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${show.imdbId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                    style={{
                      background: 'var(--color-surface-3)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                      textDecoration: 'none',
                    }}
                  >
                    IMDB <ExternalLink size={11} />
                  </a>
                )}
                {show.traktSlug && (
                  <a
                    href={`https://trakt.tv/shows/${show.traktSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                    style={{
                      background: 'var(--color-surface-3)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                      textDecoration: 'none',
                    }}
                  >
                    Trakt <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>

            {/* Genres */}
            {show.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {show.genres.slice(0, 5).map((g: string) => (
                  <span
                    key={g}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'var(--color-surface-3)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Overall progress */}
            <ProgressBar
              watched={watchedEpisodes}
              aired={airedEpisodes}
              total={show.totalEpisodes}
            />

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <Clock size={12} />
                Last watched {daysAgo(lastWatchedAt)}
              </div>
              <div className="flex items-center gap-1.5" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <Calendar size={12} />
                {pluralize(show.totalSeasons, 'season')}
              </div>
              {completed && (
                <div className="flex items-center gap-1.5" style={{ fontSize: '12px', color: 'var(--color-watched)' }}>
                  <CheckCircle2 size={12} />
                  Completed
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overview */}
        {show.overview && (
          <p style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.7,
            maxWidth: '680px',
            marginBottom: '32px',
          }}>
            {show.overview}
          </p>
        )}

        {/* Seasons */}
        <div className="flex flex-col gap-3 pb-12">
          {seasons.map((season: SeasonProgress) => (
            <SeasonBlock
              key={season.seasonNumber}
              season={season}
              expanded={expandedSeasons.has(season.seasonNumber)}
              onToggle={() => toggleSeason(season.seasonNumber)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Season Block ─────────────────────────────────────────────────────────────

function SeasonBlock({
  season,
  expanded,
  onToggle,
}: {
  season: SeasonProgress
  expanded: boolean
  onToggle: () => void
}) {
  const pct = season.airedCount > 0
    ? Math.round((season.watchedCount / season.airedCount) * 100)
    : 0

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
    >
      {/* Season header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
              Season {season.seasonNumber}
            </span>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--color-watched)' }}>{season.watchedCount}</span>
                {' / '}{season.airedCount} aired
                {season.episodeCount > season.airedCount && (
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {' · '}{season.episodeCount - season.airedCount} upcoming
                  </span>
                )}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', minWidth: '32px', textAlign: 'right' }}>
                {pct}%
              </span>
              {expanded
                ? <ChevronUp size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                : <ChevronDown size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
            </div>
          </div>
          <ProgressBar
            watched={season.watchedCount}
            aired={season.airedCount}
            total={season.episodeCount}
            compact
            showLabel={false}
          />
        </div>
      </button>

      {/* Episode grid */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="px-5 pb-4"
              style={{ borderTop: '1px solid var(--color-border-subtle)' }}
            >
              <div className="grid gap-1 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {season.episodes.map((ep: EpisodeProgress) => (
                  <EpisodeRow key={ep.episodeId} ep={ep} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Episode Row ──────────────────────────────────────────────────────────────

function EpisodeRow({ ep }: { ep: EpisodeProgress }) {
  const isUpcoming = !ep.aired
  const isWatched = ep.watched

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{
        background: isWatched ? 'var(--color-accent-muted)' : 'transparent',
        opacity: isUpcoming ? 0.45 : 1,
      }}
    >
      {isWatched ? (
        <CheckCircle2 size={14} style={{ color: 'var(--color-watched)', flexShrink: 0 }} />
      ) : isUpcoming ? (
        <Circle size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0, opacity: 0.4 }} />
      ) : (
        <Circle size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{
            fontSize: '11px',
            color: isWatched ? 'var(--color-accent)' : 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}>
            {formatEpisode(ep.seasonNumber, ep.episodeNumber)}
          </span>
          <span className="truncate" style={{
            fontSize: '13px',
            color: isWatched ? 'var(--color-text)' : isUpcoming ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
          }}>
            {ep.title || 'Untitled'}
          </span>
        </div>
      </div>

      {ep.airDate && (
        <span style={{
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {isWatched && ep.watchedAt
            ? daysAgo(ep.watchedAt)
            : ep.airDate}
        </span>
      )}
    </motion.div>
  )
}
