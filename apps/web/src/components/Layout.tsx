import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, Tv2, LogOut, RefreshCw, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth, useLogout, useSyncStatus, useTriggerSync } from '../hooks'

const NAV = [
  { to: '/progress', icon: Tv2, label: 'Progress' },
  { to: '/stats', icon: BarChart3, label: 'Statistics' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { data: auth } = useAuth()
  const { mutate: logout } = useLogout()
  const { data: syncStatus } = useSyncStatus()
  const { mutate: triggerSync, isPending: syncing } = useTriggerSync()

  const isRunning = syncStatus?.status === 'running'
  const syncPct = isRunning && syncStatus.total > 0
    ? Math.round((syncStatus.progress / syncStatus.total) * 100)
    : 0

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col shrink-0 fixed top-0 left-0 h-full z-40"
        style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
      >
        {/* Logo */}
        <div className="px-5 py-6">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            trakt<span style={{ color: 'var(--color-accent)' }}>·</span>dash
          </h1>
          {auth?.user?.traktUsername && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '2px' }}>
              @{auth.user.traktUsername}
            </p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = location.pathname.startsWith(to)
            return (
              <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 relative"
                  style={{
                    color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    background: active ? 'var(--color-surface-3)' : 'transparent',
                    fontSize: '14px',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                      style={{ background: 'var(--color-accent)' }}
                    />
                  )}
                  <Icon size={16} />
                  {label}
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* Sync status */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          {isRunning ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {syncStatus.currentShow
                    ? <span className="truncate block max-w-[130px]">{syncStatus.currentShow}</span>
                    : 'Syncing…'}
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'var(--color-accent)' }}
                  animate={{ width: `${syncPct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {syncStatus.progress}/{syncStatus.total} shows
              </p>
            </div>
          ) : (
            <button
              onClick={() => triggerSync()}
              disabled={syncing}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors"
              style={{
                background: 'var(--color-surface-3)',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncStatus?.lastSyncAt
                ? 'Sync now'
                : 'Initial sync…'}
              {syncStatus?.status === 'error' && (
                <AlertCircle size={13} style={{ color: '#ef4444', marginLeft: 'auto' }} />
              )}
              {syncStatus?.status === 'completed' && (
                <CheckCircle2 size={13} style={{ color: 'var(--color-watched)', marginLeft: 'auto' }} />
              )}
            </button>
          )}
        </div>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
