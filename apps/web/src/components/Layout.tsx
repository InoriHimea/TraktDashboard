import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import TopNav from './TopNav'
import { useAuth, useLogout } from '../hooks'

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { data: auth } = useAuth()
  const { mutate: logout } = useLogout()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <TopNav
        username={auth?.user?.traktUsername ?? null}
        onLogout={() => logout()}
      />
      <main style={{ paddingTop: '0' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
