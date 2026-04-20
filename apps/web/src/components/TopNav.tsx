import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart3, Tv2, Film, RefreshCw, Settings, LogOut } from 'lucide-react'
import { useNowPlaying } from '../hooks/index'
import { NowPlayingPopup } from './NowPlayingPopup'
import { t } from '../lib/i18n'

interface TopNavProps {
  username: string | null
  onLogout: () => void
}

const NAV = [
  { to: '/tv-shows', icon: Tv2,       labelKey: 'nav.tvShows' },
  { to: '/movies',   icon: Film,      labelKey: 'nav.movies' },
  { to: '/stats',    icon: BarChart3, labelKey: 'nav.statistics' },
  { to: '/sync',     icon: RefreshCw, labelKey: 'nav.sync' },
  { to: '/settings', icon: Settings,  labelKey: 'nav.settings' },
]

export default function TopNav({ username, onLogout }: TopNavProps) {
  const location = useLocation()
  const { data: nowPlayingData, isWatching, isLoading: nowPlayingLoading } = useNowPlaying()
  const [isPopupOpen, setIsPopupOpen] = useState(false)

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          height: '56px',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '20px',
          paddingRight: '20px',
          gap: '8px',
        }}
      >
        {/* Logo */}
        <Link to="/tv-shows" style={{ textDecoration: 'none', flexShrink: 0, marginRight: '8px' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
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
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
          {NAV.map(({ to, icon: Icon, labelKey }) => {
            const active = location.pathname.startsWith(to)
            return (
              <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                <motion.div
                  whileHover={{ backgroundColor: 'var(--color-surface-3)' }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    background: active ? 'var(--color-surface-3)' : 'transparent',
                    fontSize: '13px',
                    fontWeight: active ? 500 : 400,
                    position: 'relative',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={14} />
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
                        background: 'var(--color-accent)',
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
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <span>{t("common.nowPlaying")}</span>
            </button>
          )}

          {username && (
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
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
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <LogOut size={13} />
            <span style={{ display: 'inline' }}>{t("common.signOut")}</span>
          </button>
        </div>
      </header>

      {/* Now Playing popup — rendered outside header to avoid stacking context issues */}
      <NowPlayingPopup
        data={nowPlayingData}
        isLoading={nowPlayingLoading}
        isOpen={isPopupOpen && isWatching}
        onClose={() => setIsPopupOpen(false)}
      />
    </>
  )
}
