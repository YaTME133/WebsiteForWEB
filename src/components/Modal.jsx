import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Reusable modal/drawer component
// Props:
// - open: boolean
// - onClose: function
// - title?: string
// - mode?: 'modal' | 'drawer' (default 'drawer')
// - side?: 'right' | 'left' (for drawer) default 'right'
// - children: content
export default function Modal({ open, onClose, title, mode = 'drawer', side = 'right', children }) {
  // close on ESC
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const isDrawer = mode === 'drawer'
  const sideTranslate = side === 'right' ? '100%' : '-100%'

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={false}>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          {isDrawer ? (
            <motion.aside
              role="dialog"
              aria-modal="true"
              className={`absolute top-0 ${side === 'right' ? 'right-0' : 'left-0'} h-full w-full max-w-xl shadow-2xl`}
              initial={{ x: sideTranslate }}
              animate={{ x: 0 }}
              exit={{ x: sideTranslate }}
              transition={{ type: 'spring', stiffness: 420, damping: 35, mass: 0.7 }}
            >
              <div className="flex h-full flex-col rounded-none border-l border-zinc-200 bg-white/95 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
                {title && <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>}
                <div className="min-h-0 flex-1 overflow-auto">{children}</div>
              </div>
            </motion.aside>
          ) : (
            <motion.div
              role="dialog"
              aria-modal="true"
              className="absolute inset-0 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22, mass: 0.7 }}
            >
              <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
                {title && <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>}
                {children}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
