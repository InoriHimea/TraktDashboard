import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useEpisodeDetail } from '../hooks'
import { EpisodeInfoCard } from '../components/EpisodeInfoCard'
import { EpisodeSeasonStrip } from '../components/EpisodeSeasonStrip'
import { WatchActionPanel } from '../components/WatchActionPanel'
import { WatchHistoryPanel } from '../components/WatchHistoryPanel'
import { Button } from '../components/ui/Button'

function EpisodeDetailSkeleton() {
  return (
    <div className="flex-1 w-full bg-[var(--color-bg)]">
      <div className="w-full max-w-[1100px] mx-auto px-6 lg:px-10 py-10 space-y-6 animate-pulse">
        <div className="w-20 h-5 rounded bg-[var(--color-surface-3)]" />
        <div className="w-full h-[280px] rounded-2xl bg-[var(--color-surface)]" />
        <div className="w-full h-[220px] rounded-2xl bg-[var(--color-surface)]" />
      </div>
    </div>
  )
}

function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex-1 w-full flex items-center justify-center">
      <div className="text-center flex flex-col items-center gap-4">
        <p className="text-[var(--color-text-muted)] text-sm">加载失败</p>
        <Button variant="secondary" size="md" icon={<RefreshCw size={14} />} onClick={onRetry}>重试</Button>
      </div>
    </div>
  )
}

export default function EpisodeDetailPage() {
  const { showId, season, episode } = useParams()
  const navigate = useNavigate()

  const showIdNum = Number(showId)
  const seasonNum = Number(season)
  const episodeNum = Number(episode)

  if (
    !showId || !season || !episode ||
    !Number.isInteger(showIdNum) || !Number.isInteger(seasonNum) || !Number.isInteger(episodeNum) ||
    showIdNum <= 0 || seasonNum < 0 || episodeNum <= 0
  ) {
    return <Navigate to="/progress" replace />
  }

  const { data, isLoading, error, refetch } = useEpisodeDetail(showIdNum, seasonNum, episodeNum)
  const [watchPanelOpen, setWatchPanelOpen] = useState(false)
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)

  if (isLoading) return <EpisodeDetailSkeleton />
  if (error) return <PageError onRetry={() => refetch()} />
  if (!data) return (
    <div className="flex-1 w-full flex items-center justify-center text-[var(--color-text-muted)] text-sm">
      未找到该集
    </div>
  )

  return (
    <main className="flex-1 w-full bg-[var(--color-bg)]">
      <div className="w-full max-w-[1100px] mx-auto px-6 lg:px-10 py-8 flex flex-col gap-5">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="self-start flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          返回
        </button>

        {/* Info card */}
        <article>
          <EpisodeInfoCard
            data={data}
            onWatchClick={() => setWatchPanelOpen(true)}
            onHistoryClick={() => setHistoryPanelOpen(true)}
          />
        </article>

        {/* Season strip */}
        <section>
          <EpisodeSeasonStrip
            episodes={data.seasonEpisodes}
            seasonNumber={data.seasonNumber}
            currentEpisodeNumber={data.episodeNumber}
            showId={data.showId}
          />
        </section>

      </div>

      <WatchActionPanel
        open={watchPanelOpen}
        onClose={() => setWatchPanelOpen(false)}
        episodeId={data.episodeId}
        showId={data.showId}
        seasonNumber={data.seasonNumber}
        episodeNumber={data.episodeNumber}
        airDate={data.airDate}
        onSuccess={() => refetch()}
      />
      <WatchHistoryPanel
        open={historyPanelOpen}
        onClose={() => setHistoryPanelOpen(false)}
        showId={data.showId}
        seasonNumber={data.seasonNumber}
        episodeNumber={data.episodeNumber}
        onDeleted={() => refetch()}
      />
    </main>
  )
}
