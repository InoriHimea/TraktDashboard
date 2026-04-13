import { useState } from 'react'
import { Check, History, Star } from 'lucide-react'
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
    <div
      className="flex flex-col md:flex-row gap-6 p-6 rounded-2xl border border-[var(--color-border)] shadow-xl"
      style={{ background: 'var(--color-surface)' }}
    >
      {/* ── Left: still image ── */}
      <div className="w-full md:w-[340px] shrink-0">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[var(--color-surface-3)] shadow-lg group">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

          {/* Watched badge */}
          {data.watched && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 bg-white text-black text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full shadow">
                <Check size={9} strokeWidth={3} />
                WATCHED
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: metadata ── */}
      <div className="flex flex-col justify-between flex-1 gap-3 py-1">
        {/* Top section */}
        <div className="flex flex-col gap-3">
          {/* Breadcrumb */}
          <p className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)]">
            <span className="text-[var(--color-accent)]">{data.show.title}</span>
            <span className="mx-1.5 opacity-40">/</span>
            <span>{seasonLabel} · Episode {data.episodeNumber}</span>
          </p>

          {/* Title */}
          <h1 className="text-2xl font-bold text-[var(--color-text)] leading-snug tracking-tight">
            {title || epCode}
          </h1>

          {/* Meta chips */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--color-text-muted)]">
            {data.airDate && <span>{new Date(data.airDate).getFullYear()}</span>}
            {data.runtime && (
              <>
                <Dot />
                <span>{data.runtime} 分钟</span>
              </>
            )}
            {data.show.genres?.[0] && (
              <>
                <Dot />
                <span>{data.show.genres[0]}</span>
              </>
            )}
            {data.directors?.length > 0 && (
              <>
                <Dot />
                <span className="truncate max-w-[200px]">{data.directors.join(', ')}</span>
              </>
            )}
          </div>

          {/* Rating */}
          {data.traktRating !== null && (
            <div className="flex items-center gap-1.5 w-fit">
              <Star size={14} className="text-[var(--color-accent)] fill-[var(--color-accent)]" />
              <span className="text-base font-bold text-[var(--color-text)]">{data.traktRating}%</span>
              <span className="text-xs text-[var(--color-text-muted)]">Trakt</span>
            </div>
          )}

          {/* Overview */}
          {overview && (
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed line-clamp-4">
              {overview}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onWatchClick}
            aria-label="标记为已观看"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-150 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #7c6af7, #6d5ce6)',
              boxShadow: '0 4px 14px rgba(124,106,247,0.35)',
            }}
          >
            <Check size={15} strokeWidth={2.5} />
            标记为已观看
          </button>

          <button
            onClick={onHistoryClick}
            aria-label="观看历史"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-text)] transition-all duration-150 active:scale-95"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <History size={14} />
            历史
          </button>
        </div>
      </div>
    </div>
  )
}

function Dot() {
  return <span className="w-1 h-1 rounded-full bg-current opacity-30 inline-block" />
}
