import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, Tv2, LogOut, RefreshCw, CheckCircle2,
  Loader2, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, X
} from 'lucide-react'
import { useState } from 'react'
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
  const [showFailures, setShowFailures] = useState(false)

  const isRunning = syncStatus?.status === 'running'
  const syncPct = isRunning && syncStatus.total > 0
    ? Math.round((syncStatus.progress / syncStatus.total) * 100)
    : 0
  const failedShows = syncStatus?.failedShows ?? []
  const hasFailures = failedShows.length > 0

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col shrink-0 fixed top-0 left-0 h-full z-40"
        style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5">
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}>
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

        {/* Sync panel */}
        <div className="px-3 pb-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="pt-3">
            {isRunning ? (
              /* ── Running state ── */
              <div
                className="rounded-xl p-3"
                style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 size={13} className="animate-spin shrink-0" style={{ color: 'var(--color-accent)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                    Syncing…
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                    {syncStatus.progress}/{syncStatus.total}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: 'var(--color-border)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--color-accent)' }}
                    animate={{ width: `${syncPct}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>

                {/* Current show */}
                {syncStatus.currentShow && (
                  <p className="truncate" style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.4,
                  }}>
                    {syncStatus.currentShow}
                  </p>
                )}
              </div>
            ) : (
              /* ── Idle / completed / error state ── */
              <div className="flex flex-col gap-2">
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
                  <span className="flex-1 text-left">
                    {syncStatus?.lastSyncAt ? 'Sync now' : 'Start sync'}
                  </span>
                  {syncStatus?.status === 'error' && (
                    <AlertCircle size={13} style={{ color: '#ef4444' }} />
                  )}
                  {syncStatus?.status === 'completed' && !hasFailures && (
                    <CheckCircle2 size={13} style={{ color: 'var(--color-watched)' }} />
                  )}
                  {syncStatus?.status === 'completed' && hasFailures && (
                    <AlertTriangle size={13} style={{ color: 'var(--color-airing)' }} />
                  )}
                </button>

                {/* Last sync time */}
                {syncStatus?.lastSyncAt && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', paddingLeft: '4px' }}>
                    Last: {new Date(syncStatus.lastSyncAt).toLocaleString('zh-CN', {
                      month: 'numeric', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}

                {/* Error message */}
                {syncStatus?.status === 'error' && syncStatus.error && (
                  <div
                    className="rounded-lg px-3 py-2"
                    style={{
                      background: '#ef444415',
                      border: '1px solid #ef444430',
                      fontSize: '11px',
                      color: '#ef4444',
                      lineHeight: 1.5,
                    }}
                  >
                    {syncStatus.error}
                  </div>
                )}

                {/* Failed shows toggle */}
                {hasFailures && (
                  <div>
                    <button
                      onClick={() => setShowFailures(v => !v)}
                      className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg"
                      style={{
                        background: '#f59e0b10',
                        border: '1px solid #f59e0b25',
                        color: 'var(--color-airing)',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      <AlertTriangle size={11} />
                      <span className="flex-1 text-left">{failedShows.length} failed</span>
                      {showFailures ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>

                    <AnimatePresence>
                      {showFailures && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div
                            className="mt-1 rounded-lg p-2 flex flex-col gap-1"
                            style={{
                              background: 'var(--color-surface-3)',
                              border: '1px solid var(--color-border)',
                              maxHeight: '160px',
                              overflowY: 'auto',
                            }}
                          >
                            {failedShows.map((f, i) => (
                              <div key={i} className="flex flex-col gap-0.5">
                                <span className="truncate" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                  {f.title}
                                </span>
                                <span className="truncate" style={{ fontSize: '10px', color: '#ef4444', opacity: 0.8 }}>
                                  {f.error}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg"
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '13px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
