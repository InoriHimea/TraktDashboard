/**
 * EpisodeCard — redesigned for scannability and visual consistency.
 *
 * Layout: [16:9 still | 160px wide] [content: code · title · overview · meta]
 * Card height: ~116px — enough room for 2-line title + 1-line overview + meta
 *
 * Info hierarchy:
 *   1. Title — primary, bold, line-clamp-2
 *   2. Overview — secondary, line-clamp-2, muted
 *   3. Meta row — episode code · runtime · watch status
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, Eye, EyeOff } from 'lucide-react'
import { resolveEpisodeTitle, resolveEpisodeOverview, fmtRuntime } from '../lib/i18n'
import { resolveEpisodeStill } from '../lib/image'
import { EpisodePlaceholder } from './ui/EpisodePlaceholder'
import { ProgressBarWidget } from './ProgressBarWidget'
import type { EpisodeProgress } from '@trakt-dashboard/types'

interface EpisodeCardProps {
  episode: EpisodeProgress
  index: number
  seasonNumber: number
}

export function EpisodeCard({ episode, index, seasonNumber }: EpisodeCardProps) {
  const [imgError, setImgError] = useState(false)

  const contextLabel = `S${String(seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`
  const title    = resolveEpisodeTitle(episode)
  const overview = resolveEpisodeOverview(episode)
  const stillUrl = resolveEpisodeStill(episode.stillPath)
  const isWatched = episode.watched
  const isUnaired = episode.aired === false
  const showStill = stillUrl && !imgError

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.025, 0.4), ease: [0.16, 1, 0.3, 1] }}
      className={[
        'group relative rounded-xl border overflow-hidden',
        'transition-all duration-200',
        isUnaired
          ? 'opacity-35 border-white/[0.05] bg-white/[0.02] cursor-default'
          : isWatched
            ? 'border-violet-500/20 bg-violet-950/20 hover:bg-violet-950/30 hover:border-violet-500/30 cursor-pointer'
            : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] cursor-pointer',
        !isUnaired && 'hover:-translate-y-px hover:shadow-[0_6px_24px_rgba(0,0,0,0.3)]',
      ].join(' ')}
      tabIndex={isUnaired ? -1 : 0}
      role="article"
      aria-label={`${contextLabel} ${title}`}
    >
      <div className="flex" style={{ height: '116px' }}>

        {/* ── Still image — 16:9, fixed 160px wide ── */}
        <div className="relative shrink-0 overflow-hidden bg-[#0d0d1a]" style={{ width: '160px' }}>
          {showStill ? (
            <img
              src={stillUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <EpisodePlaceholder seasonNumber={seasonNumber} episodeNumber={episode.episodeNumber} />
          )}

          {/* Watched overlay */}
          {isWatched && (
            <div className="absolute inset-0 bg-violet-900/25 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-violet-500/80 flex items-center justify-center shadow-lg shadow-violet-900/50">
                <CheckCircle2 size={15} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
          )}

          {/* Unaired label */}
          {isUnaired && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-white/40">
                未播出
              </span>
            </div>
          )}

          {/* Episode code badge */}
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono text-white/40 leading-none">
            {contextLabel}
          </div>

          {/* Progress widget — 仅对已看且有时长的集数显示 */}
          {isWatched && episode.runtime && (
            <div className="absolute bottom-1.5 right-1.5">
              <ProgressBarWidget
                watchedMinutes={episode.runtime}
                totalMinutes={episode.runtime}
                size="xs"
              />
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 flex flex-col justify-between px-4 py-3">

          {/* Title + overview */}
          <div className="flex flex-col gap-1 min-w-0">
            <h4 className={[
              'text-[13px] font-semibold leading-snug line-clamp-2 transition-colors',
              isWatched
                ? 'text-white/50 group-hover:text-white/65'
                : 'text-white/85 group-hover:text-white',
            ].join(' ')}>
              {title}
            </h4>

            {overview && (
              <p className="text-[11px] text-white/25 line-clamp-2 leading-relaxed">
                {overview}
              </p>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] text-white/25">
              {episode.runtime && (
                <span className="flex items-center gap-1">
                  <Clock size={9} />
                  {fmtRuntime(episode.runtime)}
                </span>
              )}
            </div>

            {!isUnaired && (
              <span className={[
                'flex items-center gap-1 text-[10px] font-medium shrink-0',
                isWatched ? 'text-violet-400/70' : 'text-white/18',
              ].join(' ')}>
                {isWatched ? <><Eye size={9} /> 已看</> : <><EyeOff size={9} /> 未看</>}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Watched accent line */}
      {isWatched && (
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-violet-500/40 via-cyan-400/30 to-transparent" />
      )}
    </motion.article>
  )
}
