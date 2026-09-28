import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api.js'
import { useAuth } from '../auth.jsx'
import Modal from './Modal.jsx'

function StatusPill({ status }) {
  const map = {
    approved: { class: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30', label: 'Одобрено' },
    rejected: { class: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30', label: 'Отклонено' },
    pending: { class: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30', label: 'На проверке' }
  }
  const m = map[status] || { class: 'bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30', label: String(status || '—') }
  return <span className={`rounded-full px-2 py-0.5 text-xs ${m.class}`}>{m.label}</span>
}

export default function HistoryList() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState(null)
  const [expanded, setExpanded] = useState({}) // id -> bool
  const [sortBy, setSortBy] = useState('updated_desc')
  const [delOpen, setDelOpen] = useState(false)
  const [delTarget, setDelTarget] = useState(null)
  const [delBusy, setDelBusy] = useState(false)
  const [delError, setDelError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const data = await api.get('/topicSubmissions', token)
      const arr = Array.isArray(data?.submissions) ? data.submissions : []
      // В истории показываем только завершённые пакеты
      const completed = arr.filter(b => b.status === 'approved' || b.status === 'rejected')
      setRows(applySort(completed, sortBy))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [sortBy])

  function applySort(arr, order) {
    const copy = [...arr]
    const getTime = (b) => new Date(b.updated_at || b.created_at || 0).getTime()
    if (order === 'updated_asc') copy.sort((a,b)=> getTime(a)-getTime(b))
    else copy.sort((a,b)=> getTime(b)-getTime(a))
    return copy
  }

  // GMT+5 форматирование
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

  async function openDetails(id) {
    try {
      const data = await api.get(`/topicSubmissions/${id}`, token)
      setDetails(data)
      setOpen(true)
      setExpanded({})
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_,i) => <div key={i} className="h-14 animate-pulse rounded-xl border border-zinc-200 dark:border-zinc-800" />)}</div>
  if (error) return <div className="text-sm text-red-500">{error}</div>

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">История ответов</h3>
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-500">Сортировка:</label>
        <select className="input h-9 min-w-[14rem] whitespace-nowrap" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="updated_desc">Сначала новые</option>
          <option value="updated_asc">Сначала старые</option>
        </select>
        <button className="btn btn-sm" onClick={load}>Обновить</button>
      </div>
      <div className="hidden md:grid grid-cols-6 gap-2 rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900/40">
        <div>Пользователь</div>
        <div>Тема</div>
        <div>Ответы</div>
        <div>Статус</div>
        <div>Дата</div>
        <div className="text-right pr-2">Действия</div>
      </div>
      {rows.map(b => (
        <div key={b.id} className="grid grid-cols-1 md:grid-cols-6 items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <div className="truncate">{b.user_email || 'user'}</div>
          <div className="truncate">{b.topic_name || 'topic'}</div>
          <div className="text-sm">{b.answers_count ?? 0}</div>
          <div><StatusPill status={b.status} /></div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">{formatGMTPlus5(b.updated_at || b.created_at)}</div>
          <div className="md:text-right flex gap-2 justify-start md:justify-end">
            <button type="button" className="btn btn-sm" onClick={() => openDetails(b.id)}>Просмотр</button>
            <button type="button" className="btn btn-sm" onClick={()=>{ setDelTarget(b); setDelError(''); setDelOpen(true); }}>Удалить</button>
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">История пуста.</div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={details ? `Пакет: ${details.submission?.topic_name} — ${details.submission?.user_email}` : 'Пакет'} mode="modal">
        {!details ? (
          <div className="text-sm text-zinc-500">Загрузка…</div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const sols = details.solutions || []
              const earned = sols.reduce((a, s) => a + (Number.isFinite(Number(s.awarded_points)) ? Number(s.awarded_points) : 0), 0)
              const max = sols.reduce((a, s) => a + Math.max(0, Number(s.task_points || 0)), 0)
              return (
                <div className="mb-1 text-sm text-zinc-500">
                  Итого по пакету: <span className="font-medium text-zinc-200">{earned} / {max} б.</span>
                </div>
              )
            })()}
            {(details.solutions || []).map(sol => {
              const isOpen = !!expanded[sol.id]
              return (
                <div key={sol.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-violet-50/50 dark:hover:bg-violet-500/10 transition-colors"
                    onClick={() => setExpanded(prev => ({ ...prev, [sol.id]: !prev[sol.id] }))}
                  >
                    <div className="text-sm font-medium">
                      {sol.task_title} <span className="text-xs text-zinc-500">({sol.task_points ?? 0} б.)</span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <span
                        className={`text-xs ${sol.status === 'correct' ? 'text-emerald-400' : sol.status === 'wrong' ? 'text-rose-400' : 'text-zinc-500'}`}
                        title="Начисленные баллы"
                      >
                        {(Number.isFinite(Number(sol.awarded_points)) ? Number(sol.awarded_points) : 0)} б.
                      </span>
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
          <button className="btn" onClick={() => setOpen(false)}>Закрыть</button>
        </div>
      </Modal>

      {/* Confirm delete modal */}
      <Modal open={delOpen} onClose={() => (delBusy ? null : setDelOpen(false))} title="Удалить пакет" mode="modal">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Вы уверены, что хотите удалить пакет
          {' '}<span className="font-semibold">{delTarget?.topic_name}</span>{' '}
          пользователя <span className="font-semibold">{delTarget?.user_email}</span>? Это действие необратимо.
        </p>
        {delError && <div className="mt-2 text-sm text-rose-400">{delError}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setDelOpen(false)} disabled={delBusy}>Отмена</button>
          <button type="button" className="btn" disabled={delBusy} onClick={async()=>{
            if (!delTarget) return
            setDelBusy(true)
            setDelError('')
            try {
              await api.delete(`/topicSubmissions/${delTarget.id}`, token)
              setRows(prev => prev.filter(x => x.id !== delTarget.id))
              setDelOpen(false); setDelTarget(null)
            } catch (e) {
              const msg = String(e?.message || '')
              setDelError(msg.includes('404') ? '404 Not Found — возможно, сервер ещё не перезапущен. Перезапустите backend и попробуйте снова.' : msg)
            } finally { setDelBusy(false) }
          }}>{delBusy ? 'Удаление…' : 'Удалить'}</button>
        </div>
      </Modal>
    </div>
  )
}
