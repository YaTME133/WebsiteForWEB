import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import DropdownMenu from './DropdownMenu.jsx'
import { useAuth } from '../auth.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import logoUrl from '../../zpr.png'

export default function Header() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const location = useLocation()
  const [guardActive, setGuardActive] = useState(false)
  useEffect(() => {
    try { setGuardActive(localStorage.getItem('ytme133_guard_active') === '1') } catch {}
    const onGuard = (e) => setGuardActive(!!(e?.detail?.active))
    window.addEventListener('ytme133_guard_change', onGuard)
    return () => window.removeEventListener('ytme133_guard_change', onGuard)
  }, [])
  const antiActive = useMemo(() => {
    // Блокируем навигацию, если активен глобальный античит (страница задачи или пакетная сессия)
    return guardActive || /^\/task\//.test(location.pathname)
  }, [guardActive, location.pathname])

  return (
  <header className="sticky top-0 z-30 border-b border-violet-900 bg-violet-800 text-white backdrop-blur dark:border-violet-950 dark:bg-violet-950 transition-colors">
    <div className="relative mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        {/* Left: brand */}
  <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white hover:text-violet-100 transition-colors">
    <img src={logoUrl} alt="ZPR" className="h-8 w-auto object-contain" />
    <span>ZPR Test</span>
  </Link>

        {/* Center: nav */}
        <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `text-sm text-violet-100 hover:text-white transition-colors ${
                isActive ? 'border-b-2 border-white pb-1' : ''
              }`
            }
            onClick={(e) => { if (antiActive) { e.preventDefault(); e.stopPropagation(); } }}
          >Главная</NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              `text-sm text-violet-100 hover:text-white transition-colors ${
                isActive ? 'border-b-2 border-white pb-1' : ''
              }`
            }
            onClick={(e) => { if (antiActive) { e.preventDefault(); e.stopPropagation(); } }}
          >Задания</NavLink>
          {false && ( // admin link moved into profile dropdown
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `text-sm text-zinc-600 dark:text-zinc-300 hover:text-violet-700 dark:hover:text-violet-300 transition-colors ${
                  isActive ? 'border-b-2 border-violet-400 pb-1' : ''
                }`
              }
            >Админ-панель</NavLink>
          )}
        </nav>

        {/* Right: profile */}
        <div className="flex items-center">
          <ThemeToggle />
          <div className="relative ml-2">
            {user ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white shadow-sm hover:bg-white/15 transition-colors"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-violet-200 shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
                {user.email?.split('@')[0] || 'alexey133'}
              </motion.button>
            ) : (
              <div className="flex items-center gap-2">
                <NavLink to="/login" className="inline-flex items-center rounded-2xl bg-white px-3 py-1.5 text-sm font-medium text-violet-700 shadow hover:bg-violet-50 transition-colors">Авторизация</NavLink>
                <NavLink to="/register" className="inline-flex items-center rounded-2xl bg-white px-3 py-1.5 text-sm font-medium text-violet-700 shadow hover:bg-violet-50 transition-colors">Регистрация</NavLink>
              </div>
            )}
            <DropdownMenu open={open} onClose={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </header>
  )
}
