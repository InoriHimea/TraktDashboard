import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Layers, RefreshCw } from 'lucide-react'
import { useShowDetail } from '../hooks'
import { HeroSection } from '../components/HeroSection'
import { SeasonTab } from '../components/SeasonTab'
import { EpisodeGrid } from '../components/EpisodeGrid'
import { Button } from '../components/ui/Button'
import { resolveTitle } from '../lib/i18n'
import { statusZh, statusColor } from '../lib/i18n'
import type { Show } from '@trakt-dashboard/types'

// Re-export for any external consumers
export { resolveTitle }

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      {/* Hero skeleton */}
      <div className="relative h-[88vh] bg-gradient-to-b from-white/4 to-transparent animate-pulse">
        <div className="absolute bottom-16 left-16 flex gap-10 items-end">
          <div className="w-[220px] aspect-[2/3] rounded-2xl bg-white/6" />
          <div className="flex flex-col gap-4 pb-2">
            <div className="h-3 w-32 rounded-full bg-white/6" />
            <div className="h-14 w-96 rounded-xl bg-white/8" />
            <div className="h-3 w-64 rounded-full bg-white/5" />
            <div className="h-3 w-80 rounded-full bg-white/4" />
            <div className="h-3 w-72 rounded-full bg-white/4" />
            <div className="flex gap-3 mt-2">
              <div className="h-12 w-36 rounded-xl bg-white/8" />
              <div className="h-12 w-28 rounded-xl bg-white/5" />
            </div>
          </div>
        </div>
      </div>
      {/* Episodes skeleton */}
      <div className="px-16 py-10">
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-2xl bg-white/4 animate-pulse" style={{ animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
      <div className="text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-950/50 border border-red-500/20 flex items-center justify-center">
          <span className="text-2xl">⚠</span>
        </div>
        <p className="text-white/50 text-base">加载失败，请重试</p>
        <Button variant="secondary" size="md" icon={<RefreshCw size={14} />} onClick={onRetry}>
          重新加载
        </Button>
      </div>
    </div>
  )
}

// ─── ShowDetailPage ───────────────────────────────────────────────────────────

export default function ShowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: progress, isLoading, error, refetch } = useShowDetail(Number(id))
  const [activeSeason, setActiveSeason] = useState<number | null>(null)
  const episodesRef = useRef<HTMLDivElement>(null)

  if (isLoading) return <PageSkeleton />
  if (error)     return <PageError onRetry={() => refetch()} />

  if (!progress) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-3">
          <p className="text-white/30 text-lg">未找到该剧集</p>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate(-1)}>
            返回
          </Button>
        </div>
      </div>
    )
  }

  const { seasons, show } = progress
  const currentSeasonNumber = activeSeason ?? seasons[0]?.seasonNumber ?? 1
  const currentSeason = seasons.find(s => s.seasonNumber === currentSeasonNumber) ?? seasons[0]

  function scrollToEpisodes() {
    episodesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white">

      {/* ── Floating back button ── */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="fixed top-[72px] left-5 z-50"
      >
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate(-1)}
          className="bg-black/50 border-white/10 backdrop-blur-xl shadow-xl"
          aria-label="返回上一页"
        >
          返回
        </Button>
      </motion.div>

      {/* ── Hero ── */}
      <HeroSection progress={progress} onWatchClick={scrollToEpisodes} />

      {/* ── Body ── */}
      <div className="relative z-10 bg-[#0d0d1a]">
        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/15 to-transparent" />

        <div className="max-w-[1600px] mx-auto px-8 md:px-16 py-12">
          <div className="flex gap-10 items-start">

            {/* ── Episodes column ── */}
            <div className="flex-1 min-w-0" ref={episodesRef}>

              {/* Section header */}
              <div className="flex items-center gap-3 mb-7">
                <Layers size={15} className="text-violet-400 shrink-0" />
                <h2 className="text-base font-bold text-white/80 tracking-tight">剧集列表</h2>
                <div className="flex-1 h-px bg-white/6" />
                {currentSeason && (
                  <span className="text-xs text-white/30">
                    第 {currentSeasonNumber} 季 · {currentSeason.episodes.length} 集
                  </span>
                )}
              </div>

              {/* Season tabs — only show if multiple seasons */}
              {seasons.length > 1 && (
                <div
                  className="flex gap-2 mb-7 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: 'none' }}
                  role="tablist"
                  aria-label="选择季度"
                >
                  {seasons.map(s => (
                    <SeasonTab
                      key={s.seasonNumber}
                      season={s}
                      showPosterPath={show.posterPath}
                      isActive={s.seasonNumber === currentSeasonNumber}
                      onClick={() => setActiveSeason(s.seasonNumber)}
                    />
                  ))}
                </div>
              )}

              {/* Episode grid */}
              <AnimatePresence mode="wait">
                {currentSeason ? (
                  <EpisodeGrid
                    key={currentSeasonNumber}
                    episodes={currentSeason.episodes}
                    seasonNumber={currentSeasonNumber}
                  />
                ) : (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-white/30 text-sm py-8 text-center"
                  >
                    暂无剧集数据
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* ── Sidebar ── */}
            <motion.aside
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.25 }}
              className="hidden lg:flex flex-col gap-4 w-[248px] shrink-0 sticky top-24"
              aria-label="作品信息"
            >
              {/* Info card */}
              <SideCard title="作品信息">
                <InfoRow label="状态">
                  <StatusBadge status={show.status} />
                </InfoRow>
                {show.network    && <InfoRow label="播出平台">{show.network}</InfoRow>}
                {show.firstAired && <InfoRow label="首播日期">{show.firstAired.slice(0, 10)}</InfoRow>}
                <InfoRow label="总季数">{show.totalSeasons} 季</InfoRow>
                <InfoRow label="总集数">{show.totalEpisodes} 集</InfoRow>
                {show.genres?.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-[10px] text-white/25 uppercase tracking-wider">类型</span>
                    <div className="flex flex-wrap gap-1.5">
                      {show.genres.slice(0, 5).map(g => (
                        <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 border border-white/8 text-white/45">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </SideCard>

              {/* Progress card */}
              <SideCard title="观看进度">
                <div className="flex items-end justify-between mb-3">
                  <span className="text-3xl font-black text-white">{progress.percentage}%</span>
                  <span className="text-xs text-white/30 mb-1">
                    {progress.watchedEpisodes} / {progress.airedEpisodes}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden mb-4">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percentage}%` }}
                    transition={{ duration: 1.1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>

                {/* Per-season mini bars */}
                {seasons.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {seasons.map(s => {
                      const pct = s.airedCount > 0 ? Math.round((s.watchedCount / s.airedCount) * 100) : 0
                      return (
                        <button
                          key={s.seasonNumber}
                          onClick={() => { setActiveSeason(s.seasonNumber); scrollToEpisodes() }}
                          className="flex items-center gap-2 group/bar hover:opacity-80 transition-opacity text-left"
                        >
                          <span className="text-[10px] text-white/25 w-9 shrink-0 group-hover/bar:text-white/45 transition-colors">
                            第{s.seasonNumber}季
                          </span>
                          <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-400/70' : 'bg-violet-500/60'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-white/25 w-7 text-right">{pct}%</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </SideCard>
            </motion.aside>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-xl p-5 flex flex-col gap-3.5">
      <h3 className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-white/30 shrink-0">{label}</span>
      <span className="text-xs text-white/65 text-right">{children}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: Show['status'] }) {
  const color = statusColor(status)
  const label = statusZh(status)
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
