import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminTabs({ tabs, current, onChange }) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const set = () => setIsMobile(mq.matches)
    set(); mq.addEventListener('change', set)
    return () => mq.removeEventListener('change', set)
  }, [])

  if (isMobile) {
    return (
      <select
        className="input mb-4"
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        {tabs.map(t => (
          <option value={t.key} key={t.key}>{t.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-zinc-200 bg-white/70 p-1 dark:border-zinc-800 dark:bg-zinc-900/40">
      {tabs.map(t => {
        const active = t.key === current
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative rounded-xl px-3 py-1.5 text-sm transition-colors ${active ? 'text-violet-700 dark:text-violet-300' : 'text-zinc-700 hover:text-violet-700 dark:text-zinc-300 dark:hover:text-violet-300'}`}
          >
            {t.label}
            {active && (
              <motion.span layoutId="adminTabUnderline" className="absolute inset-0 -z-10 rounded-xl bg-violet-500/10 ring-1 ring-violet-500/30" />
            )}
          </button>
        )
      })}
    </div>
  )
}
