import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart3, Tv2, RefreshCw, Settings, LogOut } from 'lucide-react'

interface TopNavProps {
  username: string | null
  onLogout: () => void
}

const NAV = [
  { to: '/progress',  icon: Tv2,       label: 'Progress',    short: 'Progress' },
  { to: '/stats',     icon: BarChart3,  label: 'Statistics',  short: 'Stats' },
  { to: '/sync',      icon: RefreshCw,  label: 'Sync',        short: 'Sync' },
  { to: '/settings',  icon: Settings,   label: 'Settings',    short: 'Settings' },
]

export default function TopNav({ username, onLogout }: TopNavProps) {
  const location = useLocation()

  return (
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
      <Link to="/progress" style={{ textDecoration: 'none', flexShrink: 0, marginRight: '8px' }}>
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
        {NAV.map(({ to, icon: Icon, label, short }) => {
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
                {/* Full label on wider screens, short on narrow */}
                <span className="nav-label-full" style={{ display: 'inline' }}>{label}</span>
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

      {/* Right: username + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {username && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            @{username}
          </span>
        )}
        <button
          onClick={onLogout}
          title="Sign out"
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
          <span style={{ display: 'inline' }}>Sign out</span>
        </button>
      </div>
    </header>
  )
}
