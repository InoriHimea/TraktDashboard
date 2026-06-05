import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart3, Tv2, Film, RefreshCw, Settings, LogOut, Bookmark, Calendar } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNowPlaying } from '../hooks/index'
import { NowPlayingPopup } from './NowPlayingPopup'
import { t } from '../lib/i18n'

interface TopNavProps {
  username: string | null
  onLogout: () => void
}

const NAV = [
  { to: '/tv-shows',   icon: Tv2,       labelKey: 'nav.tvShows' },
  { to: '/movies',     icon: Film,      labelKey: 'nav.movies' },
  { to: '/calendar',   icon: Calendar,  labelKey: 'nav.calendar' },
  { to: '/watchlist',  icon: Bookmark,  labelKey: 'nav.watchlist' },
  { to: '/stats',      icon: BarChart3, labelKey: 'nav.statistics' },
  { to: '/sync',       icon: RefreshCw, labelKey: 'nav.sync' },
  { to: '/settings',   icon: Settings,  labelKey: 'nav.settings' },
]

function isNavActive(pathname: string, to: string) {
  if (to === '/tv-shows') {
    return pathname === '/' || pathname.startsWith('/tv-shows') || pathname.startsWith('/shows/')
  }
  if (to === '/movies') {
    return pathname.startsWith('/movies')
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function TopNav({ username, onLogout }: TopNavProps) {
  const location = useLocation()
  const qc = useQueryClient()
  const { data: nowPlayingData, isWatching, isLoading: nowPlayingLoading } = useNowPlaying()
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const prevIsWatching = useRef(isWatching)

  // When a watching session ends (isWatching flips true → false), the user just
  // finished an episode. Invalidate stats and show/movie progress so the
  // "最近动态" section and progress lists refresh automatically.
  useEffect(() => {
    if (prevIsWatching.current && !isWatching) {
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['shows-progress'] })
      qc.invalidateQueries({ queryKey: ['movies-progress'] })
    }
    prevIsWatching.current = isWatching
  }, [isWatching, qc])

  return (
    <>
      <header
        className="top-nav-shell"
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          height: '56px',
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, var(--color-nav-glass), var(--color-surface))',
          borderBottom: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-nav)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '20px',
          paddingRight: '20px',
          gap: '8px',
        }}
      >
        {/* Logo */}
        <Link to="/tv-shows" style={{ textDecoration: 'none', flexShrink: 0, marginRight: '8px' }}>
          <span className="top-nav-logo" style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            textShadow: '0 0 18px var(--color-accent-glow)',
          }}>
            trakt<span style={{ color: 'var(--color-accent)' }}>·</span>dash
          </span>
          {username && (
            <span style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              marginLeft: '6px',
              display: 'none',
            }}
              className="sm-show"
            >
              @{username}
            </span>
          )}
        </Link>

        {/* Nav items */}
        <nav
          className="top-nav-items"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            flex: 1,
            minWidth: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {NAV.map(({ to, icon: Icon, labelKey }) => {
            const active = isNavActive(location.pathname, to)
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className="top-nav-link"
                style={{ textDecoration: 'none' }}
              >
                <motion.div
                  className="top-nav-item"
                  whileHover={{
                    backgroundColor: active ? 'var(--color-nav-active-hover)' : 'var(--color-nav-hover)',
                    borderColor: active ? 'var(--color-nav-active-border)' : 'var(--color-border-subtle)',
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    color: active ? 'var(--color-accent-light)' : 'var(--color-text-secondary)',
                    background: active ? 'var(--color-nav-active-bg)' : 'transparent',
                    border: active ? '1px solid var(--color-nav-active-border)' : '1px solid transparent',
                    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 0 18px var(--color-accent-glow)' : 'none',
                    fontSize: '13px',
                    fontWeight: active ? 650 : 500,
                    position: 'relative',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span className="nav-label-full" style={{ display: 'inline' }}>{t(labelKey)}</span>
                  {active && (
                    <motion.div
                      layoutId="topnav-indicator"
                      style={{
                        position: 'absolute',
                        bottom: '-1px',
                        left: '8px',
                        right: '8px',
                        height: '2px',
                        borderRadius: '2px 2px 0 0',
                        background: 'linear-gradient(90deg, transparent, var(--color-accent), var(--color-accent-rose), transparent)',
                        boxShadow: '0 0 14px var(--color-accent-glow)',
                      }}
                    />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* Right: Now Playing trigger + username + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Now Playing trigger button — only when watching */}
          {isWatching && (
            <button
              ref={triggerRef}
              data-testid="now-playing-trigger"
              onClick={() => setIsPopupOpen(prev => !prev)}
              title={t("common.nowPlaying")}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: 'var(--radius-md)',
                background: isPopupOpen ? 'var(--color-surface-3)' : 'transparent',
                border: '1px solid var(--color-accent)',
                color: 'var(--color-accent)',
                boxShadow: '0 0 18px var(--color-accent-glow)',
                fontSize: '12px',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* Pulsing dot */}
              <span
                data-testid="now-playing-pulse"
                style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                  boxShadow: '0 0 10px var(--color-accent)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <span>{t("common.nowPlaying")}</span>
            </button>
          )}

          {username && (
            <span className="topnav-username" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              @{username}
            </span>
          )}
          <button
            onClick={onLogout}
            title={t("common.signOut")}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <LogOut size={13} aria-hidden="true" />
            <span className="topnav-action-label" style={{ display: 'inline' }}>{t("common.signOut")}</span>
          </button>
        </div>
      </header>

      {/* Now Playing popup — rendered outside header to avoid stacking context issues */}
      <NowPlayingPopup
        data={nowPlayingData}
        isLoading={nowPlayingLoading}
        isOpen={isPopupOpen && isWatching}
        onClose={() => setIsPopupOpen(false)}
        triggerRef={triggerRef}
      />
    </>
  )
}
