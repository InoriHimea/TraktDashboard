import { useState } from 'react'
import { Check, MoreVertical, Star } from 'lucide-react'
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

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 bg-[var(--color-surface)] p-6 sm:p-8 lg:p-10 rounded-3xl border border-[var(--color-border)] shadow-sm">
      
      {/* 左侧海报：固定比例与合理宽度 */}
      <div className="w-full lg:w-[420px] shrink-0 group relative rounded-2xl overflow-hidden aspect-video bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)]">
        {showImg ? (
          <img
            src={stillUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <EpisodePlaceholder seasonNumber={data.seasonNumber} episodeNumber={data.episodeNumber} />
        )}
        
        {/* 已观看角标 */}
        {data.watched && (
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-[var(--color-surface)]/90 backdrop-blur-sm text-[var(--color-watched)] px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider shadow-sm">
            <Check size={14} strokeWidth={3} />
            WATCHED
          </div>
        )}
      </div>

      {/* 右侧信息：优化行高与间距 */}
      <div className="flex flex-col flex-1 justify-center py-2">
        
        <div className="space-y-3 mb-5">
          <div className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <span className="text-[var(--color-accent)]">{data.show.title}</span>
            <span className="text-[var(--color-text-muted)]">/</span>
            <span className="text-[var(--color-text-muted)]">{seasonLabel} · Ep {data.episodeNumber}</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-[var(--color-text)] tracking-tight leading-tight">
            {title || `Episode ${data.episodeNumber}`}
          </h1>
        </div>

        {/* 元数据 */}
        <div className="flex items-center flex-wrap gap-3 text-sm text-[var(--color-text-muted)] font-medium mb-6">
          {data.airDate && <span>{new Date(data.airDate).getFullYear()}</span>}
          {data.runtime && <><Dot /><span>{data.runtime} min</span></>}
          {data.traktRating !== null && (
            <>
              <Dot />
              <span className="flex items-center gap-1 text-[var(--color-accent)] font-bold">
                <Star size={14} fill="currentColor" /> {data.traktRating}%
              </span>
            </>
          )}
        </div>

        {/* 简介 */}
        {overview && (
          <p className="text-[var(--color-text-secondary)] text-[15px] leading-relaxed mb-8">
            {overview}
          </p>
        )}

        {/* 底部操作按钮：使用主题的主色调 (Violet) */}
        <div className="flex items-center gap-4 mt-auto">
          <button
            onClick={onWatchClick}
            className="flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-light)] text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-sm shadow-[var(--color-accent-glow)]"
          >
            <Check size={18} strokeWidth={2.5} />
            标记为已观看
          </button>
          <button
            onClick={onHistoryClick}
            className="flex items-center justify-center w-12 h-[48px] rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Dot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border-base)] inline-block" />
}