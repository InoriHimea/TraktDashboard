import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Tv2, CheckCircle2, LayoutGrid, Loader2, X, RefreshCw } from 'lucide-react'
import { useShowsProgress } from '../hooks'
import { ShowCard } from '../components/ShowCard'

const FILTERS = [
  { key: 'watching',  label: 'Watching',  icon: Tv2,         color: '#7c6af7' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: '#10b981' },
  { key: 'all',       label: 'All',       icon: LayoutGrid,   color: '#0ea5e9' },
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Sticky controls bar */}
      <div style={{
        position: 'sticky',
        top: '56px',
        zIndex: 30,
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border-subtle)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '3px',
          }}>
            {FILTERS.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: filter === key ? 600 : 400,
                  color: filter === key ? color : 'var(--color-text-secondary)',
                  background: filter === key ? `${color}18` : 'transparent',
                  border: filter === key ? `1px solid ${color}40` : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={13} color={filter === key ? color : 'var(--color-text-muted)'} />
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            maxWidth: '320px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px',
          }}>
            <Search size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search shows…"
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

          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
            {shows ? `${shows.length} shows` : ''}
          </span>
        </div>
      </div>

      {/* Content — centered with max-width */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingTop: '80px' }}>
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading shows…</p>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingTop: '80px' }}>
            <p style={{ color: 'var(--color-error)', fontSize: '14px' }}>Failed to load shows.</p>
            <button
              onClick={() => refetch()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : shows?.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', paddingTop: '80px' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '6px' }}>
              {debouncedSearch ? `No results for "${debouncedSearch}"` : 'No shows here yet.'}
            </p>
            {!debouncedSearch && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                Go to Sync to import your Trakt history.
              </p>
            )}
          </motion.div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '16px',
          }}>
            <AnimatePresence mode="popLayout">
              {shows?.map((progress, i) => (
                <ShowCard key={progress.show.id} progress={progress} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
