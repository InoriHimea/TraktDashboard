import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'success') {
      window.history.replaceState({}, '', '/')
      navigate('/progress')
    }
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Ambient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, #7c6af715 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center gap-8 max-w-sm w-full px-6"
      >
        {/* Logo */}
        <div className="text-center">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              color: 'var(--color-text)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            trakt
            <span style={{ color: 'var(--color-accent)' }}>·</span>
            dash
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', marginTop: '12px', lineHeight: 1.6 }}>
            Your personal TV progress tracker.
            <br />
            Powered by Trakt · TMDB · TVDB.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {['Episode progress', 'Season view', 'Watch stats', 'Auto-sync'].map((f) => (
            <span
              key={f}
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <motion.a
          href="/auth/trakt"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            padding: '14px 24px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 500,
            textDecoration: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
          Connect with Trakt
        </motion.a>

        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Requires a free Trakt account.
          <br />
          Your data is stored locally — never shared.
        </p>
      </motion.div>
    </div>
  )
}
