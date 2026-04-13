import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useEpisodeDetail } from '../hooks'
import { EpisodeInfoCard } from '../components/EpisodeInfoCard'
import { EpisodeSeasonStrip } from '../components/EpisodeSeasonStrip'
import { WatchActionPanel } from '../components/WatchActionPanel'
import { WatchHistoryPanel } from '../components/WatchHistoryPanel'
import { Button } from '../components/ui/Button'

interface RouteParams {
  showId: string
  season: string
  episode: string
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EpisodeDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <div className="animate-pulse space-y-8">
          {/* Top card area */}
          <div className="flex gap-8">
            <div className="w-[480px] aspect-video rounded-2xl bg-white/[0.05]" />
            <div className="flex-1 space-y-4">
              <div className="h-8 w-64 rounded-lg bg-white/[0.07]" />
              <div className="h-4 w-40 rounded-full bg-white/[0.04]" />
              <div className="h-20 w-full rounded-lg bg-white/[0.03]" />
              <div className="flex gap-3">
                <div className="h-10 w-32 rounded-lg bg-white/[0.05]" />
                <div className="h-10 w-32 rounded-lg bg-white/[0.05]" />
              </div>
            </div>
          </div>

          {/* Bottom strip area */}
          <div className="space-y-4">
            <div className="h-6 w-32 rounded-lg bg-white/[0.05]" />
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-[200px] aspect-video rounded-lg bg-white/[0.03]" />
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
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
      <div className="text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-red-950/40 border border-red-500/15 flex items-center justify-center">
          <span className="text-xl">⚠</span>
        </div>
        <p className="text-[var(--color-text-muted)] text-sm">加载失败，请重试</p>
        <Button variant="secondary" size="md" icon={<RefreshCw size={13} />} onClick={onRetry}>
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

  // Parse and validate route params
  const showIdNum = Number(showId)
  const seasonNum = Number(season)
  const episodeNum = Number(episode)

  // Redirect if any param is invalid (non-positive integer)
  if (
    !showId ||
    !season ||
    !episode ||
    !Number.isInteger(showIdNum) ||
    !Number.isInteger(seasonNum) ||
    !Number.isInteger(episodeNum) ||
    showIdNum <= 0 ||
    seasonNum < 0 ||
    episodeNum <= 0
  ) {
    return <Navigate to="/progress" replace />
  }

  const { data, isLoading, error, refetch } = useEpisodeDetail(showIdNum, seasonNum, episodeNum)

  const [watchPanelOpen, setWatchPanelOpen] = useState(false)
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)

  if (isLoading) return <EpisodeDetailSkeleton />
  if (error) return <PageError onRetry={() => refetch()} />

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-3">
          <p className="text-[var(--color-text-muted)] text-base">未找到该集</p>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate(-1)}>
            返回
          </Button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        {/* Back button */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <ArrowLeft size={15} />
            返回
          </button>
        </div>

        {/* Episode Info Card */}
        <article>
          <EpisodeInfoCard
            data={data}
            onWatchClick={() => setWatchPanelOpen(true)}
            onHistoryClick={() => setHistoryPanelOpen(true)}
          />
        </article>

        {/* Season Strip */}
        <section>
          <EpisodeSeasonStrip
            episodes={data.seasonEpisodes}
            seasonNumber={data.seasonNumber}
            currentEpisodeNumber={data.episodeNumber}
            showId={data.showId}
          />
        </section>
      </div>

      {/* Watch Action Panel */}
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

      {/* Watch History Panel */}
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
