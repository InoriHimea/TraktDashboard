import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useEpisodeDetail } from '../hooks'
import { EpisodeInfoCard } from '../components/EpisodeInfoCard'
import { EpisodeSeasonStrip } from '../components/EpisodeSeasonStrip'
import { WatchActionPanel } from '../components/WatchActionPanel'
import { WatchHistoryPanel } from '../components/WatchHistoryPanel'
import { Button } from '../components/ui/Button'

interface RouteParams { showId: string; season: string; episode: string }

function EpisodeDetailSkeleton() {
  return (
    <div className="flex-1 w-full bg-[var(--color-bg)]">
      <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-12 py-10 space-y-10">
        <div className="w-24 h-6 rounded bg-[var(--color-surface-3)] animate-pulse" />
        <div className="w-full h-[400px] rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
      </div>
    </div>
  )
}

function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex-1 w-full bg-[var(--color-bg)] flex items-center justify-center">
      <div className="text-center flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--color-error)]/10 text-[var(--color-error)] flex items-center justify-center">
          ⚠
        </div>
        <p className="text-[var(--color-text-muted)]">加载失败</p>
        <Button variant="secondary" size="md" icon={<RefreshCw size={14} />} onClick={onRetry}>
          重试
        </Button>
      </div>
    </div>
  )
}

export default function EpisodeDetailPage() {
  const { showId, season, episode } = useParams<RouteParams>()
  const navigate = useNavigate()

  const showIdNum = Number(showId); const seasonNum = Number(season); const episodeNum = Number(episode);
  if (!showId || !season || !episode || !Number.isInteger(showIdNum) || !Number.isInteger(seasonNum) || !Number.isInteger(episodeNum) || showIdNum <= 0 || seasonNum < 0 || episodeNum <= 0) {
    return <Navigate to="/progress" replace />
  }

  const { data, isLoading, error, refetch } = useEpisodeDetail(showIdNum, seasonNum, episodeNum)
  const [watchPanelOpen, setWatchPanelOpen] = useState(false)
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)

  if (isLoading) return <EpisodeDetailSkeleton />
  if (error) return <PageError onRetry={() => refetch()} />
  if (!data) return <div className="flex-1 w-full flex items-center justify-center text-[var(--color-text-muted)]">未找到该集</div>

  return (
    <main className="flex-1 w-full bg-[var(--color-bg)] flex flex-col items-center">
      
      {/* 核心容器：最大宽度 1200px，左右留出 lg:px-12 的宽裕边距 */}
      <div className="w-full max-w-[1200px] px-6 sm:px-8 lg:px-12 py-10 lg:py-12 flex flex-col gap-8">
        
        {/* 返回按钮：简洁的文字链接样式 */}
        <div className="self-start">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            返回进度
          </button>
        </div>

        <article>
          <EpisodeInfoCard 
            data={data} 
            onWatchClick={() => setWatchPanelOpen(true)} 
            onHistoryClick={() => setHistoryPanelOpen(true)} 
          />
        </article>

        <section className="pt-6">
          <EpisodeSeasonStrip 
            episodes={data.seasonEpisodes} 
            seasonNumber={data.seasonNumber} 
            currentEpisodeNumber={data.episodeNumber} 
            showId={data.showId} 
          />
        </section>

      </div>

      {/* Panels */}
      <WatchActionPanel open={watchPanelOpen} onClose={() => setWatchPanelOpen(false)} episodeId={data.episodeId} showId={data.showId} seasonNumber={data.seasonNumber} episodeNumber={data.episodeNumber} airDate={data.airDate} onSuccess={() => refetch()} />
      <WatchHistoryPanel open={historyPanelOpen} onClose={() => setHistoryPanelOpen(false)} showId={data.showId} seasonNumber={data.seasonNumber} episodeNumber={data.episodeNumber} onDeleted={() => refetch()} />
    </main>
  )
}