export default function ProgressBar({ value = 0, total = 10 }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, total)) * 100)))
  return (
    <div>
      <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Выполнено {value} из {total} задач ({pct}%)</div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-inner">
        <div
          className="h-full rounded-full bg-violet-600 dark:bg-violet-500 shadow-[0_0_18px_rgba(167,139,250,0.6)] transition-all duration-500"
          style={{ width: pct + '%' }}
        />
      </div>
    </div>
  )
}
