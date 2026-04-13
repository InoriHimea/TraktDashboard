import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, X } from 'lucide-react'
import { Button } from './ui/Button'

interface DateTimePickerModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (isoString: string) => void
  defaultValue?: Date
}

export function DateTimePickerModal({ open, onClose, onConfirm, defaultValue }: DateTimePickerModalProps) {
  const [dateTimeValue, setDateTimeValue] = useState('')

  useEffect(() => {
    if (open) {
      const date = defaultValue || new Date()
      // Format to datetime-local input format: YYYY-MM-DDTHH:mm
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      setDateTimeValue(`${year}-${month}-${day}T${hours}:${minutes}`)
    }
  }, [open, defaultValue])

  const handleConfirm = () => {
    if (!dateTimeValue) return
    const date = new Date(dateTimeValue)
    onConfirm(date.toISOString())
  }

  // Close on Escape
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed z-50 bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-[420px] max-w-[90vw]"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">选择观看时间</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  日期和时间
                </label>
                <div className="relative">
                  {/* Decorative calendar icon */}
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
                    <Calendar size={16} />
                  </div>
                  
                  {/* DateTime input */}
                  <input
                    type="datetime-local"
                    value={dateTimeValue}
                    onChange={(e) => setDateTimeValue(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
              <Button variant="ghost" size="md" onClick={onClose}>
                取消
              </Button>
              <Button variant="primary" size="md" onClick={handleConfirm} disabled={!dateTimeValue}>
                标记为已观看
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
