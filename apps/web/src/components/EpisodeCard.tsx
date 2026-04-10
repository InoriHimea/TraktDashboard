/**
 * EpisodeCard — unified layout, strict info hierarchy, consistent image ratio.
 *
 * Layout:
 *   [16:9 still | 128px wide] [content: code · title · overview · meta]
 *
 * Info hierarchy:
 *   1. Episode code (S01E03) — muted, monospace
 *   2. Title — primary, bold, line-clamp-2
 *   3. Overview — secondary, line-clamp-2, hidden on small screens
 *   4. Meta row — runtime · air date · watch status
 *
 * States: watched / unwatched / unaired — each has distinct visual treatment.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, Eye, EyeOff, CalendarDays } from 'lucide-react'
import { resolveEpisodeTitle, resolveEpisodeOverview, fmtRuntime } from '../lib/i18n'
import { resolveEpisodeStill } from '../lib/image'
import { EpisodePlaceholder } from './ui/EpisodePlaceholder'
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.45), ease: [0.16, 1, 0.3, 1] }}
      whileHover={isUnaired ? {} : {
        y: -2,
        boxShadow: isWatched
          ? '0 8px 32px rgba(109,40,217,0.2)'
          : '0 8px 24px rgba(0,0,0,0.35)',
        transition: { duration: 0.15 },
      }}
      className={[
        // Base card
        'group relative rounded-2xl border overflow-hidden',
        'transition-colors duration-200',
        // State-based styling
        isUnaired
          ? 'opacity-40 border-white/5 bg-white/2 cursor-default'
          : isWatched
            ? 'border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-[#0d0d1a]/95 cursor-pointer'
            : 'border-white/8 bg-[#111120]/80 hover:bg-[#141428]/80 hover:border-white/14 cursor-pointer',
      ].join(' ')}
      tabIndex={isUnaired ? -1 : 0}
      role="article"
      aria-label={`${contextLabel} ${title}`}
    >
      {/* Watched shimmer overlay */}
      {isWatched && (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent pointer-events-none" />
      )}

      <div className="flex h-[88px]">

        {/* ── Still image — fixed 16:9 ratio, 128px wide ── */}
        <div className="relative shrink-0 w-[128px] h-full overflow-hidden bg-[#0d0d1a]">
          {showStill ? (
            <img
              src={stillUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <EpisodePlaceholder
              seasonNumber={seasonNumber}
              episodeNumber={episode.episodeNumber}
            />
          )}

          {/* Watched overlay */}
          {isWatched && (
            <div className="absolute inset-0 bg-violet-900/30 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-violet-500/85 flex items-center justify-center shadow-lg shadow-violet-900/60">
                <CheckCircle2 size={14} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
          )}

          {/* Unaired overlay */}
          {isUnaired && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-black/60 border border-white/12 text-white/45">
                未播出
              </span>
            </div>
          )}

          {/* Episode code — bottom-left badge */}
          <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[9px] font-mono text-white/45 leading-none">
            {contextLabel}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 flex flex-col justify-between px-3.5 py-2.5">

          {/* Top: title + overview */}
          <div className="flex flex-col gap-0.5 min-w-0">
            {/* Title — hierarchy level 1 */}
            <h4 className={[
              'text-[13px] font-semibold leading-snug line-clamp-2 transition-colors',
              isWatched
                ? 'text-white/55 group-hover:text-white/70'
                : 'text-white/88 group-hover:text-white',
            ].join(' ')}>
              {title}
            </h4>

            {/* Overview — hierarchy level 2, only if available */}
            {overview && (
              <p className="text-[11px] text-white/28 line-clamp-1 leading-relaxed hidden sm:block">
                {overview}
              </p>
            )}
          </div>

          {/* Bottom: meta row — hierarchy level 3 */}
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-2.5 text-[10px] text-white/28">
              {episode.runtime && (
                <span className="flex items-center gap-1">
                  <Clock size={9} />
                  {fmtRuntime(episode.runtime)}
                </span>
              )}
              {episode.airDate && !isUnaired && (
                <span className="flex items-center gap-1">
                  <CalendarDays size={9} />
                  {episode.airDate.slice(0, 10)}
                </span>
              )}
            </div>

            {/* Watch status badge */}
            {!isUnaired && (
              <span className={[
                'flex items-center gap-1 text-[10px] font-medium shrink-0',
                isWatched ? 'text-violet-400/80' : 'text-white/18',
              ].join(' ')}>
                {isWatched
                  ? <><Eye size={9} /> 已看</>
                  : <><EyeOff size={9} /> 未看</>
                }
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom accent line — watched episodes only */}
      {isWatched && (
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-violet-500/50 via-cyan-400/40 to-transparent" />
      )}
    </motion.article>
  )
}
