import { useState } from 'react'
import { Check, Star, Clock } from 'lucide-react'
import { resolveEpisodeStill } from '../lib/image'
import type { EpisodeDetailData } from '@trakt-dashboard/types'

interface EpisodeInfoCardProps {
  data: EpisodeDetailData
  onWatchClick: () => void
  onHistoryClick: () => void
}

export function EpisodeInfoCard({ data, onWatchClick, onHistoryClick }: EpisodeInfoCardProps) {
  const [watchHover, setWatchHover] = useState(false)
  const [historyHover, setHistoryHover] = useState(false)
  const [imgError, setImgError] = useState(false)

  const title = data.translatedTitle ?? data.title
  const overview = data.translatedOverview ?? data.overview
  const stillUrl = resolveEpisodeStill(data.stillPath)
  const showImg = stillUrl && !imgError
  const seasonLabel = data.seasonNumber === 0 ? 'Specials' : `Season ${data.seasonNumber}`

  return (
    <>
      {/* ── Left: text content ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
          <span>TV Shows</span>
          <span style={{ opacity: 0.4 }}>›</span>
          <span>{data.show.title}</span>
          <span style={{ opacity: 0.4 }}>›</span>
          <span style={{ color: 'var(--color-accent)' }}>{seasonLabel}</span>
        </nav>

        {/* Titles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.55)', margin: 0, letterSpacing: '0.02em' }}>
            Episode {data.episodeNumber}
          </p>
          <h1 style={{
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.05,
            margin: 0,
            letterSpacing: '-0.03em',
          }}>
            {title || `S${data.seasonNumber}E${data.episodeNumber}`}
          </h1>
        </div>

        {/* Meta badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {data.airDate && (
            <MetaBadge label={new Date(data.airDate).getFullYear().toString()} />
          )}
          {data.runtime && (
            <MetaBadge icon={<Clock size={11} />} label={`${data.runtime}分钟`} />
          )}
          {data.show.genres?.[0] && (
            <MetaBadge label={data.show.genres[0].toUpperCase()} />
          )}
          {data.traktRating !== null && (
            <MetaBadge
              icon={<Star size={11} style={{ fill: '#87b4ff', color: '#87b4ff' }} />}
              label={`${data.traktRating}%`}
              accent="#87b4ff"
            />
          )}
        </div>

        {/* External links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {data.show.traktId && (
            <ExternalPill href={`https://trakt.tv/shows/${data.show.traktSlug ?? data.show.traktId}/seasons/${data.seasonNumber}/episodes/${data.episodeNumber}`} label="TRAKT" />
          )}
          {data.show.tmdbId && (
            <ExternalPill href={`https://www.themoviedb.org/tv/${data.show.tmdbId}/season/${data.seasonNumber}/episode/${data.episodeNumber}`} label="TMDB" />
          )}
          {data.show.imdbId && (
            <ExternalPill href={`https://www.imdb.com/title/${data.show.imdbId}/`} label="IMDB" />
          )}
          {data.show.tvdbId && (
            <ExternalPill href={`https://thetvdb.com/?tab=series&id=${data.show.tvdbId}`} label="TVDB" />
          )}
        </div>

        {/* Overview */}
        {overview && (
          <p style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.7,
            maxWidth: 640,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {overview}
          </p>
        )}

        {/* Action buttons */}
        {data.watched ? (
          /* ── Watched state: done_all icon + Watch again + History ── */
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
            {/* Done-all badge */}
            <button
              style={{
                height: 56, width: 56,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 12, cursor: 'pointer',
                background: '#7c3aed',
                border: 'none',
                boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              aria-label="已观看"
              tabIndex={-1}
            >
              {/* done_all: double-check icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 12 5 16 13 8" />
                <polyline points="9 12 13 16 21 8" />
              </svg>
            </button>

            {/* Watch again */}
            <button
              onClick={onWatchClick}
              onMouseEnter={() => setWatchHover(true)}
              onMouseLeave={() => setWatchHover(false)}
              style={{
                height: 56, minWidth: 160,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                borderRadius: 12, cursor: 'pointer',
                fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
                color: '#fff',
                background: watchHover ? '#0f766e' : '#0d9488',
                border: 'none',
                boxShadow: watchHover ? '0 8px 24px rgba(13,148,136,0.45)' : '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease',
                transform: watchHover ? 'translateY(-1px)' : 'none',
              } as React.CSSProperties}
            >
              <Check size={16} strokeWidth={2.5} />
              Watch again...
            </button>

            {/* History */}
            <button
              onClick={onHistoryClick}
              onMouseEnter={() => setHistoryHover(true)}
              onMouseLeave={() => setHistoryHover(false)}
              style={{
                height: 56, minWidth: 140,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                borderRadius: 12, cursor: 'pointer',
                fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
                color: '#fff',
                background: historyHover ? '#475569' : '#334155',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              <HistoryIcon />
              History
            </button>
          </div>
        ) : (
          /* ── Unwatched state: single check button + History ── */
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
            {/* Mark as watched */}
            <button
              onClick={onWatchClick}
              onMouseEnter={() => setWatchHover(true)}
              onMouseLeave={() => setWatchHover(false)}
              style={{
                height: 56, width: 160,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 12, cursor: 'pointer',
                background: watchHover ? '#e9d5ff' : '#f3e8ff',
                border: '1px solid #d8b4fe',
                boxShadow: watchHover ? '0 8px 24px rgba(147,51,234,0.25)' : '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease',
                transform: watchHover ? 'translateY(-1px)' : 'none',
              } as React.CSSProperties}
              aria-label="标记为已观看"
            >
              <Check size={22} strokeWidth={2.5} color="#9333ea" />
            </button>

            {/* History */}
            <button
              onClick={onHistoryClick}
              onMouseEnter={() => setHistoryHover(true)}
              onMouseLeave={() => setHistoryHover(false)}
              style={{
                height: 56, minWidth: 140,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                borderRadius: 12, cursor: 'pointer',
                fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
                color: historyHover ? '#fff' : 'rgba(255,255,255,0.8)',
                background: historyHover ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.15s ease',
              }}
            >
              <HistoryIcon />
              History
            </button>
          </div>
        )}
      </div>

      {/* ── Right: episode thumbnail ── */}
      {showImg && (
        <div style={{ flexShrink: 0, width: 'clamp(280px, 28vw, 420px)' }}>
          <div style={{
            position: 'relative',
            aspectRatio: '16/9',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            transition: 'transform 0.5s ease',
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <img
              src={stillUrl}
              alt={title || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgError(true)}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)',
              pointerEvents: 'none',
            }} />
            {data.watched && (
              <div style={{
                position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.92)', color: '#000',
                fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                padding: '5px 12px', borderRadius: 999,
                boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
              }}>
                <Check size={9} strokeWidth={3.5} />
                WATCHED
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
    </svg>
  )
}

function MetaBadge({ icon, label, accent }: { icon?: React.ReactNode; label: string; accent?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 12px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: accent ? `${accent}20` : 'rgba(255,255,255,0.1)',
      color: accent ?? 'rgba(255,255,255,0.8)',
      border: `1px solid ${accent ? `${accent}30` : 'rgba(255,255,255,0.08)'}`,
      backdropFilter: 'blur(8px)',
    }}>
      {icon}{label}
    </span>
  )
}

function ExternalPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '5px 14px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textDecoration: 'none',
        color: 'rgba(255,255,255,0.6)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
    >
      {label}
    </a>
  )
}
