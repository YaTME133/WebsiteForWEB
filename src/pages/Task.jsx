import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, logCheatEvent } from '../lib/api.js'
import { useAuth } from '../auth.jsx'
import { useAntiCheat } from '../hooks/useAntiCheat.js'
import AntiCheatBanner from '../components/AntiCheatBanner.jsx'

export default function Task() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const { token, user } = useAuth()

  useEffect(() => { api.get(`/tasks/${id}`).then(d => setTask(d.task)) }, [id])

  const submit = async () => {
    try {
      const res = await api.post('/solutions', { task_id: Number(id), code }, token)
      const map = { pending: 'На проверке', correct: 'Одобрено', wrong: 'Отклонено' }
      const label = map[res.solution.status] || res.solution.status
      setMessage('Отправлено! Статус: ' + label)
      setCode('')
    } catch (e) { setMessage(e.message) }
  }

  // Anti-cheat integration
  const logFn = useMemo(() => async (payload) => {
    try { await logCheatEvent({ taskId: Number(id), ...payload }, token) } catch {}
  }, [id, token])
  const onAutoFail = useMemo(() => async () => {
    // Только логируем нарушение; решение в модерацию не отправляем автоматически
    setMessage('Попытка помечена как подозрительная. Нарушение зафиксировано.')
    setCode('')
  }, [])

  const anti = useAntiCheat({ userId: user?.id, taskId: Number(id), logFn, onAutoFail, config: { warnAfter: 1, lockAfter: 2, autoFailAfter: 3, lockDurationSec: 30 } })

  useEffect(() => {
    // Стартуем только когда известен user.id, чтобы ключ персиста совпадал и состояние корректно восстановилось
    if (!user?.id) return
    anti.start()
    // При уходе со страницы (SPA-навигация/refresh) фиксируем как нарушение, чтобы нельзя было обойти блокировку
    return () => anti.routeLeave({ reason: 'unmount' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  if (!task) return <div>Загрузка…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            // Если анти-чит активен — фиксируем уход как нарушение и продолжаем назад
            try { await anti.routeLeave({ reason: 'back_button' }) } catch {}
            navigate(-1)
          }}
        >
          ← Назад
        </button>
        <h1 className="text-2xl font-bold text-violet-700 dark:text-violet-300 flex-1">{task.title}</h1>
      </div>
  <p className="text-zinc-700 dark:text-slate-300 whitespace-pre-wrap font-mono">{task.description}</p>
  <div className="text-xs text-zinc-500 dark:text-slate-400">Сложность: {{ easy: 'Лёгкое', medium: 'Среднее', hard: 'Сложное' }[task.difficulty] || task.difficulty}</div>
      <AntiCheatBanner
        started={anti.started}
        attempts={anti.attempts}
        warningOpen={anti.warningOpen}
        finalOpen={anti.finalOpen}
        locked={anti.locked}
        lockRemaining={anti.lockRemaining}
        onCloseWarning={anti.acknowledgeWarning}
        onGoHome={async () => { try { await anti.stop() } catch {}; window.location.href = '/'; }}
      />
      <textarea
        className="input h-48 font-mono"
        placeholder="# Введите код на Python"
        value={code}
        onChange={e => setCode(e.target.value)}
        disabled={anti.locked || anti.finalOpen}
      />
      <div className="flex gap-2">
        <button className="btn" onClick={submit} disabled={!token || anti.locked || anti.finalOpen}>Отправить</button>
        {!token && <span className="text-zinc-600 dark:text-slate-400 text-sm">Войдите, чтобы отправить решение</span>}
      </div>
      {message && <div className="text-sm text-zinc-700 dark:text-slate-300">{message}</div>}
    </div>
  )
}
