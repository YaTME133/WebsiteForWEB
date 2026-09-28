import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth.jsx'
import Home from './pages/Home.jsx'
import Task from './pages/Task.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Admin from './pages/Admin.jsx'
import SuperAdmin from './pages/SuperAdmin.jsx'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Tasks from './pages/Tasks.jsx'
import Progress from './pages/Progress.jsx'
import Topic from './pages/Topic.jsx'
import { AnimatePresence, motion } from 'framer-motion'
import ErrorBoundary from './components/ErrorBoundary.jsx'

function Protected({ roles, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function Layout({ children }) {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 dark:bg-[#0f0f13] dark:text-white transition-colors duration-300">
      <Header />
      <main className={`flex-1 mx-auto max-w-6xl w-full px-6 ${isHome ? 'py-0' : 'py-8'}`}>{children}</main>
      {isHome ? <Footer overlay /> : <Footer />}
    </div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <AuthProvider>
      <Layout>
        <AnimatePresence mode="wait" initial={false}>
          <ErrorBoundary resetKey={location.pathname}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Page><Home /></Page>} />
              <Route path="/tasks" element={<Page><Tasks /></Page>} />
              <Route path="/topics/:id" element={<Page><Topic /></Page>} />
              <Route path="/progress" element={<Protected><Page><Progress /></Page></Protected>} />
              <Route path="/task/:id" element={<Page><Task /></Page>} />
              <Route path="/login" element={<Page><Login /></Page>} />
              <Route path="/register" element={<Page><Register /></Page>} />
              <Route path="/admin" element={<Protected roles={['admin','superadmin']}><Page><Admin /></Page></Protected>} />
              <Route path="/superadmin" element={<Protected roles={['superadmin']}><Page><SuperAdmin /></Page></Protected>} />
            </Routes>
          </ErrorBoundary>
        </AnimatePresence>
      </Layout>
    </AuthProvider>
  )
}

function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
