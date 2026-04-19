import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface SlidingPanelProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title: string
  subtitle?: string
  icon?: React.ReactNode
  width?: string
}

export function SlidingPanel({
  open,
  onClose,
  children,
  title,
  subtitle,
  icon,
  width = '420px',
}: SlidingPanelProps) {
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 bg-[var(--color-surface)] border-l border-[var(--color-border)] z-50 flex flex-col"
            style={{
              width,
              boxShadow: '-8px 0 40px rgba(0,0,0,0.12), -2px 0 8px rgba(0,0,0,0.06)',
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 20px 16px',
                borderBottom: '1px solid var(--color-border)',
                background: 'linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-surface) 100%)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {icon && (
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 100%)',
                    border: '1px solid rgba(99,102,241,0.28)',
                    borderTopColor: 'rgba(139,92,246,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 6px rgba(99,102,241,0.12)',
                  }}>
                    {icon}
                  </div>
                )}
                <div>
                  <h2 style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    margin: 0,
                    lineHeight: 1.2,
                    letterSpacing: '-0.01em',
                  }}>
                    {title}
                  </h2>
                  {subtitle && (
                    <p style={{
                      fontSize: '12px',
                      color: 'var(--color-text-muted)',
                      margin: '3px 0 0',
                      fontWeight: 500,
                    }}>
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderTopColor: 'rgba(255,255,255,0.18)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 3px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'var(--color-surface)'
                  el.style.color = 'var(--color-text)'
                  el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 8px rgba(0,0,0,0.12)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'var(--color-surface-2)'
                  el.style.color = 'var(--color-text-muted)'
                  el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 3px rgba(0,0,0,0.08)'
                }}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
