import { useState } from 'react'
import { Check, History, Star } from 'lucide-react'
import { EpisodePlaceholder } from './ui/EpisodePlaceholder'
import { resolveEpisodeStill } from '../lib/image'
import type { EpisodeDetailData } from '@trakt-dashboard/types'

interface EpisodeInfoCardProps {
  data: EpisodeDetailData
  onWatchClick: () => void
  onHistoryClick: () => void
}

export function EpisodeInfoCard({ data, onWatchClick, onHistoryClick }: EpisodeInfoCardProps) {
  const [imgError, setImgError] = useState(false)
  const [watchHover, setWatchHover] = useState(false)
  const [historyHover, setHistoryHover] = useState(false)

  const title = data.translatedTitle ?? data.title
  const overview = data.translatedOverview ?? data.overview
  const stillUrl = resolveEpisodeStill(data.stillPath)
  const showImg = stillUrl && !imgError

  const seasonLabel = data.seasonNumber === 0 ? 'Specials' : `Season ${data.seasonNumber}`

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      gap: 24,
      padding: 24,
      borderRadius: 16,
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>
      {/* ── Left: still image ── */}
      <div style={{ width: 320, flexShrink: 0 }}>
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'var(--color-surface-3)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}>
          {showImg ? (
            <img
              src={stillUrl}
              alt={title || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <EpisodePlaceholder seasonNumber={data.seasonNumber} episodeNumber={data.episodeNumber} />
          )}
          {/* Gradient */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)',
            pointerEvents: 'none',
          }} />
          {/* Watched badge */}
          {data.watched && (
            <div style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#fff', color: '#000',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              padding: '4px 10px', borderRadius: 999,
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}>
              <Check size={9} strokeWidth={3} />
              WATCHED
            </div>
          )}
        </div>
      </div>

      {/* ── Right: metadata ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-between', padding: '4px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Breadcrumb */}
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.02em' }}>
            <span style={{ color: 'var(--color-accent)' }}>{data.show.title}</span>
            <span style={{ margin: '0 6px', opacity: 0.4 }}>/</span>
            <span>{seasonLabel} · Episode {data.episodeNumber}</span>
          </p>

          {/* Title */}
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3, margin: 0 }}>
            {title || `S${data.seasonNumber}E${data.episodeNumber}`}
          </h1>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px', fontSize: 13, color: 'var(--color-text-muted)' }}>
            {data.airDate && <span>{new Date(data.airDate).getFullYear()}</span>}
            {data.runtime && <><span style={{ opacity: 0.3 }}>·</span><span>{data.runtime} 分钟</span></>}
            {data.show.genres?.[0] && <><span style={{ opacity: 0.3 }}>·</span><span>{data.show.genres[0]}</span></>}
            {data.directors?.length > 0 && <><span style={{ opacity: 0.3 }}>·</span><span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.directors.join(', ')}</span></>}
          </div>

          {/* Rating */}
          {data.traktRating !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Star size={14} style={{ color: 'var(--color-accent)', fill: 'var(--color-accent)' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{data.traktRating}%</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Trakt</span>
            </div>
          )}

          {/* Overview */}
          {overview && (
            <p style={{
              fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.65,
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              margin: 0,
            }}>
              {overview}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
          {/* Primary: Mark as watched */}
          <button
            onClick={onWatchClick}
            onMouseEnter={() => setWatchHover(true)}
            onMouseLeave={() => setWatchHover(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 20px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: watchHover
                ? 'linear-gradient(135deg, #6d5ce6, #5b4bd4)'
                : 'linear-gradient(135deg, #7c6af7, #6d5ce6)',
              boxShadow: watchHover
                ? '0 6px 20px rgba(124,106,247,0.5)'
                : '0 4px 14px rgba(124,106,247,0.35)',
              transition: 'all 0.15s ease',
              transform: watchHover ? 'translateY(-1px)' : 'none',
            }}
          >
            <Check size={15} strokeWidth={2.5} />
            标记为已观看
          </button>

          {/* Secondary: History */}
          <button
            onClick={onHistoryClick}
            onMouseEnter={() => setHistoryHover(true)}
            onMouseLeave={() => setHistoryHover(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              color: historyHover ? 'var(--color-text)' : 'var(--color-text-secondary)',
              background: historyHover ? 'var(--color-surface-3)' : 'var(--color-surface-2)',
              border: `1px solid ${historyHover ? 'var(--color-accent)' : 'var(--color-border)'}`,
              transition: 'all 0.15s ease',
            }}
          >
            <History size={14} />
            历史
          </button>
        </div>
      </div>
    </div>
  )
}
