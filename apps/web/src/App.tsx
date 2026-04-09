import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks'
import Layout from './components/Layout'
import ProgressPage from './pages/ProgressPage'
import ShowDetailPage from './pages/ShowDetailPage'
import StatsPage from './pages/StatsPage'
import SyncPage from './pages/SyncPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  const { data: auth, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</p>
        </div>
      </div>
    )
  }

  if (!auth?.authenticated) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/progress" replace />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/shows/:id" element={<ShowDetailPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/progress" replace />} />
      </Routes>
    </Layout>
  )
}
