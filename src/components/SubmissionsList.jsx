import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../auth.jsx'
import Modal from './Modal.jsx'

function StatusPill({ status }) {
  const map = {
    correct: { class: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30', label: 'Одобрено' },
    wrong: { class: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30', label: 'Отклонено' },
    pending: { class: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30', label: 'На проверке' }
  }
  const m = map[status] || { class: 'bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30', label: String(status || '—') }
  return <span className={`rounded-full px-2 py-0.5 text-xs ${m.class}`}>{m.label}</span>
}

export default function SubmissionsList() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subs, setSubs] = useState([])
  // Модалка просмотра состава пакета
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchDetails, setBatchDetails] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)

  async function load() {
    setLoading(true); setError('')
    try {
      const data = await api.get('/topicSubmissions', token)
      const arr = Array.isArray(data?.submissions) ? data.submissions : []
      // Показываем только заявки "на проверке"
      setSubs(arr.filter(s => (s.status || 'pending') === 'pending'))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function openBatch(id) {
    try {
      setBusyId(id)
      const data = await api.get(`/topicSubmissions/${id}`, token)
      setBatchDetails(data)
      setBatchOpen(true)
      setActiveIndex(0)
    } catch (e) {
      setError(e.message)
    } finally { setBusyId(null) }
  }

  // Форматирование даты в GMT+5 (Астана). Предполагаем, что created_at в БД в UTC.
  function parseUtcFromSqlite(str) {
    if (!str) return new Date()
    // SQLite обычно отдаёт 'YYYY-MM-DD HH:mm:ss' без Z — считаем это UTC
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(String(str))) {
      return new Date(String(str).replace(' ', 'T') + 'Z')
    }
    // Иначе доверяем конструктору
    return new Date(str)
  }
  function formatGMTPlus5(strOrDate) {
    const base = strOrDate instanceof Date ? strOrDate : parseUtcFromSqlite(strOrDate)
    const utcMs = base.getTime()
    const shifted = new Date(utcMs + 5 * 60 * 60 * 1000) // +5 часов
    const dd = String(shifted.getUTCDate()).padStart(2, '0')
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = shifted.getUTCFullYear()
    const hh = String(shifted.getUTCHours()).padStart(2, '0')
    const mi = String(shifted.getUTCMinutes()).padStart(2, '0')
    // сокращаем — без секунд
    return `${dd}.${mm}.${yyyy}, ${hh}:${mi}`
  }

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_,i) => <div key={i} className="h-14 animate-pulse rounded-xl border border-zinc-200 dark:border-zinc-800" />)}</div>
  if (error) return <div className="text-sm text-red-500">{error}</div>

  return (
    <div className="space-y-2">
      <div className="hidden md:grid gap-2 rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900/40 md:[grid-template-columns:1.6fr_1.6fr_0.6fr_0.9fr_1fr_auto]">
        <div>Пользователь</div>
        <div>Тема</div>
        <div>Ответы</div>
        <div>Статус</div>
        <div className="text-right">Дата</div>
        <div className="text-right pr-2">Действия</div>
      </div>
      {subs.map(s => (
        <div key={s.id} className="grid grid-cols-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 md:[grid-template-columns:1.6fr_1.6fr_0.6fr_0.9fr_1fr_auto]">
          <div className="min-w-0 truncate" title={s.user_email || ''}>{s.user_email || 'user'}</div>
          <div className="min-w-0 truncate" title={s.topic_name || ''}>{s.topic_name || 'topic'}</div>
          <div className="text-sm">
            {s.answers_count ?? 0}
            {Number(s.auto_fail_count||0) > 0 && (
              <span title="Автоматическое завершение из-за нарушений" className="ml-2 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300 ring-1 ring-rose-500/30 align-middle">auto</span>
            )}
          </div>
          <div><StatusPill status={(s.status === 'approved') ? 'correct' : (s.status === 'rejected' ? 'wrong' : 'pending')} /></div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 text-right font-mono tabular-nums">{formatGMTPlus5(s.created_at || s.date || Date.now())}</div>
          <div className="md:text-right flex flex-wrap justify-start md:justify-end gap-2">
            <button
              type="button"
              className="btn btn-sm"
              disabled={busyId===s.id}
              onClick={() => openBatch(s.id)}
              title="Посмотреть ответы пакета"
            >
              Просмотр
            </button>
          </div>
        </div>
      ))}

      {subs.length === 0 && (
        <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">Нет заявок на проверку.</div>
      )}

      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title={batchDetails ? `Пакет: ${batchDetails.submission?.topic_name} — ${batchDetails.submission?.user_email}` : 'Пакет'} mode="modal">
        {!batchDetails ? (
          <div className="text-sm text-zinc-500">Загрузка…</div>
        ) : (
          <motion.div className="space-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}>
            {/* Навигация по заданиям */}
            <motion.div className="flex items-center justify-between" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
              <div className="text-sm text-zinc-500">Ответ {activeIndex + 1} из {(batchDetails.solutions || []).length}</div>
              <div className="flex gap-2">
                <button className="btn btn-sm" disabled={activeIndex<=0} onClick={() => setActiveIndex(i => Math.max(0, i-1))}>Предыдущее</button>
                <button className="btn btn-sm" disabled={activeIndex>=(batchDetails.solutions.length-1)} onClick={() => setActiveIndex(i => Math.min(batchDetails.solutions.length-1, i+1))}>Следующее</button>
              </div>
            </motion.div>

            {(() => {
              const sol = batchDetails.solutions[activeIndex]
              if (!sol) return null
              return (
                <AnimatePresence mode="wait">
                  <motion.div className="space-y-3" key={sol.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                    <div>
                      <div className="text-base font-semibold">{sol.task_title} <span className="text-xs text-zinc-500">({sol.task_points ?? 0} б.)</span></div>
                      {sol.task_description && (
                        <p className="mt-1 whitespace-pre-wrap font-mono text-sm text-zinc-700 dark:text-zinc-300">{sol.task_description}</p>
                      )}
                    </div>
                    <div>
                      <div className="mb-1 text-sm text-zinc-500">Код ученика:</div>
                      <pre className="max-h-80 overflow-auto rounded-xl bg-zinc-900 p-3 text-xs text-zinc-100 ring-1 ring-zinc-700"><code>{sol.code}</code></pre>
                    </div>
                    {(() => {
                      const hasAns = typeof sol.task_correct_answer !== 'undefined' && sol.task_correct_answer !== null && String(sol.task_correct_answer).length > 0
                      return (
                        <div>
                          <div className="mb-1 text-sm text-zinc-500">Правильный ответ:</div>
                          {hasAns ? (
                            <pre className="overflow-auto rounded-xl bg-zinc-800/70 p-3 text-xs text-zinc-100 ring-1 ring-zinc-700"><code>{String(sol.task_correct_answer)}</code></pre>
                          ) : (
                            <div className="text-xs text-zinc-500">Правильный ответ не указан для этой задачи.</div>
                          )}
                        </div>
                      )
                    })()}
                  </motion.div>
                </AnimatePresence>
              )
            })()}

            {/* Короткий обзор статусов внизу */}
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-500">
              {(batchDetails.solutions || []).map((x, idx) => (
                <div key={x.id} className={`flex items-center gap-2 rounded-lg border p-2 dark:border-zinc-800 ${idx===activeIndex? 'ring-1 ring-violet-500':''}`}>
                  <div className="w-5 text-right">{idx+1}.</div>
                  <div className="truncate text-zinc-300">{x.task_title}</div>
                  <div className="ml-auto"><StatusPill status={x.status==='correct'?'correct':(x.status==='wrong'?'wrong':'pending')} /></div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {batchDetails && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <button className="btn" onClick={() => setBatchOpen(false)}>Закрыть</button>
            {(() => {
              const sol = batchDetails.solutions[activeIndex]
              if (!sol) return null
              return (
                <div className="flex gap-2">
                  <button type="button" className="btn-danger" disabled={busyId===sol.id} onClick={async ()=>{
                    await api.patch(`/solutions/${sol.id}/status`, { status: 'wrong' }, token)
                    setBatchDetails(prev=>{
                      const n = { ...prev, solutions: prev.solutions.map(x=>x.id===sol.id? { ...x, status:'wrong'}:x) }
                      const remaining = n.solutions.some(x=>x.status==='pending')
                      if (!remaining) { setBatchOpen(false); setSubs(prevSubs => prevSubs.filter(s => s.id !== n.submission.id)) }
                      else { setActiveIndex(i => Math.min(n.solutions.length-1, i+1)) }
                      return n
                    })
                  }}>Отклонить</button>
                  <button type="button" className="btn-success" disabled={busyId===sol.id} onClick={async ()=>{
                    await api.patch(`/solutions/${sol.id}/status`, { status: 'correct' }, token)
                    setBatchDetails(prev=>{
                      const n = { ...prev, solutions: prev.solutions.map(x=>x.id===sol.id? { ...x, status:'correct'}:x) }
                      const remaining = n.solutions.some(x=>x.status==='pending')
                      if (!remaining) { setBatchOpen(false); setSubs(prevSubs => prevSubs.filter(s => s.id !== n.submission.id)) }
                      else { setActiveIndex(i => Math.min(n.solutions.length-1, i+1)) }
                      return n
                    })
                  }}><Check size={16} className="mr-1"/>Одобрить</button>
                </div>
              )
            })()}
          </div>
        )}
      </Modal>
    </div>
  )
}
