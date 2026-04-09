import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSettings, useUpdateSettings } from '../hooks'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const { mutateAsync: updateSettings, isPending: saving } = useUpdateSettings()

  const [displayLanguage, setDisplayLanguage] = useState('zh-CN')
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(60)
  const [httpProxy, setHttpProxy] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (settings) {
      setDisplayLanguage(settings.displayLanguage)
      setSyncIntervalMinutes(settings.syncIntervalMinutes)
      setHttpProxy(settings.httpProxy ?? '')
    }
  }, [settings])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setToast(null)
    try {
      await updateSettings({
        displayLanguage,
        syncIntervalMinutes: Number(syncIntervalMinutes),
        httpProxy: httpProxy.trim() || null,
      })
      setToast({ type: 'success', message: 'Settings saved successfully.' })
      setTimeout(() => setToast(null), 3000)
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to save settings.' })
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface-3)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    fontSize: '14px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    marginBottom: '6px',
    display: 'block',
  }

  return (
    <div className="px-8 py-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: '6px',
        }}>
          Settings
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          Configure display language, sync interval, and proxy.
        </p>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading settings…</div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSave}
          className="flex flex-col gap-6"
        >
          <div
            className="rounded-xl p-6 flex flex-col gap-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
          >
            {/* Display Language */}
            <div>
              <label style={labelStyle}>Display Language</label>
              <input
                type="text"
                value={displayLanguage}
                onChange={e => setDisplayLanguage(e.target.value)}
                placeholder="e.g. zh-CN, en-US, ja-JP"
                style={inputStyle}
              />
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                BCP 47 language code used to fetch translated titles from TMDB. Re-sync after changing.
              </p>
            </div>

            {/* Sync Interval */}
            <div>
              <label style={labelStyle}>Sync Interval (minutes)</label>
              <input
                type="number"
                min={1}
                max={10080}
                value={syncIntervalMinutes}
                onChange={e => setSyncIntervalMinutes(Number(e.target.value))}
                style={inputStyle}
              />
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                How often to automatically sync with Trakt. Range: 1–10080 minutes (1 week).
              </p>
            </div>

            {/* HTTP Proxy */}
            <div>
              <label style={labelStyle}>HTTP Proxy</label>
              <input
                type="text"
                value={httpProxy}
                onChange={e => setHttpProxy(e.target.value)}
                placeholder="http://proxy.example.com:7890"
                style={inputStyle}
              />
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Optional. Used for TMDB and Trakt API requests. Leave empty to use environment default.
              </p>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-4 py-3 rounded-lg"
              style={{
                background: toast.type === 'success' ? '#34d39915' : '#ef444415',
                border: `1px solid ${toast.type === 'success' ? '#34d39930' : '#ef444430'}`,
                color: toast.type === 'success' ? 'var(--color-watched)' : 'var(--color-error)',
                fontSize: '13px',
              }}
            >
              {toast.type === 'success'
                ? <CheckCircle2 size={14} />
                : <AlertCircle size={14} />}
              {toast.message}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg self-start"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </motion.form>
      )}
    </div>
  )
}
