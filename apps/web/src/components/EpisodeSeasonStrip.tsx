import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { resolveEpisodeTitle } from '../lib/i18n'
import { resolveEpisodeStill } from '../lib/image'
import { EpisodePlaceholder } from './ui/EpisodePlaceholder'
import type { EpisodeProgress } from '@trakt-dashboard/types'

interface EpisodeSeasonStripProps {
  episodes: EpisodeProgress[]
  seasonNumber: number
  currentEpisodeNumber: number
  showId: number
}

export function EpisodeSeasonStrip({
  episodes,
  seasonNumber,
  currentEpisodeNumber,
  showId,
}: EpisodeSeasonStripProps) {
  const navigate = useNavigate()
  const currentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [])

  const seasonLabel = seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, fontWeight: 600,
        color: 'var(--color-text-muted)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>Seasons</span>
        <span style={{ opacity: 0.25 }}>/</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{seasonLabel}</span>
      </div>

      {/* Horizontal scroll — no outer card, just the strip */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 6,
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-border) transparent',
          marginLeft: -2,
          paddingLeft: 2,
        }}
      >
        {episodes.map((ep) => {
          const isCurrent = ep.episodeNumber === currentEpisodeNumber
          const isUnaired = ep.aired === false

          return (
            <EpisodeThumbnail
              key={ep.episodeId}
              episode={ep}
              seasonNumber={seasonNumber}
              showId={showId}
              isCurrent={isCurrent}
              isUnaired={isUnaired}
              ref={isCurrent ? currentRef : null}
              onNavigate={(s, e) => navigate(`/shows/${showId}/seasons/${s}/episodes/${e}`)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Episode Thumbnail ────────────────────────────────────────────────────────

interface EpisodeThumbnailProps {
  episode: EpisodeProgress
  seasonNumber: number
  showId: number
  isCurrent: boolean
  isUnaired: boolean
  onNavigate: (season: number, episode: number) => void
}

const EpisodeThumbnail = React.forwardRef<HTMLDivElement, EpisodeThumbnailProps>(
  ({ episode, seasonNumber, isCurrent, isUnaired, onNavigate }, ref) => {
    const [imgError, setImgError] = useState(false)
    const [hovered, setHovered] = useState(false)

    const title = resolveEpisodeTitle(episode)
    const stillUrl = resolveEpisodeStill(episode.stillPath)
    const showImg = stillUrl && !imgError
    const isWatched = episode.watched
    const epCode = `S${String(seasonNumber).padStart(2, '0')} · E${String(episode.episodeNumber).padStart(2, '0')}`

    return (
      <div
        ref={ref}
        style={{
          width: 220,
          flexShrink: 0,
          cursor: isUnaired ? 'default' : 'pointer',
          opacity: isUnaired ? 0.5 : 1,
        }}
        onClick={() => !isUnaired && onNavigate(seasonNumber, episode.episodeNumber)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-current={isCurrent ? 'true' : undefined}
        aria-label={`${epCode} ${title}`}
      >
        {/* Thumbnail */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 10,
          boxShadow: isCurrent
            ? '0 0 0 2px var(--color-accent), 0 6px 20px rgba(0,0,0,0.5)'
            : hovered
            ? '0 6px 20px rgba(0,0,0,0.5)'
            : '0 2px 10px rgba(0,0,0,0.35)',
          transition: 'box-shadow 0.2s ease',
          background: 'var(--color-surface-3)',
        }}>
          {showImg ? (
            <img
              src={stillUrl}
              alt={title}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: hovered ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform 0.3s ease',
              }}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <EpisodePlaceholder seasonNumber={seasonNumber} episodeNumber={episode.episodeNumber} />
          )}

          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)',
            pointerEvents: 'none',
          }} />

          {/* Runtime badge */}
          {episode.runtime && (
            <div style={{
              position: 'absolute', bottom: 7, left: 8,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
              color: 'rgba(255,255,255,0.85)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}>
              {episode.runtime}m
            </div>
          )}

          {/* Watched checkmark */}
          {isWatched && (
            <div style={{
              position: 'absolute', bottom: 7, right: 8,
              width: 20, height: 20,
              borderRadius: '50%',
              background: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(124,106,247,0.5)',
            }}>
              <Check size={10} strokeWidth={3} color="#fff" />
            </div>
          )}

          {/* Unaired overlay */}
          {isUnaired && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)',
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                padding: '3px 8px', borderRadius: 4,
                background: 'rgba(0,0,0,0.7)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
              }}>
                未播出
              </span>
            </div>
          )}
        </div>

        {/* Title row */}
        <div>
          <h4 style={{
            fontSize: 12.5,
            fontWeight: 600,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: isCurrent
              ? 'var(--color-accent)'
              : hovered
              ? 'var(--color-text-base)'
              : isWatched
              ? 'var(--color-text-muted)'
              : 'var(--color-text-secondary)',
            transition: 'color 0.15s',
          }}>
            {title || `Episode ${episode.episodeNumber}`}
          </h4>
          <p style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            margin: '3px 0 0',
            fontWeight: 500,
          }}>
            {epCode}
          </p>
        </div>
      </div>
    )
  }
)

EpisodeThumbnail.displayName = 'EpisodeThumbnail'
