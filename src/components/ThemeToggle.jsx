import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../theme.jsx'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={toggle}
      aria-label="Toggle theme"
      className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl border shadow transition-all border-zinc-300 bg-white text-zinc-700 hover:text-violet-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-200 dark:hover:text-violet-300"
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {isDark ? (
          <motion.span key="moon" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Moon size={18} />
          </motion.span>
        ) : (
          <motion.span key="sun" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Sun size={18} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
