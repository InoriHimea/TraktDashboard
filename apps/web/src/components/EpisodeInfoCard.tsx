import { useState } from 'react'
import { Check, History, Star, Clock, Calendar } from 'lucide-react'
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

  const title = data.translatedTitle ?? data.title
  const overview = data.translatedOverview ?? data.overview
  const stillUrl = resolveEpisodeStill(data.stillPath)
  const showImg = stillUrl && !imgError

  const seasonLabel = data.seasonNumber === 0 ? 'Specials' : `Season ${data.seasonNumber}`

  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      {/* Blurred background image */}
      {showImg && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${stillUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(40px) saturate(1.4)',
          transform: 'scale(1.1)',
          opacity: 0.18,
          pointerEvents: 'none',
        }} />
      )}
      {/* Dark overlay for readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(8,8,14,0.85) 0%, rgba(15,15,23,0.7) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        gap: 28,
        padding: '28px 28px 24px',
      }}>
        {/* ── Left: still image ── */}
        <div style={{ width: 340, flexShrink: 0 }}>
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 10,
            overflow: 'hidden',
            background: 'var(--color-surface-3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
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
            {/* Bottom gradient */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 45%)',
              pointerEvents: 'none',
            }} />
            {/* Watched badge */}
            {data.watched && (
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'rgba(255,255,255,0.95)', color: '#000',
                fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                padding: '4px 10px', borderRadius: 999,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}>
                <Check size={8} strokeWidth={3.5} />
                WATCHED
              </div>
            )}
          </div>
        </div>

        {/* ── Right: metadata ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-between', padding: '2px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Breadcrumb */}
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: 'var(--color-accent)', opacity: 0.9 }}>{data.show.title}</span>
              <span style={{ margin: '0 8px', opacity: 0.3 }}>/</span>
              <span>{seasonLabel} · Episode {data.episodeNumber}</span>
            </p>

            {/* Title */}
            <h1 style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.2,
              margin: 0,
              letterSpacing: '-0.02em',
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}>
              {title || `S${data.seasonNumber}E${data.episodeNumber}`}
            </h1>

            {/* Meta pills row */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              {data.airDate && (
                <MetaPill icon={<Calendar size={10} />} label={new Date(data.airDate).getFullYear().toString()} />
              )}
              {data.runtime && (
                <MetaPill icon={<Clock size={10} />} label={`${data.runtime} 分钟`} />
              )}
              {data.show.genres?.[0] && (
                <MetaPill label={data.show.genres[0]} />
              )}
              {data.traktRating !== null && (
                <MetaPill
                  icon={<Star size={10} style={{ fill: '#fbbf24', color: '#fbbf24' }} />}
                  label={`${data.traktRating}%`}
                  highlight
                />
              )}
            </div>

            {/* Overview */}
            {overview && (
              <p style={{
                fontSize: 13.5,
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.7,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
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
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                background: watchHover
                  ? 'linear-gradient(135deg, #6d5ce6, #5b4bd4)'
                  : 'linear-gradient(135deg, #7c6af7, #6d5ce6)',
                boxShadow: watchHover
                  ? '0 6px 24px rgba(124,106,247,0.55)'
                  : '0 4px 16px rgba(124,106,247,0.4)',
                transition: 'all 0.15s ease',
                transform: watchHover ? 'translateY(-1px)' : 'none',
                letterSpacing: '0.01em',
              }}
            >
              <Check size={14} strokeWidth={3} />
              标记为已观看
            </button>

            {/* Secondary: History — icon only */}
            <button
              onClick={onHistoryClick}
              title="观看历史"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40,
                borderRadius: 8,
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M12 7v5l4 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaPill({ icon, label, highlight }: { icon?: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px',
      borderRadius: 5,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: highlight ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.08)',
      color: highlight ? '#fbbf24' : 'rgba(255,255,255,0.55)',
      border: `1px solid ${highlight ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      {icon}
      {label}
    </span>
  )
}
