import { motion, AnimatePresence } from 'framer-motion'

export default function AntiCheatBanner({
  started,
  attempts,
  warningOpen,
  finalOpen,
  locked,
  lockRemaining,
  onCloseWarning,
  onGoHome,
  maxWarnings = 3,
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
          Не переключайтесь с окна задания. Нарушения фиксируются.
        </div>
        {started && (
          <div className="ml-2 shrink-0 rounded-full border border-rose-400 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300" title="Счётчик предупреждений">
            Предупреждения: {attempts} / {maxWarnings}
          </div>
        )}
      </div>

      <AnimatePresence>
        {warningOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-rose-400/70 bg-rose-50 p-4 text-rose-800 shadow dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
            role="alert"
            aria-live="assertive"
          >
            <div className="font-semibold">Предупреждение</div>
            <div className="text-sm">Переключение окна/вкладки зафиксировано. Повтор — приведёт к блокировке.</div>
            <button className="mt-2 btn btn-sm" onClick={onCloseWarning}>Понял</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {locked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-zinc-300 bg-white/80 p-4 text-zinc-800 shadow backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="font-semibold">Работа временно заблокирована</div>
            <div className="text-sm">Оставшееся время: {String(Math.floor(lockRemaining/60)).padStart(2,'0')}:{String(lockRemaining%60).padStart(2,'0')}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {finalOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-rose-500/70 bg-rose-50 p-4 text-rose-800 shadow dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="font-semibold">Попытка помечена как подозрительная</div>
            <div className="text-sm">Решение будет рассмотрено администратором. Вы можете отправить апелляцию в профиле.</div>
            <div className="mt-3">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (typeof onGoHome === 'function') onGoHome()
                  else {
                    try { window.location.href = '/' } catch {}
                  }
                }}
              >
                На главную
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )}
