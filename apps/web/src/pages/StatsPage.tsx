import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Tv2, CheckCircle2, Clock, TrendingUp, Star } from 'lucide-react'
import { useStats } from '../hooks'
import { tmdbImage, formatRuntime, daysAgo } from '../lib/utils'

function StatCard({
  label, value, icon: Icon, sub, delay = 0
}: {
  label: string; value: string | number; icon: any; sub?: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl p-5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{label}</span>
        <Icon size={16} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{sub}</p>
      )}
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2" style={{
      background: 'var(--color-surface-3)',
      border: '1px solid var(--color-border)',
      fontSize: '13px',
    }}>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2px' }}>{label}</p>
      <p style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{payload[0].value} episodes</p>
    </div>
  )
}

export default function StatsPage() {
  const { data: stats, isLoading } = useStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!stats) return null

  const totalHours = Math.floor(stats.totalRuntimeMinutes / 60)
  const totalDays = (stats.totalRuntimeMinutes / (60 * 24)).toFixed(1)

  // Fill in missing months for chart
  const chartData = (() => {
    const months: { month: string; count: number }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const found = stats.monthlyActivity?.find((m: any) => m.month === key)
      months.push({
        month: d.toLocaleString('en', { month: 'short' }),
        count: found ? Number(found.count) : 0,
      })
    }
    return months
  })()

  const maxBar = Math.max(...chartData.map(d => d.count), 1)

  return (
    <div className="px-8 py-8 max-w-4xl">
      <div className="mb-8">
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: '6px',
        }}>
          Statistics
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Your watch history at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-8" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <StatCard
          label="Episodes watched"
          value={stats.totalEpisodesWatched.toLocaleString()}
          icon={Tv2}
          delay={0}
        />
        <StatCard
          label="Shows watched"
          value={stats.totalShowsWatched}
          icon={Star}
          sub={`${stats.totalShowsCompleted} completed`}
          delay={0.06}
        />
        <StatCard
          label="Time spent"
          value={`${totalHours.toLocaleString()}h`}
          icon={Clock}
          sub={`That's ${totalDays} full days`}
          delay={0.12}
        />
        <StatCard
          label="Shows completed"
          value={stats.totalShowsCompleted}
          icon={CheckCircle2}
          delay={0.18}
        />
      </div>

      {/* Monthly activity chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24 }}
        className="rounded-xl p-6 mb-6"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text)' }}>
            Monthly Activity
          </h3>
          <span className="flex items-center gap-1.5" style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            <TrendingUp size={14} />
            Last 12 months
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={20} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="month"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-3)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.count === maxBar ? 'var(--color-accent)' : 'var(--color-surface-3)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Top genres */}
        {stats.topGenres?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-xl p-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '16px' }}>
              Top Genres
            </h3>
            <div className="flex flex-col gap-3">
              {stats.topGenres.map((g: { name: string; count: number }, i: number) => {
                const pct = Math.round((g.count / stats.topGenres[0].count) * 100)
                return (
                  <div key={g.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{g.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{g.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: i === 0 ? 'var(--color-accent)' : 'var(--color-surface-2)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.4 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Recently watched */}
        {stats.recentlyWatched?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.36 }}
            className="rounded-xl p-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '16px' }}>
              Recent Activity
            </h3>
            <div className="flex flex-col gap-3">
              {stats.recentlyWatched.slice(0, 7).map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="shrink-0 rounded overflow-hidden"
                    style={{ width: '32px', height: '48px', background: 'var(--color-surface-3)' }}
                  >
                    {r.posterPath && (
                      <img
                        src={tmdbImage(r.posterPath, 'w92')!}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>
                      {r.showTitle}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      S{String(r.seasonNumber).padStart(2,'0')}E{String(r.episodeNumber).padStart(2,'0')}
                      {r.episodeTitle ? ` · ${r.episodeTitle}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {daysAgo(r.watchedAt)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
