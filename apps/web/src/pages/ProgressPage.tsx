import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Tv2, CheckCircle2, LayoutGrid, Loader2, X, RefreshCw } from 'lucide-react'
import { useShowsProgress } from '../hooks'
import { ShowCard } from '../components/ShowCard'

const FILTERS = [
  { key: 'watching', label: 'Watching', icon: Tv2 },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'all', label: 'All', icon: LayoutGrid },
]

export default function ProgressPage() {
  const [filter, setFilter] = useState('watching')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 280)
    return () => window.clearTimeout(timer)
  }, [search])

  const { data: shows, isLoading, error, refetch, isFetching } = useShowsProgress(filter, debouncedSearch)
  const activeFilterLabel = FILTERS.find(f => f.key === filter)?.label || 'Watching'
  const totalWatched = (shows || []).reduce((acc, item) => acc + item.watchedEpisodes, 0)
  const totalAired = (shows || []).reduce((acc, item) => acc + item.airedEpisodes, 0)
  const completedCount = (shows || []).filter((item) => item.completed).length

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '34px',
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: '6px',
            }}
          >
            Progress
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            {shows ? `${shows.length} 个剧集 · 已看 ${totalWatched}/${totalAired} 集` : '正在统计...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-secondary)' }}
          >
            已完结 {completedCount}
          </span>
          <span
            className="px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-secondary)' }}
          >
            分类 {activeFilterLabel}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
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
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: '14px',
              width: '100%',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="p-0.5 rounded"
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '16px' }}>
        当前筛选: {activeFilterLabel}{debouncedSearch ? ` · 搜索: "${debouncedSearch}"` : ''}{isFetching ? ' · 更新中...' : ''}
      </p>

      {/* Show list */}
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading shows…</p>
        </div>
      ) : error ? (
        <div className="text-center py-20 flex flex-col items-center gap-3">
          <p style={{ color: '#ef4444', fontSize: '14px' }}>加载剧集失败，请检查 API 是否正常。</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} />
            重试
          </button>
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
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
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
