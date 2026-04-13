import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { resolveEpisodeTitle } from '../lib/i18n'
import { resolveEpisodeStill } from '../lib/image'
import { EpisodePlaceholder } from './ui/EpisodePlaceholder'
import type { EpisodeProgress } from '@trakt-dashboard/types'

interface EpisodeSeasonStripProps {
  episodes: EpisodeProgress[]
  seasonNumber: number
  currentEpisodeNumber: number
  showId: number
}

export function EpisodeSeasonStrip({
  episodes,
  seasonNumber,
  currentEpisodeNumber,
  showId,
}: EpisodeSeasonStripProps) {
  const navigate = useNavigate()
  const currentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [])

  const seasonLabel = seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`

  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
        <span>Seasons</span>
        <span style={{ opacity: 0.3 }}>/</span>
        <span style={{ color: 'var(--color-text)' }}>{seasonLabel}</span>
      </div>

      {/* Horizontal scroll */}
      <div
        style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}
      >
        {episodes.map((ep) => {
          const isCurrent = ep.episodeNumber === currentEpisodeNumber
          const isUnaired = ep.aired === false

          return (
            <EpisodeThumbnail
              key={ep.episodeId}
              episode={ep}
              seasonNumber={seasonNumber}
              showId={showId}
              isCurrent={isCurrent}
              isUnaired={isUnaired}
              ref={isCurrent ? currentRef : null}
              onNavigate={(s, e) => navigate(`/shows/${showId}/seasons/${s}/episodes/${e}`)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Episode Thumbnail ────────────────────────────────────────────────────────

interface EpisodeThumbnailProps {
  episode: EpisodeProgress
  seasonNumber: number
  showId: number
  isCurrent: boolean
  isUnaired: boolean
  onNavigate: (season: number, episode: number) => void
}

const EpisodeThumbnail = React.forwardRef<HTMLDivElement, EpisodeThumbnailProps>(
  ({ episode, seasonNumber, isCurrent, isUnaired, onNavigate }, ref) => {
    const [imgError, setImgError] = useState(false)

    const title = resolveEpisodeTitle(episode)
    const stillUrl = resolveEpisodeStill(episode.stillPath)
    const showImg = stillUrl && !imgError
    const isWatched = episode.watched
    const epCode = `S${String(seasonNumber).padStart(2, '0')} • E${String(episode.episodeNumber).padStart(2, '0')}`

    return (
      <div
        ref={ref}
        className={[
          'w-[260px] shrink-0 group',
          isUnaired ? 'opacity-60 cursor-default' : 'cursor-pointer',
        ].join(' ')}
        onClick={() => !isUnaired && onNavigate(seasonNumber, episode.episodeNumber)}
        aria-current={isCurrent ? 'true' : undefined}
        aria-label={`${epCode} ${title}`}
      >
        {/* Thumbnail */}
        <div
          className={[
            'relative w-full aspect-video rounded-lg overflow-hidden mb-3 shadow-md',
            isCurrent ? 'ring-2 ring-violet-500' : '',
          ].join(' ')}
        >
          {showImg ? (
            <img
              src={stillUrl}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <EpisodePlaceholder seasonNumber={seasonNumber} episodeNumber={episode.episodeNumber} />
          )}

          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

          {/* Runtime badge */}
          {episode.runtime && (
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
              {episode.runtime}分钟
            </div>
          )}

          {/* Unaired overlay */}
          {isUnaired && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-white/60">
                未播出
              </span>
            </div>
          )}
        </div>

        {/* Title row */}
        <div className="flex justify-between items-start gap-2">
          <div className="overflow-hidden flex-1">
            <h4
              className={[
                'text-sm font-semibold truncate transition-colors',
                isCurrent
                  ? 'text-[var(--color-accent)]'
                  : isWatched
                  ? 'text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]'
                  : 'text-[var(--color-text)] group-hover:text-[var(--color-accent)]',
              ].join(' ')}
            >
              {title || `Episode ${episode.episodeNumber}`}
            </h4>
            <p className="text-[var(--color-text-muted)] text-xs mt-0.5 font-medium">{epCode}</p>
          </div>

          {/* Watched check */}
          {isWatched && (
            <Check size={13} className="text-[var(--color-accent)] mt-0.5 shrink-0" strokeWidth={2.5} />
          )}
        </div>
      </div>
    )
  }
)

EpisodeThumbnail.displayName = 'EpisodeThumbnail'
