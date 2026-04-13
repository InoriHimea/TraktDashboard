import { useState } from 'react'
import { Check, MoreVertical, Play, Star } from 'lucide-react'
import { EpisodePlaceholder } from './ui/EpisodePlaceholder'
import { resolveEpisodeStill } from '../lib/image'
import type { EpisodeDetailData } from '@trakt-dashboard/types'

interface EpisodeInfoCardProps {
  data: EpisodeDetailData; onWatchClick: () => void; onHistoryClick: () => void
}

export function EpisodeInfoCard({ data, onWatchClick, onHistoryClick }: EpisodeInfoCardProps) {
  const [imgError, setImgError] = useState(false)
  const title = data.translatedTitle ?? data.title
  const overview = data.translatedOverview ?? data.overview
  const stillUrl = resolveEpisodeStill(data.stillPath)
  const showImg = stillUrl && !imgError
  const seasonLabel = data.seasonNumber === 0 ? 'Specials' : `Season ${data.seasonNumber}`

  return (
    // 现代毛玻璃卡片设计
    <div className="flex flex-col md:flex-row gap-8 md:gap-10 p-6 md:p-8 rounded-[2rem] bg-[var(--color-surface)]/60 backdrop-blur-2xl border border-[var(--color-border)]/50 shadow-2xl shadow-black/5">
      
      {/* 左侧海报：取消强制宽度，使用更优美的比例 */}
      <div className="w-full md:w-[420px] shrink-0 group relative rounded-2xl overflow-hidden aspect-video bg-[var(--color-surface-2)] border border-[var(--color-border)]/50">
        {showImg ? (
          <img src={stillUrl} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onError={() => setImgError(true)} />
        ) : (
          <EpisodePlaceholder seasonNumber={data.seasonNumber} episodeNumber={data.episodeNumber} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        
        {data.watched && (
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider border border-white/10">
            <Check size={14} className="text-green-400" /> WATCHED
          </div>
        )}
      </div>

      {/* 右侧信息：放大标题，优化间距 */}
      <div className="flex flex-col justify-center flex-1 gap-5">
        <div className="space-y-2">
          <div className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <span className="text-[var(--color-text)] bg-[var(--color-surface-3)] px-2.5 py-1 rounded-md">{data.show.title}</span>
            <span className="text-[var(--color-text-muted)]">{seasonLabel} · Ep {data.episodeNumber}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text)] tracking-tight leading-tight">
            {title || `Episode ${data.episodeNumber}`}
          </h1>
        </div>

        {/* 元数据使用更清晰的排列 */}
        <div className="flex items-center flex-wrap gap-4 text-sm text-[var(--color-text-muted)] font-medium">
          {data.airDate && <span className="flex items-center gap-1.5">{new Date(data.airDate).getFullYear()}</span>}
          {data.runtime && <><Dot/> <span>{data.runtime} min</span></>}
          {data.traktRating && (
            <><Dot/> 
            <span className="flex items-center gap-1 text-[var(--color-accent)] font-bold">
              <Star size={14} fill="currentColor" /> {data.traktRating}%
            </span></>
          )}
        </div>

        {overview && (
          <p className="text-[var(--color-text-muted)] text-sm md:text-base leading-relaxed line-clamp-3 md:line-clamp-none">
            {overview}
          </p>
        )}

        {/* 操作按钮：更饱满、有点击感 */}
        <div className="flex items-center gap-3 pt-2 mt-auto">
          <button onClick={onWatchClick} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[var(--color-text)] hover:bg-[var(--color-text)]/90 text-[var(--color-bg)] px-8 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg">
            <Play size={18} fill="currentColor" /> 标记已看
          </button>
          <button onClick={onHistoryClick} className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-all active:scale-[0.98]">
            <MoreVertical size={18} className="text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Dot() { return <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] opacity-50" /> }