import { useState } from 'react'
import { Check, MoreVertical } from 'lucide-react'
import { EpisodePlaceholder } from './ui/EpisodePlaceholder'
import { resolveEpisodeStill } from '../lib/image'
import type { EpisodeDetailData } from '@trakt-dashboard/types'

interface EpisodeInfoCardProps {
  data: EpisodeDetailData
  onWatchClick: () => void
  onHistoryClick: () => void
}

export function EpisodeInfoCard({ data, onWatchClick, onHistoryClick }: EpisodeInfoCardProps) {
  const [imgError, setImgError] = useState(false)

  const title = data.translatedTitle ?? data.title
  const overview = data.translatedOverview ?? data.overview
  const stillUrl = resolveEpisodeStill(data.stillPath)
  const showImg = stillUrl && !imgError

  const seasonLabel = data.seasonNumber === 0 ? 'Specials' : `Season ${data.seasonNumber}`
  const epCode = `S${String(data.seasonNumber).padStart(2, '0')} · E${String(data.episodeNumber).padStart(2, '0')}`

  return (
    <div className="flex flex-col md:flex-row gap-8 bg-[var(--color-surface)] p-8 rounded-2xl border border-[var(--color-border)] shadow-2xl">
      {/* Left: Episode still */}
      <div className="w-full md:w-[380px] shrink-0">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[var(--color-surface-3)] group shadow-lg">
          {showImg ? (
            <img
              src={stillUrl}
              alt={title || epCode}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <EpisodePlaceholder seasonNumber={data.seasonNumber} episodeNumber={data.episodeNumber} />
          )}

          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

          {/* Watched badge on image */}
          {data.watched && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-1.5 bg-white text-black px-3 py-1 rounded-full text-[10px] font-bold tracking-wider shadow-md">
                <Check size={10} strokeWidth={3} />
                WATCHED
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Metadata */}
      <div className="flex flex-col justify-center flex-1 gap-4">
        {/* Show name + season/episode breadcrumb */}
        <div className="text-[13px] font-semibold tracking-wide">
          <span className="text-[var(--color-accent)]">{data.show.title}</span>
          <span className="text-[var(--color-text-muted)] ml-1.5">{seasonLabel} - Episode {data.episodeNumber}</span>
        </div>

        {/* Episode title */}
        <h1 className="text-3xl font-bold text-[var(--color-text)] tracking-tight leading-tight">
          {title || epCode}
        </h1>

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-2 text-sm text-[var(--color-text-muted)] font-medium">
          {data.airDate && <span>{new Date(data.airDate).getFullYear()}</span>}
          {data.airDate && data.runtime && <Dot />}
          {data.runtime && <span>{data.runtime}分钟</span>}
          {data.directors && data.directors.length > 0 && (
            <>
              <Dot />
              <span>{data.directors.join(', ')}</span>
            </>
          )}
          {data.show.genres && data.show.genres.length > 0 && (
            <>
              <Dot />
              <span>{data.show.genres[0]}</span>
            </>
          )}
        </div>

        {/* Rating */}
        {data.traktRating !== null && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--color-accent)]">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span className="font-bold text-lg text-[var(--color-text)]">{data.traktRating}%</span>
              <span className="text-xs text-[var(--color-text-muted)]">Trakt</span>
            </div>
          </div>
        )}

        {/* Overview */}
        {overview && (
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed max-w-2xl">
            {overview}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={onWatchClick}
            aria-label="标记为已观看"
            className="flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-lg shadow-violet-500/20"
          >
            <Check size={16} strokeWidth={2.5} />
            标记为已观看
          </button>
          <button
            onClick={onHistoryClick}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label="更多选项"
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Dot() {
  return <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] opacity-40 inline-block" />
}
