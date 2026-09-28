import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../auth.jsx'

export default function DropdownMenu({ open, onClose }) {
  const ref = useRef(null)
  const { logout, user } = useAuth()

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose?.()
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, mass: 0.6 }}
          className="absolute right-0 mt-2 w-52 rounded-2xl border border-zinc-200 bg-gray-100 text-zinc-800 shadow-xl dark:border-zinc-700 dark:bg-zinc-800/95 dark:text-zinc-100 backdrop-blur"
        >
          <ul className="py-2 text-sm">
            <li>
              <Link
                to="/progress"
                className="block px-4 py-2 hover:bg-zinc-200/80 hover:text-violet-700 rounded-xl transition-colors duration-200 dark:hover:bg-zinc-700/60 dark:hover:text-violet-300"
                onClick={(e) => { if (window.location.pathname.startsWith('/task/')) { e.preventDefault(); e.stopPropagation(); } else { onClose?.() } }}
              >
                Мой прогресс
              </Link>
            </li>
            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <li>
                <Link
                  to="/admin"
                  className="block px-4 py-2 hover:bg-zinc-200/80 hover:text-violet-700 rounded-xl transition-colors duration-200 dark:hover:bg-zinc-700/60 dark:hover:text-violet-300"
                  onClick={(e) => { if (window.location.pathname.startsWith('/task/')) { e.preventDefault(); e.stopPropagation(); } else { onClose?.() } }}
                >
                  Админ-панель
                </Link>
              </li>
            )}
            <li>
              <button
                onClick={() => { logout(); onClose?.() }}
                className="block w-full text-left px-4 py-2 hover:bg-zinc-200/80 hover:text-violet-700 rounded-xl transition-colors duration-200 dark:hover:bg-zinc-700/60 dark:hover:text-violet-300"
              >
                Выйти
              </button>
            </li>
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
