import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Bookmark, Star, ExternalLink, Tv2, CheckCircle2 } from 'lucide-react'
import { resolveTitle, resolveOverview, statusZh, statusColor, fmtDateZh } from '../lib/i18n'
import { resolveShowPoster, resolveBackdrop } from '../lib/image'
import { Button } from './ui/Button'
import { TraktProgressBar } from './TraktProgressBar'
import type { ShowProgress } from '@trakt-dashboard/types'

interface HeroSectionProps {
  progress: ShowProgress
  onWatchClick?: () => void
}

export function HeroSection({ progress, onWatchClick }: HeroSectionProps) {
  const { show, watchedEpisodes, airedEpisodes, lastWatchedAt, completed, percentage } = progress
  const [posterError, setPosterError] = useState(false)
  const [backdropError, setBackdropError] = useState(false)

  const backdropUrl = resolveBackdrop(show.backdropPath)
  const posterUrl   = resolveShowPoster(show.posterPath, 'w500')
  const { primary, secondary } = resolveTitle(show)
  const overview = resolveOverview(show)
  const sColor = statusColor(show.status)
  const sLabel = statusZh(show.status)
  const year = show.firstAired ? new Date(show.firstAired).getFullYear() : null
  const isAiring = show.status === 'returning series' || show.status === 'in production'

  return (
    <section className="relative w-full min-h-[88vh] flex flex-col justify-end overflow-hidden" aria-label="作品详情">

      {/* ── Backdrop ── */}
      <div className="absolute inset-0 z-0">
        {backdropUrl && !backdropError ? (
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover object-top"
            onError={() => setBackdropError(true)}
          />
        ) : (
          /* Fallback: abstract gradient when no backdrop */
          <div className="w-full h-full bg-gradient-to-br from-[#12102a] via-[#0d0d1a] to-[#0a1020]" />
        )}

        {/* Cinematic gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d1a] via-[#0d0d1a]/75 to-[#0d0d1a]/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d1a] via-[#0d0d1a]/30 to-transparent" />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_50%,rgba(0,0,0,0.5)_100%)]" />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 px-8 md:px-16 pb-16 pt-28 flex flex-col md:flex-row gap-10 items-end">

        {/* Poster */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 hidden md:block"
        >
          <div className="w-[190px] lg:w-[220px] aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.75)] ring-1 ring-white/10">
            {posterUrl && !posterError ? (
              <img
                src={posterUrl}
                alt={primary}
                className="w-full h-full object-cover"
                onError={() => setPosterError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-violet-950/60 to-[#0d0d1a] flex items-center justify-center">
                <Tv2 size={40} className="text-white/15" />
              </div>
            )}
          </div>
        </motion.div>

        {/* Info block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 min-w-0 flex flex-col gap-5"
        >
          {/* Genre tags */}
          {show.genres?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {show.genres.slice(0, 4).map(g => (
                <span key={g} className="text-xs font-medium px-3 py-1 rounded-full bg-white/6 border border-white/10 text-white/50 backdrop-blur-sm">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <div>
            <h1 className="text-5xl lg:text-6xl xl:text-[4.5rem] font-black text-white leading-[1.04] tracking-tight drop-shadow-2xl">
              {primary}
            </h1>
            {secondary && (
              <p className="text-base text-white/35 mt-2 font-light tracking-wide">{secondary}</p>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-2 text-sm">
            {year && <span className="text-white/55">{year}</span>}
            {show.totalEpisodes > 0 && (
              <><span className="text-white/20">·</span><span className="text-white/55">{show.totalEpisodes} 集</span></>
            )}
            {show.network && (
              <><span className="text-white/20">·</span><span className="text-white/55">{show.network}</span></>
            )}
            {/* Status badge */}
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ color: sColor, background: `${sColor}1a`, border: `1px solid ${sColor}35` }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isAiring ? 'animate-pulse' : ''}`}
                style={{ background: sColor }}
              />
              {sLabel}
            </span>
          </div>

          {/* Overview */}
          <p className="text-white/50 text-sm leading-relaxed max-w-[580px] line-clamp-3">
            {overview}
          </p>

          {/* Progress */}
          <div className="max-w-[460px]">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-white/35 flex items-center gap-1.5">
                {completed
                  ? <><CheckCircle2 size={11} className="text-emerald-400" /> 已看完全剧</>
                  : <>已观看 <span className="text-white/60 font-semibold">{watchedEpisodes}</span> / {airedEpisodes} 集</>
                }
              </span>
              <span className="text-violet-400 font-bold">{percentage}%</span>
            </div>
            <TraktProgressBar watched={watchedEpisodes} total={airedEpisodes} />
            <p className="text-[11px] text-white/25 mt-1.5">上次观看：{fmtDateZh(lastWatchedAt)}</p>
          </div>

          {/* CTA buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="primary"
              size="lg"
              icon={<Play size={16} fill="currentColor" />}
              onClick={onWatchClick}
              aria-label="继续观看"
            >
              继续观看
            </Button>

            <Button
              variant="secondary"
              size="lg"
              icon={<Bookmark size={15} />}
              aria-label="加入片单"
            >
              加入片单
            </Button>

            {/* External links — ghost buttons */}
            <div className="flex gap-1.5 ml-1">
              {show.tmdbId && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ExternalLink size={10} />}
                  onClick={() => window.open(`https://www.themoviedb.org/tv/${show.tmdbId}`, '_blank')}
                  aria-label="在 TMDB 查看"
                >
                  TMDB
                </Button>
              )}
              {show.imdbId && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ExternalLink size={10} />}
                  onClick={() => window.open(`https://www.imdb.com/title/${show.imdbId}`, '_blank')}
                  aria-label="在 IMDb 查看"
                >
                  IMDb
                </Button>
              )}
              {show.traktSlug && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ExternalLink size={10} />}
                  onClick={() => window.open(`https://trakt.tv/shows/${show.traktSlug}`, '_blank')}
                  aria-label="在 Trakt 查看"
                >
                  Trakt
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right sidebar — score + stats */}
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="hidden xl:flex flex-col gap-3 shrink-0 w-[172px]"
          aria-label="作品评分与统计"
        >
          {/* Score card */}
          <div className="rounded-2xl bg-white/5 border border-white/8 backdrop-blur-xl p-4 flex flex-col items-center gap-2">
            <Star size={16} className="text-amber-400" fill="currentColor" />
            <span className="text-2xl font-black text-white">—</span>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Trakt 评分</span>
          </div>

          {/* Stats card */}
          <div className="rounded-2xl bg-white/5 border border-white/8 backdrop-blur-xl p-4 flex flex-col gap-3">
            <StatItem label="季数" value={`${show.totalSeasons} 季`} />
            <div className="h-px bg-white/6" />
            <StatItem label="总集数" value={`${show.totalEpisodes} 集`} />
            {show.firstAired && (
              <>
                <div className="h-px bg-white/6" />
                <StatItem label="首播" value={show.firstAired.slice(0, 4)} />
              </>
            )}
          </div>
        </motion.aside>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#0d0d1a] to-transparent z-10 pointer-events-none" />
    </section>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-white/25 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-bold text-white/75">{value}</span>
    </div>
  )
}
