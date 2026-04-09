import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Tv2, CheckCircle2, LayoutGrid, Loader2, X, RefreshCw } from 'lucide-react'
import { useShowsProgress } from '../hooks'
import { ShowCard } from '../components/ShowCard'

const FILTERS = [
  { key: 'watching',  label: 'Watching',  icon: Tv2,          desc: '正在追' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, desc: '已完结' },
  { key: 'all',       label: 'All',       icon: LayoutGrid,   desc: '全部' },
]

export default function ProgressPage() {
  const [filter, setFilter] = useState('watching')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 280)
    return () => window.clearTimeout(t)
  }, [search])

  const { data: shows, isLoading, error, refetch, isFetching } = useShowsProgress(filter, debouncedSearch)

  const totalWatched   = (shows ?? []).reduce((s, i) => s + i.watchedEpisodes, 0)
  const totalAired     = (shows ?? []).reduce((s, i) => s + i.airedEpisodes, 0)
  const completedCount = (shows ?? []).filter(i => i.completed).length

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* ── Left filter rail ─────────────────────────────────────────────── */}
      <aside
        className="shrink-0 flex flex-col gap-1 py-8 px-3"
        style={{
          width: '160px',
          borderRight: '1px solid var(--color-border-subtle)',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 8px', marginBottom: '4px' }}>
          Filter
        </p>
        {FILTERS.map(({ key, label, icon: Icon, desc }) => {
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg w-full text-left relative"
              style={{
                background: active ? 'var(--color-accent-dim)' : 'transparent',
                border: active ? '1px solid var(--color-accent-glow)' : '1px solid transparent',
                color: active ? 'var(--color-accent-light)' : 'var(--color-text-secondary)',
                fontSize: '13px',
                fontWeight: active ? 500 : 400,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} />
              <div>
                <div>{label}</div>
                <div style={{ fontSize: '10px', color: active ? 'var(--color-accent)' : 'var(--color-text-muted)', marginTop: '1px' }}>{desc}</div>
              </div>
            </button>
          )
        })}

        {/* Stats summary */}
        <div className="mt-auto flex flex-col gap-2 px-1">
          <div style={{ height: '1px', background: 'var(--color-border-subtle)', margin: '8px 0' }} />
          <div className="flex flex-col gap-2">
            {[
              { label: '剧集', value: shows?.length ?? '—' },
              { label: '已看', value: totalWatched > 0 ? totalWatched.toLocaleString() : '—' },
              { label: '完结', value: completedCount > 0 ? completedCount : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-2">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{label}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Sticky top bar */}
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'var(--color-bg)',
            borderBottom: '1px solid var(--color-border-subtle)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}>
            {FILTERS.find(f => f.key === filter)?.label}
          </h2>

          {/* Search */}
          <div
            className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2 ml-2"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              maxWidth: '360px',
            }}
          >
            <Search size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text)',
                fontSize: '13px',
                width: '100%',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {isFetching && !isLoading && (
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
          )}

          <div className="ml-auto" style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {shows ? `${shows.length} shows` : ''}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 px-6 py-5">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-24">
              <Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Loading…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-24">
              <p style={{ color: 'var(--color-error)', fontSize: '14px' }}>加载失败，请检查 API 是否正常。</p>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer' }}
              >
                <RefreshCw size={13} /> 重试
              </button>
            </div>
          ) : shows?.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '6px' }}>
                {debouncedSearch ? `No results for "${debouncedSearch}"` : 'No shows here yet.'}
              </p>
              {!debouncedSearch && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  Trigger a sync from the sidebar to import your Trakt history.
                </p>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {shows?.map((progress, i) => (
                  <ShowCard key={progress.show.id} progress={progress} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
