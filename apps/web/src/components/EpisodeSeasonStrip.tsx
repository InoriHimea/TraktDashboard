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

  // Auto-scroll to current episode on mount
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [])

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
        本季所有集数
      </h2>
      
      {/* Horizontal scrolling container */}
      <div
        className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-1 px-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}
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
  ({ episode, seasonNumber, showId, isCurrent, isUnaired, onNavigate }, ref) => {
    const [imgError, setImgError] = useState(false)

    const title = resolveEpisodeTitle(episode)
    const stillUrl = resolveEpisodeStill(episode.stillPath)
    const showImg = stillUrl && !imgError
    const isWatched = episode.watched
    const epCode = `S${String(seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`

    const handleClick = () => {
      if (!isUnaired) {
        onNavigate(seasonNumber, episode.episodeNumber)
      }
    }

    return (
      <div
        ref={ref}
        className={[
          'shrink-0 snap-start flex flex-col gap-2 group',
          isUnaired ? 'opacity-40 cursor-default' : 'cursor-pointer',
        ].join(' ')}
        style={{ width: '200px' }}
        onClick={handleClick}
        aria-current={isCurrent ? 'true' : undefined}
        aria-label={`${epCode} ${title}`}
      >
        {/* Thumbnail */}
        <div
          className={[
            'relative w-full aspect-video rounded-lg overflow-hidden bg-[var(--color-surface-3)] border-2 transition-colors',
            isCurrent
              ? 'border-violet-500'
              : 'border-transparent group-hover:border-[var(--color-border)]',
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

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

          {/* Watched checkmark */}
          {isWatched && (
            <div className="absolute top-2 left-2">
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'linear-gradient(145deg, #f472b6, #db2777)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={12} strokeWidth={3} className="text-white" />
              </div>
            </div>
          )}

          {/* Unaired label */}
          {isUnaired && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-white/50">
                未播出
              </span>
            </div>
          )}

          {/* Current indicator */}
          {isCurrent && (
            <div className="absolute bottom-2 left-2 right-2">
              <div className="px-2 py-0.5 rounded-full bg-violet-500 text-white text-[9px] font-bold text-center">
                当前集
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="px-0.5">
          <p
            className={[
              'text-[11px] font-medium leading-snug line-clamp-2 transition-colors',
              isCurrent
                ? 'text-[var(--color-text)]'
                : isWatched
                ? 'text-[var(--color-text-muted)]'
                : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            {title}
          </p>
          <span className="text-[9px] text-[var(--color-text-muted)]">{epCode}</span>
        </div>
      </div>
    )
  }
)

EpisodeThumbnail.displayName = 'EpisodeThumbnail'
