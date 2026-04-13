import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useEpisodeDetail } from '../hooks'
import { EpisodeInfoCard } from '../components/EpisodeInfoCard'
import { EpisodeSeasonStrip } from '../components/EpisodeSeasonStrip'
import { WatchActionPanel } from '../components/WatchActionPanel'
import { WatchHistoryPanel } from '../components/WatchHistoryPanel'
import { Button } from '../components/ui/Button'
import { resolveEpisodeStill } from '../lib/image'

interface RouteParams {
  showId: string
  season: string
  episode: string
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EpisodeDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] w-full">
      {/* 修复：增加 mx-auto 居中，加大 px-10 py-12 内边距 */}
      <div className="w-full max-w-[1200px] mx-auto px-10 py-12">
        <div className="animate-pulse space-y-10">
          <div className="w-24 h-8 rounded-lg bg-white/[0.05]" />
          
          <div className="flex flex-col md:flex-row gap-10 bg-[var(--color-surface)] p-10 rounded-3xl border border-[var(--color-border)]">
            <div className="w-[420px] shrink-0 aspect-video rounded-2xl bg-white/[0.05]" />
            <div className="flex-1 space-y-6 py-4">
              <div className="h-6 w-48 rounded-md bg-white/[0.05]" />
              <div className="h-12 w-full max-w-md rounded-md bg-white/[0.08]" />
              <div className="h-5 w-72 rounded-full bg-white/[0.04]" />
              <div className="h-20 w-full rounded-lg bg-white/[0.03]" />
              <div className="flex gap-4 pt-4">
                <div className="h-12 w-40 rounded-lg bg-white/[0.07]" />
                <div className="h-12 w-12 rounded-lg bg-white/[0.05]" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="h-8 w-48 rounded-md bg-white/[0.05]" />
            <div className="w-full bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 flex gap-4 overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-[220px] shrink-0 aspect-video rounded-xl bg-white/[0.03]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────

function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)] flex items-center justify-center py-20">
      <div className="text-center flex flex-col items-center gap-6 p-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-500/15 flex items-center justify-center">
          <span className="text-2xl text-red-500">⚠</span>
        </div>
        <p className="text-[var(--color-text-muted)] text-base">剧集信息加载失败</p>
        <Button variant="secondary" size="lg" icon={<RefreshCw size={15} />} onClick={onRetry}>
          重新加载
        </Button>
      </div>
    </div>
  )
}

// ─── EpisodeDetailPage ────────────────────────────────────────────────────────

export default function EpisodeDetailPage() {
  const { showId, season, episode } = useParams<RouteParams>()
  const navigate = useNavigate()
  // ... (参数校验逻辑不变) ...
  const showIdNum = Number(showId); const seasonNum = Number(season); const episodeNum = Number(episode);
  if (!showId || !season || !episode || !Number.isInteger(showIdNum) || !Number.isInteger(seasonNum) || !Number.isInteger(episodeNum) || showIdNum <= 0 || seasonNum < 0 || episodeNum <= 0) {
    return <Navigate to="/progress" replace />
  }

  const { data, isLoading, error, refetch } = useEpisodeDetail(showIdNum, seasonNum, episodeNum)
  const [watchPanelOpen, setWatchPanelOpen] = useState(false)
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)

  if (isLoading) return <EpisodeDetailSkeleton />
  if (error) return <PageError onRetry={() => refetch()} />
  if (!data) return <div className="w-full min-h-screen flex items-center justify-center">未找到该集</div>

  // 提取背景图
  const bgImageUrl = resolveEpisodeStill(data.stillPath)

  return (
    // 强制满宽，相对定位用于放置背景
    <main className="relative flex flex-col flex-1 w-full min-h-[calc(100vh-64px)] overflow-hidden bg-[var(--color-bg)]">
      
      {/* 沉浸式模糊背景 (Cinematic Background) */}
      {bgImageUrl && (
        <>
          <div 
            className="absolute inset-0 z-0 opacity-15 saturate-150 scale-110"
            style={{ backgroundImage: `url(${bgImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(80px)' }}
          />
          {/* 渐变遮罩，保证文字可读性 */}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent to-[var(--color-bg)] opacity-80" />
        </>
      )}

      {/* 核心内容区：绝对居中，增加超大留白 */}
      <div className="relative z-10 w-full flex-1 flex flex-col items-center px-6 sm:px-10 py-12">
        <div className="w-full max-w-[1100px] flex flex-col gap-10">
          
          {/* 返回按钮 (更精致的药丸样式) */}
          <div className="self-start">
            <button
              onClick={() => navigate(-1)}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-surface)]/60 backdrop-blur-md border border-[var(--color-border)] shadow-sm text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-all duration-300"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              返回进度
            </button>
          </div>

          <article>
            <EpisodeInfoCard data={data} onWatchClick={() => setWatchPanelOpen(true)} onHistoryClick={() => setHistoryPanelOpen(true)} />
          </article>

          <section className="pt-8">
            <EpisodeSeasonStrip episodes={data.seasonEpisodes} seasonNumber={data.seasonNumber} currentEpisodeNumber={data.episodeNumber} showId={data.showId} />
          </section>

        </div>
      </div>

      {/* Panels ... */}
      <WatchActionPanel open={watchPanelOpen} onClose={() => setWatchPanelOpen(false)} episodeId={data.episodeId} showId={data.showId} seasonNumber={data.seasonNumber} episodeNumber={data.episodeNumber} airDate={data.airDate} onSuccess={() => refetch()} />
      <WatchHistoryPanel open={historyPanelOpen} onClose={() => setHistoryPanelOpen(false)} showId={data.showId} seasonNumber={data.seasonNumber} episodeNumber={data.episodeNumber} onDeleted={() => refetch()} />
    </main>
  )
}