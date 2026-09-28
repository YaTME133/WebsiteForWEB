import { useEffect, useMemo, useState } from 'react'
// import { Link } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../auth.jsx'
// import { AnimatePresence, motion } from 'framer-motion'
import Modal from '../components/Modal.jsx'
import { motion, AnimatePresence } from 'framer-motion'

export default function Progress() {
  const { token, user } = useAuth()
  const isAdmin = !!(user && (user.role === 'admin' || user.role === 'superadmin'))
  const [tasks, setTasks] = useState([])
  const [topics, setTopics] = useState([])
  const [solutions, setSolutions] = useState([])
  const [batches, setBatches] = useState([])
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchDetails, setBatchDetails] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Старые фильтры/группировка по задачам больше не нужны

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true); setError('')
      try {
        const [t, s, tops, bs] = await Promise.all([
          api.get('/tasks'),
          api.get('/solutions/my', token),
          api.get('/topics'),
          api.get('/my/topicSubmissions', token)
        ])
        if (!mounted) return
        const arrT = Array.isArray(t?.tasks) ? t.tasks : (Array.isArray(t) ? t : [])
        const arrS = Array.isArray(s?.solutions) ? s.solutions : (Array.isArray(s) ? s : [])
  setTasks(arrT)
  setSolutions(arrS)
  const arrB = Array.isArray(bs?.submissions) ? bs.submissions : []
  setBatches(arrB)
        const arrTop = Array.isArray(tops?.topics) ? tops.topics : []
        setTopics(arrTop)
      } catch (e) {
        if (!mounted) return
        setError(e.message || 'Не удалось загрузить прогресс')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [token])

  const lastCorrectMap = useMemo(() => {
    const map = new Map()
    for (const s of solutions || []) {
      if (s.status === 'correct') {
        const dStr = s.updated_at || s.created_at
        const d = dStr ? new Date(dStr) : new Date()
        const prev = map.get(s.task_id)
        if (!prev || d > prev) map.set(s.task_id, d)
      }
    }
    return map
  }, [solutions])
  // Любая последняя попытка (pending/wrong/correct)
  const lastAttemptMap = useMemo(() => {
    const map = new Map()
    for (const s of solutions || []) {
      const dStr = s.updated_at || s.created_at
      const d = dStr ? new Date(dStr) : new Date()
      const prev = map.get(s.task_id)
      if (!prev || d > prev) map.set(s.task_id, d)
    }
    return map
  }, [solutions])
  const doneIds = useMemo(() => new Set(Array.from(lastCorrectMap.keys())), [lastCorrectMap])
  const completed = doneIds.size
  const total = tasks.length
  // Прогресс по темам: считаем количество тем с задачами и полностью закрытых тем
  const { topicsTotal, topicsCompleted, topicsPercent } = useMemo(() => {
    // Сгруппируем по topic_id на базе всех задач (не завися от фильтра)
    const by = new Map()
    for (const t of tasks) {
      const key = t.topic_id != null ? String(t.topic_id) : 'none'
      if (!by.has(key)) by.set(key, [])
      by.get(key).push(t)
    }
    // Учитываем только реальные темы (без 'none') и только те, где есть задачи
    let total = 0
    let completedTopics = 0
    for (const [key, arr] of by.entries()) {
      if (key === 'none') continue
      if (!arr || arr.length === 0) continue
      total += 1
      const allDone = arr.every((t) => doneIds.has(t.id))
      if (allDone) completedTopics += 1
    }
    const percent = total > 0 ? Math.round((completedTopics * 100) / total) : 0
    return { topicsTotal: total, topicsCompleted: completedTopics, topicsPercent: percent }
  }, [tasks, doneIds])
  const tasksPercent = useMemo(() => (total > 0 ? Math.round((completed * 100) / total) : 0), [completed, total])

  // Баллы: общий максимум (по всем задачам) и набранные (по уникальным корректным задачам)
  const { totalPoints, earnedPoints } = useMemo(() => {
    const totalPts = (tasks || []).reduce((acc, t) => acc + Math.max(0, Number(t.points || 0)), 0)
    let earned = 0
    const correctTaskIds = new Set()
    for (const s of solutions || []) {
      if (s.status === 'correct') correctTaskIds.add(s.task_id)
    }
    for (const t of tasks || []) {
      if (correctTaskIds.has(t.id)) earned += Math.max(0, Number(t.points || 0))
    }
    return { totalPoints: totalPts, earnedPoints: earned }
  }, [tasks, solutions])

  // Баллы по пакетам отправок пользователя (по batch_id)
  const batchPoints = useMemo(() => {
    const map = new Map()
    for (const s of solutions || []) {
      const bId = s.batch_id
      if (!bId) continue
      const rec = map.get(bId) || { earned: 0, max: 0 }
      // max — сумма баллов задач в пакете
      rec.max += Math.max(0, Number(s.task_points || 0))
      // earned — суммируем только корректные
      if (s.status === 'correct') {
        const add = Number(s.awarded_points)
        rec.earned += Number.isFinite(add) && add > 0 ? add : Math.max(0, Number(s.task_points || 0))
      }
      map.set(bId, rec)
    }
    return map
  }, [solutions])

  // Баллы по темам: earned/max и выполнено задач
  const topicsStats = useMemo(() => {
    // Соберём задачи по теме
    const tasksByTopic = new Map()
    for (const t of tasks || []) {
      const key = t.topic_id != null ? String(t.topic_id) : 'none'
      if (key === 'none') continue // пропускаем задачи без темы
      if (!tasksByTopic.has(key)) tasksByTopic.set(key, [])
      tasksByTopic.get(key).push(t)
    }
    // Последние корректные по задачам
    const correctSet = new Set()
    for (const s of solutions || []) if (s.status === 'correct') correctSet.add(s.task_id)

    // Просуммируем по каждой теме
    const stats = []
    for (const [topicId, arr] of tasksByTopic.entries()) {
      let max = 0, earned = 0, done = 0
      for (const t of arr) {
        const pts = Math.max(0, Number(t.points || 0))
        max += pts
        if (correctSet.has(t.id)) { earned += pts; done += 1 }
      }
      const topic = (topics || []).find(tp => String(tp.id) === String(topicId))
      stats.push({
        topicId: Number(topicId),
        topicName: topic?.name || `Тема #${topicId}`,
        tasksTotal: arr.length,
        tasksDone: done,
        pointsMax: max,
        pointsEarned: earned,
      })
    }
    // Сортировка: по названию темы
    stats.sort((a,b)=> a.topicName.localeCompare(b.topicName, 'ru'))
    return stats
  }, [tasks, topics, solutions])

  // Убрана карточка со списком задач по темам

  // GMT+5 форматирование дат
  function parseUtcFromSqlite(str) {
    if (!str) return new Date()
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(String(str))) return new Date(String(str).replace(' ', 'T') + 'Z')
    return new Date(str)
  }
  function formatGMTPlus5(strOrDate) {
    const base = strOrDate instanceof Date ? strOrDate : parseUtcFromSqlite(strOrDate)
    const shifted = new Date(base.getTime() + 5 * 3600 * 1000)
    const dd = String(shifted.getUTCDate()).padStart(2, '0')
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = shifted.getUTCFullYear()
    const hh = String(shifted.getUTCHours()).padStart(2, '0')
    const mi = String(shifted.getUTCMinutes()).padStart(2, '0')
    const ss = String(shifted.getUTCSeconds()).padStart(2, '0')
    return `${dd}.${mm}.${yyyy}, ${hh}:${mi}:${ss}`
  }
  const formatDateTime = (d) => (d instanceof Date ? d.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) : '')

  async function openBatch(id) {
    try {
      const data = await api.get(`/topicSubmissions/${id}`, token)
      setBatchDetails(data)
      setBatchOpen(true)
      setExpanded({})
    } catch (_) {}
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/60 transition-colors">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Мой прогресс</h1>
  <p className="mt-2 text-zinc-700 dark:text-zinc-300">Ваш прогресс по заданиям</p>
        <div className="mt-6 space-y-2">
          <ProgressBar value={completed} total={total} />
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Выполненные задания: {completed} из {total} ({tasksPercent}%)</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Выполненные темы: {topicsCompleted} из {topicsTotal} ({topicsPercent}%)</div>
        </div>
        <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
          {loading && 'Загрузка…'}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      </div>

      {!loading && !error && (
        <>
          <div className="mt-4 space-y-4">
            {/* Баллы по темам */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow dark:border-zinc-800 dark:bg-zinc-900/60">
              <h2 className="mb-3 text-lg font-semibold text-violet-700 dark:text-violet-300">Баллы по темам</h2>
              <div className={`hidden md:grid gap-2 rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900/40 ${ (user && (user.role==='admin' || user.role==='superadmin')) ? 'grid-cols-5' : 'grid-cols-4' }`}>
                <div>Тема</div>
                <div>Заданий</div>
                <div>Выполнено</div>
                <div>Баллы</div>
                {(user && (user.role==='admin' || user.role==='superadmin')) && <div className="text-right pr-2">Доля</div>}
              </div>
              {topicsStats.map(row => (
                <div key={row.topicId} className={`grid grid-cols-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 ${ (user && (user.role==='admin' || user.role==='superadmin')) ? 'md:grid-cols-5' : 'md:grid-cols-4' }`}>
                  <div className="min-w-0 truncate" title={row.topicName}>{row.topicName}</div>
                  <div className="text-sm">{row.tasksTotal}</div>
                  <div className="text-sm">{row.tasksDone}</div>
                  <div className="text-sm whitespace-nowrap">
                    {(user && (user.role==='admin' || user.role==='superadmin')) ? (
                      <>{row.pointsEarned} / {row.pointsMax} б.</>
                    ) : (
                      <>{row.pointsEarned} б.</>
                    )}
                  </div>
                  {(user && (user.role==='admin' || user.role==='superadmin')) && (
                    <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                      {row.pointsMax > 0 ? Math.round((row.pointsEarned * 100) / row.pointsMax) : 0}%
                    </div>
                  )}
                </div>
              ))}
              {topicsStats.length === 0 && (
                <div className="text-sm text-zinc-600 dark:text-zinc-300">Пока нет тем с заданиями.</div>
              )}
            </section>

            {/* Пакетные отправки пользователя по темам */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow dark:border-zinc-800 dark:bg-zinc-900/60">
              <h2 className="mb-3 text-lg font-semibold text-violet-700 dark:text-violet-300">Мои отправки по темам</h2>
              <div className="hidden md:grid grid-cols-7 gap-2 rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900/40">
                <div>Тема</div>
                <div>Ответы</div>
                <div>Статус</div>
                <div>Баллы</div>
                <div>Создано</div>
                <div>Обновлено</div>
                <div className="text-right pr-2">Действия</div>
              </div>
              {(batches || []).map(b => (
                <div key={b.id} className="grid grid-cols-1 md:grid-cols-7 items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="truncate">{b.topic_name}</div>
                  <div className="text-sm">{b.answers_count ?? 0}</div>
                  <div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${b.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
                        : b.status === 'rejected'
                        ? 'bg-rose-100 text-rose-700 ring-rose-300/60 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
                        : 'bg-amber-100 text-amber-700 ring-amber-300/60 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30'}`}>
                      {b.status === 'approved' ? 'Одобрено' : b.status === 'rejected' ? 'Отклонено' : 'На проверке'}
                    </span>
                  </div>
                  {(() => {
                    const pts = batchPoints.get(b.id) || { earned: 0, max: 0 }
                    let text
                    if (isAdmin) {
                      text = `${pts.earned} / ${pts.max} б.`
                    } else {
                      if (b.status === 'pending') text = '—'
                      else text = `${pts.earned} б.`
                    }
                    return (
                      <div className="text-sm whitespace-nowrap">{text}</div>
                    )
                  })()}
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{formatGMTPlus5(b.created_at)}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{formatGMTPlus5(b.updated_at)}</div>
                  <div className="md:text-right">
                    <button type="button" className="btn btn-sm" onClick={() => openBatch(b.id)}>Просмотр</button>
                  </div>
                </div>
              ))}
              {(batches || []).length === 0 && (
                <div className="text-sm text-zinc-600 dark:text-zinc-300">Нет отправленных тем.</div>
              )}
            </section>
          </div>
        </>
      )}

      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title={batchDetails ? `Отправка: ${batchDetails.submission?.topic_name}` : 'Отправка'} mode="modal">
        {!batchDetails ? (
          <div className="text-sm text-zinc-500">Загрузка…</div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const sols = batchDetails.solutions || []
              const earned = sols.reduce((a, s) => a + (Number.isFinite(Number(s.awarded_points)) ? Number(s.awarded_points) : 0), 0)
              const max = sols.reduce((a, s) => a + Math.max(0, Number(s.task_points || 0)), 0)
              return (
                <div className="mb-1 text-sm text-zinc-700 dark:text-zinc-300">
                  Итог по отправке: <span className="font-semibold text-violet-700 dark:text-violet-300">{isAdmin ? `${earned} / ${max} б.` : `${earned} б.`}</span>
                </div>
              )
            })()}
            {(batchDetails.solutions || []).map(sol => {
              const isOpen = !!expanded[sol.id]
              const status = sol.status
              const statusText = status === 'correct' ? 'Верно' : status === 'wrong' ? 'Неверно' : 'На проверке'
              const statusCls = status === 'correct'
                ? 'bg-emerald-100 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
                : status === 'wrong'
                ? 'bg-rose-100 text-rose-700 ring-rose-300/60 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
                : 'bg-amber-100 text-amber-700 ring-amber-300/60 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30'
              return (
                <div key={sol.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-violet-50/50 dark:hover:bg-violet-500/10 transition-colors"
                    onClick={() => setExpanded(prev => ({ ...prev, [sol.id]: !prev[sol.id] }))}
                  >
                    <div className="text-sm font-medium">
                      {sol.task_title}
                      {isAdmin && (
                        <span className="ml-2 text-xs text-zinc-500">({sol.task_points ?? 0} б.)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${statusCls}`}>{statusText}</span>
                      <div className={`text-xs text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</div>
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="px-3 pb-3"
                      >
                        <pre className="max-h-64 overflow-auto rounded-xl bg-zinc-900 p-3 text-xs text-zinc-100 ring-1 ring-zinc-700"><code>{sol.code}</code></pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button className="btn" onClick={() => setBatchOpen(false)}>Закрыть</button>
        </div>
      </Modal>
    </section>
  )
}
