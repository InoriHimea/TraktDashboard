import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Tv2, CheckCircle2, LayoutGrid, Loader2 } from 'lucide-react'
import { useShowsProgress } from '../hooks'
import { ShowCard } from '../components/ShowCard'
import { cn } from '../lib/utils'

const FILTERS = [
  { key: 'watching', label: 'Watching', icon: Tv2 },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'all', label: 'All', icon: LayoutGrid },
]

export default function ProgressPage() {
  const [filter, setFilter] = useState('watching')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const debounce = useCallback((val: string) => {
    clearTimeout((debounce as any)._t)
    ;(debounce as any)._t = setTimeout(() => setDebouncedSearch(val), 280)
  }, [])

  const { data: shows, isLoading, error } = useShowsProgress(filter, debouncedSearch)

  return (
    <div className="px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            marginBottom: '6px',
          }}
        >
          Watch Progress
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          {shows ? `${shows.length} show${shows.length !== 1 ? 's' : ''}` : '…'}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        {/* Filter tabs */}
        <div
          className="flex items-center rounded-lg p-1 gap-1"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
              style={{
                fontSize: '13px',
                fontWeight: filter === key ? 500 : 400,
                color: filter === key ? 'var(--color-text)' : 'var(--color-text-secondary)',
                background: filter === key ? 'var(--color-surface-3)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search shows…"
            value={search}
            onChange={e => { setSearch(e.target.value); debounce(e.target.value) }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: '14px',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Show list */}
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading shows…</p>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p style={{ color: '#ef4444', fontSize: '14px' }}>Failed to load shows. Try syncing again.</p>
        </div>
      ) : shows?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', marginBottom: '8px' }}>
            {debouncedSearch ? `No shows matching "${debouncedSearch}"` : 'No shows here yet.'}
          </p>
          {!debouncedSearch && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Trigger a sync from the sidebar to import your Trakt history.
            </p>
          )}
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {shows?.map((progress, i) => (
              <ShowCard key={progress.show.id} progress={progress} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
