import { useState } from 'react'
import { Play, History, Calendar, Clock } from 'lucide-react'
import { Button } from './ui/Button'
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

  return (
    <div className="flex gap-8 items-start">
      {/* Left: Episode still (16:9, ~480px width) */}
      <div className="w-[480px] shrink-0">
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[var(--color-surface-3)]">
          {showImg ? (
            <img
              src={stillUrl}
              alt={title || 'Episode still'}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <EpisodePlaceholder
              seasonNumber={data.seasonNumber}
              episodeNumber={data.episodeNumber}
            />
          )}
        </div>
      </div>

      {/* Right: Metadata */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">
            {title || `S${data.seasonNumber}E${data.episodeNumber}`}
          </h1>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span>
              S{String(data.seasonNumber).padStart(2, '0')} · E
              {String(data.episodeNumber).padStart(2, '0')}
            </span>
            {data.airDate && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(data.airDate).getFullYear()}
                </span>
              </>
            )}
            {data.runtime && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {data.runtime} 分钟
                </span>
              </>
            )}
          </div>
        </div>

        {/* Rating */}
        {data.traktRating !== null && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 w-fit">
            <span className="text-sm font-semibold text-[var(--color-accent)]">
              {data.traktRating}%
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Trakt 评分</span>
          </div>
        )}

        {/* Directors */}
        {data.directors && data.directors.length > 0 && (
          <div>
            <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">导演</div>
            <div className="text-sm text-[var(--color-text)]">
              {data.directors.join(', ')}
            </div>
          </div>
        )}

        {/* Overview */}
        {overview && (
          <div>
            <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">剧情简介</div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {overview}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-2">
          <Button
            variant="primary"
            size="md"
            icon={<Play size={16} />}
            onClick={onWatchClick}
            aria-label="标记为已观看"
          >
            标记为已观看
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<History size={16} />}
            onClick={onHistoryClick}
          >
            观看历史
          </Button>
        </div>
      </div>
    </div>
  )
}
