import { useEffect, useMemo, useState } from 'react'
import { api, logCheatEvent } from '../lib/api.js'
import ProgressBar from '../components/ProgressBar.jsx'
import { useAuth } from '../auth.jsx'
import { motion } from 'framer-motion'
import { useAntiCheat } from '../hooks/useAntiCheat.js'
import AntiCheatBanner from '../components/AntiCheatBanner.jsx'

export default function Tasks() {
  const { token, user } = useAuth()
  const [topics, setTopics] = useState([])
  const [topicScores, setTopicScores] = useState({}) // { [topicId]: { earned, max, percent, reviewedBatchId } }
  const [selectedTopicId, setSelectedTopicId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const storageKey = useMemo(() => `topic_session_${user?.id || 'anon'}_${selectedTopicId || 'none'}`,[user?.id, selectedTopicId])
  const selectedTopic = useMemo(() => topics.find(t => String(t.id) === String(selectedTopicId)), [topics, selectedTopicId])
  const tasks = useMemo(() => Array.isArray(selectedTopic?.tasks) ? selectedTopic.tasks : [], [selectedTopic])
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const answeredCount = useMemo(() => tasks.filter(t => !!(answers?.[t.id]?.trim())).length, [tasks, answers])
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  // Anti-cheat for multi-task session
  const logFn = useMemo(() => async (payload) => {
    try {
      // Сохраняем контекст темы и текущего задания в details, taskId в лог — null
      await logCheatEvent({
        taskId: null,
        eventType: payload?.eventType,
        details: {
          ...(payload?.details || {}),
          topicId: selectedTopicId,
          currentTaskId: tasks[current]?.id,
          scope: 'topic_session'
        }
      }, token)
    } catch {}
  }, [selectedTopicId, current, tasks, token])
  const onAutoFail = useMemo(() => async () => {
    setMsg('Попытка помечена как подозрительная. Нарушение зафиксировано.')
  }, [])
  const anti = useAntiCheat({ userId: user?.id, taskId: selectedTopicId ? `topic-${selectedTopicId}` : 'topic-session', logFn, onAutoFail, config: { warnAfter: 1, lockAfter: 2, autoFailAfter: 3, lockDurationSec: 30 } })

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true); setError('')
      try {
        const [resp, mySub, mySols] = await Promise.all([
          api.get('/topics'),
          token ? api.get('/my/topicSubmissions', token) : Promise.resolve({ submissions: [] }),
          token ? api.get('/solutions/my', token) : Promise.resolve({ solutions: [] })
        ])
        const arr = Array.isArray(resp?.topics) ? resp.topics : []
        if (!mounted) return
        const subs = Array.isArray(mySub?.submissions) ? mySub.submissions : []
        const pendingByTopic = new Set(subs.filter(b => String(b.status) === 'pending').map(b => String(b.topic_id)))
  // проставляем _pending и нормализуем is_locked -> boolean для карточек
  const mapped = arr.map(t => ({ ...t, is_locked: !!t.is_locked, _pending: pendingByTopic.has(String(t.id)) }))
        setTopics(mapped)

        // вычисляем баллы по темам для последнего проверенного пакета (approved/rejected)
        try {
          const sols = Array.isArray(mySols?.solutions) ? mySols.solutions : []
          // карта taskId -> topicId и topicId -> maxPoints
          const taskToTopic = new Map()
          const topicMax = new Map()
          for (const t of arr) {
            const max = (Array.isArray(t.tasks) ? t.tasks : []).reduce((acc, tk) => {
              taskToTopic.set(Number(tk.id), Number(t.id))
              return acc + Math.max(0, Number(tk.points || 0))
            }, 0)
            topicMax.set(Number(t.id), max)
          }
          // последняя проверенная отправка по теме
          const reviewedLatestByTopic = new Map()
          const reviewed = subs.filter(b => b.status === 'approved' || b.status === 'rejected')
          reviewed.sort((a,b)=>{
            const ad = new Date(a.updated_at || a.created_at || 0).getTime()
            const bd = new Date(b.updated_at || b.created_at || 0).getTime()
            if (bd !== ad) return bd - ad
            return (b.id||0) - (a.id||0)
          })
          for (const b of reviewed) {
            if (!reviewedLatestByTopic.has(Number(b.topic_id))) reviewedLatestByTopic.set(Number(b.topic_id), b)
          }
          // суммируем по решениям только из последнего проверенного батча
          const scores = {}
          for (const [tid, batch] of reviewedLatestByTopic) {
            const batchId = Number(batch.id)
            const earned = sols
              .filter(s => Number(s.batch_id || 0) === batchId)
              .reduce((acc, s) => acc + Math.max(0, Number(s.awarded_points || 0)), 0)
            const max = topicMax.get(Number(tid)) || 0
            const percent = max > 0 ? Math.round((earned / max) * 100) : 0
            scores[tid] = { earned, max, percent, reviewedBatchId: batchId }
          }
          setTopicScores(scores)
        } catch {}

        // если по теме больше нет pending — очищаем локальные ключи античита/сессии, чтобы не "висели" предупреждения после админского сброса
        try {
          const uid = user?.id || 'anon'
          for (const t of mapped) {
            const tid = String(t.id)
            const isPending = pendingByTopic.has(tid)
            // не трогаем активную сессию данной темы
            if (String(selectedTopicId || '') === tid) continue
            if (!isPending) {
              const antiPrefix = `ytme133_task_${uid}_topic-${tid}`
              const antiStateKey = antiPrefix + '_state'
              const sessionKey = `topic_session_${uid}_${tid}`
              // если есть следы античита/сессии — удалим
              if (localStorage.getItem(antiStateKey)) localStorage.removeItem(antiStateKey)
              if (localStorage.getItem(antiPrefix)) localStorage.removeItem(antiPrefix)
              if (localStorage.getItem(sessionKey)) localStorage.removeItem(sessionKey)
            }
          }
        } catch {}
      } catch (e) {
        if (!mounted) return
        setError(e.message || 'Не удалось загрузить темы')
      } finally { if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [token, selectedTopicId, user?.id])

  // hydrate/persist session for selected topic
  useEffect(() => {
    // при смене темы восстанавливаем сохранённую сессию (если она есть)
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const s = JSON.parse(raw)
        setStarted(!!s.started)
        setCurrent(Number.isFinite(s.current) ? s.current : 0)
        setAnswers(s.answers || {})
      }
      // если сохранённого состояния нет — не трогаем текущие started/current/answers
      // (это важно при мгновенном старте с карточки темы, чтобы не всплывало второе «Начать»)
    } catch {}
  }, [storageKey])
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ started, current, answers })) } catch {}
  }, [storageKey, started, current, answers])

  function startSession(topicId) {
    // Не позволяем начинать, если по теме уже есть незавершённая отправка
    const existing = (Array.isArray(topics) ? topics : []).find(t => String(t.id) === String(topicId))
    setSelectedTopicId(topicId)
    setStarted(true)
    setCurrent(0)
    try {
      const key = `topic_session_${user?.id || 'anon'}_${topicId}`
      localStorage.setItem(key, JSON.stringify({ started: true, current: 0, answers: {} }))
    } catch {}
  }

  function updateAnswer(taskId, val) {
    setAnswers(prev => ({ ...prev, [taskId]: val }))
  }

  async function submitAll() {
    setMsg(''); setSubmitting(true)
    try {
      if (!token) throw new Error('Войдите, чтобы отправить решения')
      if (anti.locked) throw new Error('Дождитесь окончания блокировки и попробуйте снова')
      if (anti.finalOpen) throw new Error('Сессия заблокирована из-за нарушений')
      const total = tasks.length
      const payloads = tasks.map(t => ({ id: t.id, code: (answers?.[t.id] || '').trim() }))
      const toSend = payloads.filter(p => p.code)
      if (toSend.length !== total) throw new Error('Заполните ответы на все задания перед отправкой')
      const topicIdGuess = selectedTopicId || tasks[0]?.topic_id
      if (!topicIdGuess) throw new Error('У заданий не указана тема')
      const answersMap = {}
      for (const p of toSend) answersMap[p.id] = p.code
  await api.post(`/topics/${topicIdGuess}/submit`, { answers: answersMap }, token)
      setMsg(`Отправлено ${total} решений. Статусы появятся после проверки.`)
      // Очистим локальные ответы, но можно оставить по желанию
      setAnswers({}); setStarted(false); setSelectedTopicId(null)
      try { localStorage.removeItem(storageKey) } catch {}
      try { await anti.stop() } catch {}
    } catch (e) {
      setMsg(e.message || 'Ошибка отправки')
    } finally { setSubmitting(false) }
  }

  // Start/stop anti-cheat along with session lifecycle
  useEffect(() => {
    if (started && user?.id) {
      anti.start()
      return () => { try { anti.routeLeave({ reason: 'unmount' }) } catch {} }
    }
    // when session not started, ensure guard is off
    return () => {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, selectedTopicId, user?.id])

  // Авто-досрочная отправка при финальном нарушении (3 предупреждения)
  useEffect(() => {
    if (!started) return
    if (!anti.finalOpen) return
    (async () => {
      try {
        if (!token) return
        const total = tasks.length
        const payloads = tasks.map(t => ({ id: t.id, code: (answers?.[t.id] || '').trim() }))
        const toSend = payloads.filter(p => p.code)
        const topicIdGuess = selectedTopicId || tasks[0]?.topic_id
        const answersMap = {}
        for (const p of toSend) answersMap[p.id] = p.code
        // даже если ответов 0 — всё равно создаём пакет, чтобы зафиксировать auto_fail и заблокировать повторный старт
        await api.post(`/topics/${topicIdGuess}/submit`, { answers: answersMap, reason: 'auto_fail' }, token)
        // мгновенно обновим бейджи тем без перезагрузки страницы
        try {
          const mySub = await api.get('/my/topicSubmissions', token)
          const subs = Array.isArray(mySub?.submissions) ? mySub.submissions : []
          const pendingByTopic = new Set(subs.filter(b => String(b.status) === 'pending').map(b => String(b.topic_id)))
          setTopics(prev => (Array.isArray(prev) ? prev.map(t => ({ ...t, _pending: pendingByTopic.has(String(t.id)) })) : prev))
          // Пересчёт topicScores после авто-пакета не делаем здесь (он pending). После модерации пересчитается при загрузке.
        } catch {}
        setMsg(`Сессия завершена: отправлено ${toSend.length} из ${total} решений из-за 3 предупреждений.`)
        setAnswers({}); setStarted(false); setSelectedTopicId(null)
        try { localStorage.removeItem(storageKey) } catch {}
        try { await anti.stop() } catch {}
      } catch (e) {
        // молча игнорируем или показываем краткую ошибку
        setMsg('Сессия завершена из-за нарушений, но отправка не удалась. Попробуйте обновить страницу.')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anti.finalOpen])

  return (
    <section className="mx-auto max-w-5xl px-6 py-8">
      {!token && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-900/30 dark:text-violet-200">
          Зарегистрируйтесь, чтобы начать выполнять задания!
        </div>
      )}
      {!started && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/60 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-violet-700 dark:text-violet-300">{selectedTopic ? selectedTopic.name : 'Выберите тему'}</h1>
              {!selectedTopic && (
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                  Выберите тему, чтобы приступить к заданиям. Ответы по теме отправляются одним пакетом.
                </p>
              )}
              {selectedTopic && <p className="mt-1 text-zinc-700 dark:text-zinc-300">Набор из {tasks.length} заданий. Можно решать в любом порядке. Отправка — одним пакетом.</p>}
            </div>
            {!selectedTopic ? null : (
              <button className="btn" onClick={() => startSession(selectedTopic.id)} disabled={loading || !!error || tasks.length===0 || !token}>Начать</button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {loading && <div className="text-zinc-500 dark:text-zinc-400">Загрузка…</div>}
        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

        {!selectedTopic && !loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(topics || []).map(tp => (
              <div key={tp.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-violet-700 dark:text-violet-300">{tp.name}</h3>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">Заданий: {Array.isArray(tp.tasks) ? tp.tasks.length : 0}</div>
                    {tp._pending && (
                      <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">У вас уже есть отправка этой темы на проверке</div>
                    )}
                    {tp.is_locked && (!user || (user.role === 'student')) && (
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Тема ещё не открыта преподавателем</div>
                    )}
                  </div>
                  {(() => {
                    const score = topicScores?.[tp.id]
                    if (score && Number.isFinite(score.percent)) {
                      const p = score.percent
                      // цвета: <50 красный, 50-69 жёлтый, 70-89 синий, 90+ зелёный
                      const cls = p < 50
                        ? 'bg-rose-600 text-white'
                        : (p < 70
                          ? 'bg-amber-500 text-white'
                          : (p < 90
                            ? 'bg-sky-600 text-white'
                            : 'bg-emerald-600 text-white'))
                      return (
                        <div className={`rounded-full px-4 py-2 text-sm font-medium ${cls}`} title={`Баллы: ${score.earned}`}>
                          {score.earned}
                        </div>
                      )
                    }
                    const lockedForStudent = tp.is_locked && (!user || user.role === 'student')
                    return (
                      <button className="btn" onClick={() => startSession(tp.id)} disabled={!Array.isArray(tp.tasks) || tp.tasks.length === 0 || tp._pending || lockedForStudent || !token}>
                        {lockedForStudent ? '🔒 Закрыто' : (!token ? 'Войдите, чтобы начать' : 'Начать')}
                      </button>
                    )
                  })()}
                </div>
              </div>
            ))}
            {(topics || []).length === 0 && (
              <div className="text-zinc-500 dark:text-zinc-400">Тем пока нет.</div>
            )}
          </div>
        )}

        {selectedTopic && started && tasks.length > 0 && (
          <>
            <ProgressBar value={answeredCount} total={tasks.length} />

            {/* шаги 1..N */}
            <div className="flex flex-wrap gap-2">
              {tasks.map((t, idx) => {
                const active = idx === current
                const done = !!(answers?.[t.id]?.trim())
                const cls = active
                  ? 'bg-violet-600 text-white border-violet-500'
                  : done
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700'
                return (
                  <button key={t.id} className={`rounded-full border px-3 py-1 text-sm transition ${cls}`} onClick={() => setCurrent(idx)}>
                    {idx+1}
                  </button>
                )
              })}
            </div>

            {/* античит-плашка над заданием */}
            <div className="-mt-2">
              <AntiCheatBanner
                started={anti.started}
                attempts={anti.attempts}
                warningOpen={anti.warningOpen}
                finalOpen={anti.finalOpen}
                locked={anti.locked}
                lockRemaining={anti.lockRemaining}
                onCloseWarning={anti.acknowledgeWarning}
                onGoHome={async () => { try { await anti.stop() } catch {}; window.location.href = '/'; }}
                maxWarnings={3}
              />
            </div>

            {/* текущее задание */}
            {tasks[current] && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">Задание {current+1} из {tasks.length}</div>
                <h3 className="mt-1 text-lg font-semibold text-violet-700 dark:text-violet-300">{tasks[current].title}</h3>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono">{tasks[current].description}</p>
                <textarea
                  className="mt-3 input h-44 font-mono"
                  placeholder="# Введите решение на Python"
                  value={answers?.[tasks[current].id] || ''}
                  onChange={(e) => updateAnswer(tasks[current].id, e.target.value)}
                  disabled={anti.locked || anti.finalOpen}
                />
                {current !== tasks.length - 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn" onClick={() => setCurrent((i) => Math.min(tasks.length-1, i+1))} disabled={anti.locked || anti.finalOpen}>Решить позже →</button>
                    <button type="button" className="btn-success" onClick={() => setCurrent((i) => Math.min(tasks.length-1, i+1))} disabled={!answers?.[tasks[current].id]?.trim() || anti.locked || anti.finalOpen}>Сохранить и далее</button>
                  </div>
                )}
              </motion.div>
            )}

            {current === tasks.length - 1 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Заполнено {answeredCount} из {tasks.length}</div>
                  <button className="btn" onClick={submitAll} disabled={answeredCount !== tasks.length || submitting || !token || anti.locked || anti.finalOpen}>{submitting ? 'Отправка…' : 'Отправить все решения'}</button>
                </div>
                {(!token) && <div className="text-xs text-zinc-500 dark:text-zinc-400">Войдите, чтобы отправить решения</div>}
                {msg && <div className="text-sm text-zinc-700 dark:text-zinc-300">{msg}</div>}
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
