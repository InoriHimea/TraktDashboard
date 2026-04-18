import { Check, Star, History } from 'lucide-react'
import type { EpisodeDetailData } from '@trakt-dashboard/types'

interface EpisodeInfoCardProps {
  data: EpisodeDetailData
  onWatchClick: () => void
  onHistoryClick: () => void
}

export function EpisodeInfoCard({ data, onWatchClick, onHistoryClick }: EpisodeInfoCardProps) {
  const overview = data.translatedOverview ?? data.overview
  const seasonLabel = data.seasonNumber === 0 ? 'Specials' : `Season ${data.seasonNumber}`
  const episodeTitle = data.translatedTitle ?? data.title

  return (
    <div className="space-y-5">

      {/* Breadcrumb: Show name · Season X · Episode Y */}
      <nav className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
        <span>{data.show.title}</span>
        <span>·</span>
        <span>{seasonLabel}</span>
        <span>·</span>
        <span>Episode {data.episodeNumber}</span>
      </nav>

      {/* Episode title — large headline */}
      {episodeTitle && (
        <h1 className="text-white font-bold tracking-tight leading-tight"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
          {episodeTitle}
        </h1>
      )}

      {/* Metadata badges */}
      <div className="flex flex-wrap items-center gap-3">
        {data.airDate && (
          <MetaBadge label={new Date(data.airDate).getFullYear().toString()} />
        )}
        {data.runtime && (
          <MetaBadge label={`${data.runtime} 分钟`} />
        )}
        {data.show.genres?.[0] && (
          <MetaBadge label={data.show.genres[0].toUpperCase()} />
        )}
        {data.traktRating !== null && (
          <RatingBadge rating={data.traktRating} />
        )}
      </div>

      {/* External link pills */}
      <div className="flex flex-wrap gap-2">
        {data.show.traktSlug && (
          <ExternalPill
            href={`https://trakt.tv/shows/${data.show.traktSlug}/seasons/${data.seasonNumber}/episodes/${data.episodeNumber}`}
            label="TRAKT"
          />
        )}
        {data.show.tmdbId && (
          <ExternalPill
            href={`https://www.themoviedb.org/tv/${data.show.tmdbId}/season/${data.seasonNumber}/episode/${data.episodeNumber}`}
            label="TMDB"
          />
        )}
        {data.show.imdbId && (
          <ExternalPill
            href={`https://www.imdb.com/title/${data.show.imdbId}/`}
            label="IMDB"
          />
        )}
        {data.show.tvdbId && (
          <ExternalPill
            href={`https://thetvdb.com/?tab=series&id=${data.show.tvdbId}`}
            label="TVDB"
          />
        )}
      </div>

      {/* Overview */}
      {overview && (
        <p className="text-zinc-300 text-sm leading-relaxed max-w-xl">{overview}</p>
      )}

      {/* Action buttons — conditional on watch status */}
      {data.watched ? (
        <WatchedActions onWatchClick={onWatchClick} onHistoryClick={onHistoryClick} />
      ) : (
        <UnwatchedActions onWatchClick={onWatchClick} onHistoryClick={onHistoryClick} />
      )}
    </div>
  )
}

function MetaBadge({ label }: { label: string }) {
  return (
    <span className="bg-white/10 px-3 py-1 rounded-lg text-xs font-medium text-white/80 backdrop-blur-sm">
      {label}
    </span>
  )
}

function RatingBadge({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-[#6da7ff]/20 px-3 py-1 rounded-lg">
      <Star className="size-3.5 text-[#87b4ff] fill-[#87b4ff]" />
      <span className="text-[#87b4ff] text-xs font-bold">{rating}%</span>
    </div>
  )
}

function ExternalPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white/5 hover:bg-white/10 transition-all px-4 py-1.5 rounded-full border border-white/5 text-[10px] font-bold tracking-widest uppercase text-white/60 cursor-pointer"
    >
      {label}
    </a>
  )
}

// Watched state: 3 buttons
function WatchedActions({ onWatchClick, onHistoryClick }: { onWatchClick: () => void; onHistoryClick: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 pt-4">
      {/* Done-all indicator — purple, icon only */}
      <button
        className="bg-purple-600 h-14 w-48 rounded-xl flex items-center justify-center shadow-md active:scale-[0.98] transition-all hover:bg-purple-700 cursor-pointer shrink-0"
        aria-label="已观看"
        tabIndex={-1}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 12 5 16 13 8" />
          <polyline points="9 12 13 16 21 8" />
        </svg>
      </button>

      {/* Watch again — teal */}
      <button
        onClick={onWatchClick}
        className="bg-teal-700 h-14 w-48 rounded-xl flex items-center justify-center gap-3 shadow-md active:scale-[0.98] transition-all hover:bg-teal-800 cursor-pointer shrink-0"
      >
        <Check className="text-white" strokeWidth={2.5} />
        <span className="text-white font-bold tracking-wide whitespace-nowrap">再看一次</span>
      </button>

      {/* History — slate */}
      <button
        onClick={onHistoryClick}
        className="bg-slate-700 h-14 w-48 rounded-xl flex items-center justify-center gap-3 shadow-md active:scale-[0.98] transition-all hover:bg-slate-800 cursor-pointer shrink-0"
      >
        <History className="text-white" />
        <span className="text-white font-bold tracking-wide">历史记录</span>
      </button>
    </div>
  )
}

// Unwatched state: 2 buttons
function UnwatchedActions({ onWatchClick, onHistoryClick }: { onWatchClick: () => void; onHistoryClick: () => void }) {
  return (
    <div className="flex items-center gap-4 pt-4">
      {/* Mark as watched — light purple */}
      <button
        onClick={onWatchClick}
        className="bg-[#F3E8FF] hover:bg-[#E9D5FF] w-40 py-3.5 flex items-center justify-center gap-2.5 shadow-lg active:scale-[0.98] transition-all border border-[#D8B4FE] rounded-xl cursor-pointer"
      >
        <Check className="text-[#9333EA]" strokeWidth={2.5} />
        <span className="text-[#9333EA] font-bold tracking-wide whitespace-nowrap">标记已看</span>
      </button>

      {/* History — zinc */}
      <button
        onClick={onHistoryClick}
        className="bg-zinc-800/80 hover:bg-zinc-800 w-40 py-3.5 flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all border border-white/10 rounded-xl cursor-pointer"
      >
        <History className="text-zinc-300" />
        <span className="text-zinc-200 font-bold tracking-wide">历史记录</span>
      </button>
    </div>
  )
}
