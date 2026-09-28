import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../auth.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import Modal from './Modal.jsx'

export default function TasksAdmin() {
  const { token } = useAuth()
  const [tasks, setTasks] = useState([])
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  // Форма батч-создания задач под тему
  const [form, setForm] = useState({
    topic_id: '',
    new_topic_name: '',
    count: '10',
    difficulty: 'easy',
    points: '1',
    title_prefix: 'Задание',
    description: 'Опишите условие задания'
  })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', difficulty: 'easy', points: 0, correct_answer: '', topic_id: '', new_topic_name: '' })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  // Подтверждение удаления темы (группы)
  const [topicConfirm, setTopicConfirm] = useState({ open: false, id: null, name: '', tasksCount: 0, solutionsCount: 0, busy: false })
  // Эфемерное состояние раскрытия групп без сохранения в localStorage
  const [open, setOpen] = useState({})

  async function load() {
    setLoading(true); setError('')
    try {
      // NOTE: tasks endpoint. Adjust base via VITE_API_BASE if needed
      const t = await api.get('/tasks', token)
      const arr = Array.isArray(t?.tasks) ? t.tasks : (Array.isArray(t) ? t : [])
      setTasks(arr)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  async function loadTopics() {
    try {
      const res = await api.get('/topics', token)
      const arr = Array.isArray(res?.topics) ? res.topics : (Array.isArray(res) ? res : [])
      // normalize to id/name only for select
      setTopics(arr.map(t => ({ id: t.id, name: t.name, is_locked: !!t.is_locked })))
    } catch (e) {
      // don't block UI, but log error
      console.error('Failed to load topics:', e)
    }
  }
  useEffect(() => { load(); loadTopics() }, [])

  const topicNameById = (id) => {
    if (!id) return 'Без темы'
    const found = topics.find(t => String(t.id) === String(id))
    return found?.name || 'Без темы'
  }

  const topicById = (id) => topics.find(t => String(t.id) === String(id))

  async function setTopicLock(id, lock) {
    try {
      await api.patch(`/topics/${id}/lock`, { is_locked: lock ? 1 : 0 }, token)
      await loadTopics()
    } catch (e) {
      console.error('Failed to change lock:', e)
    }
  }

  async function ensureTopicId(selectedId, newName) {
    const name = (newName || '').trim()
    if (name) {
      try {
        const res = await api.post('/topics', { name }, token)
        const created = res?.topic
        if (created?.id) {
          setTopics(prev => {
            const exists = prev.some(t => String(t.id) === String(created.id))
            return exists ? prev : [...prev, { id: created.id, name: created.name }]
          })
          return Number(created.id)
        }
      } catch (e) {
        // если тема с таким именем уже существует — найдём её в списке
        const found = topics.find(t => String(t.name).toLowerCase() === name.toLowerCase())
        if (found) return Number(found.id)
        throw e
      }
    }
    if (selectedId) return Number(selectedId)
    return null
  }

  async function submit(e) {
    e?.preventDefault?.()
    try {
      setBusy(true); setError('')
      if (!form.topic_id && !String(form.new_topic_name || '').trim()) {
        throw new Error('Выберите тему или введите название новой темы')
      }
      const topicId = await ensureTopicId(form.topic_id, form.new_topic_name)
      const count = Math.max(1, Math.min(200, Number(form.count || 0)))
      const pts = Math.max(0, Math.floor(Number(form.points || 0)))
      const createdTasks = []
      for (let i = 1; i <= count; i++) {
        const title = `${form.title_prefix || 'Задание'} ${i}`
        const resp = await api.post('/tasks', {
          title,
          description: form.description || '',
          difficulty: form.difficulty || 'easy',
          points: pts,
          topic_id: topicId
        }, token)
        if (resp?.task) createdTasks.push(resp.task)
      }
      // мгновенно показываем созданные задачи без ожидания повторной загрузки
      if (createdTasks.length) {
        setTasks(prev => [...createdTasks, ...prev])
      }
      setAdding(false)
      setForm({ topic_id: '', new_topic_name: '', count: '10', difficulty: 'easy', points: '1', title_prefix: 'Задание', description: 'Опишите условие задания' })
      // Перезагрузим и раскроем созданную тему
  await Promise.all([loadTopics(), load()])
  // просто раскроем нужную тему в текущей сессии (без persist)
  setOpen(o => ({ ...o, [String(topicId)]: true }))
    } catch (e) {
      setError(e.message || 'Не удалось сохранить задачу')
    } finally { setBusy(false) }
  }

  function startEdit(task) {
  setEditingId(task.id)
  setEditForm({ title: task.title, description: task.description, difficulty: task.difficulty, points: task.points || 0, correct_answer: task.correct_answer || '', topic_id: task.topic_id ?? '', new_topic_name: '' })
  }

  async function saveEdit(id) {
    try {
      setBusy(true); setError('')
      const topicId = await ensureTopicId(editForm.topic_id, editForm.new_topic_name)
      await api.put(`/tasks/${id}`, { title: editForm.title, description: editForm.description, difficulty: editForm.difficulty, points: Number(editForm.points) || 0, correct_answer: editForm.correct_answer, topic_id: topicId }, token)
      setEditingId(null)
      await load()
    } catch (e) {
      setError(e.message || 'Не удалось обновить задачу')
    } finally { setBusy(false) }
  }

  async function removeTask(id) { await api.delete(`/tasks/${id}`, token); await load() }
  function openDelete(task) { setTarget(task); setConfirmOpen(true) }
  async function removeTaskConfirmed() {
    if (!target) return
    setBusy(true)
    try {
      await removeTask(target.id)
      setConfirmOpen(false); setTarget(null)
    } catch (e) {
      setError(e.message)
    } finally { setBusy(false) }
  }

  // Удаление темы (группы)
  async function askRemoveTopic(group) {
    if (!group || group.id === 'none') return
    try {
      setTopicConfirm(prev => ({ ...prev, open: true, id: group.id, name: group.name, busy: true }))
      const stats = await api.get(`/topics/${group.id}/stats`, token)
      setTopicConfirm({ open: true, id: group.id, name: group.name, tasksCount: stats?.tasks_count || 0, solutionsCount: stats?.solutions_count || 0, busy: false })
    } catch {
      setTopicConfirm({ open: true, id: group.id, name: group.name, tasksCount: Array.isArray(group.tasks) ? group.tasks.length : 0, solutionsCount: 0, busy: false })
    }
  }
  async function removeTopicConfirmed() {
    if (!topicConfirm.id || topicConfirm.busy) return
    setTopicConfirm(prev => ({ ...prev, busy: true }))
    try {
      await api.delete(`/topics/${topicConfirm.id}`, token)
      // Закрыть модал, перезагрузить темы и задачи
      setTopicConfirm({ open: false, id: null, name: '', tasksCount: 0, solutionsCount: 0, busy: false })
      await Promise.all([loadTopics(), load()])
    } catch (e) {
      console.error(e)
      setTopicConfirm(prev => ({ ...prev, busy: false }))
    }
  }

  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_,i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-zinc-200 dark:border-zinc-800" />)}</div>
  if (error) return <div className="text-sm text-red-500">{error}</div>

  // Группировка задач по темам; группу "Без темы" не показываем
  const groups = (() => {
    const by = new Map()
    for (const tp of topics) by.set(String(tp.id), { id: String(tp.id), name: tp.name, tasks: [] })
    for (const t of tasks) {
      const key = t.topic_id != null ? String(t.topic_id) : ''
      if (key && by.has(key)) by.get(key).tasks.push(t)
      // задачи без темы не выводим в админском списке
    }
    const rest = Array.from(by.values())
    // можно отсортировать по имени темы для стабильности
    rest.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    return rest
  })()

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="text-lg font-semibold">Задачи</h3>
        <button type="button" className="btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAdding(true) }}>Создать набор задач</button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Выбрать тему</label>
                <select className="input" value={form.topic_id} onChange={e => setForm({ ...form, topic_id: e.target.value })}>
                  <option value="">— Создать новую —</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Название новой темы</label>
                <input className="input" placeholder="Например: Условный оператор" value={form.new_topic_name} onChange={e => setForm({ ...form, new_topic_name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Количество задач</label>
                <input type="number" min={1} max={200} className="input" placeholder="10" value={form.count}
                       onChange={e => setForm({ ...form, count: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Сложность по умолчанию</label>
                <select className="input" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                  <option value="easy">Лёгкое</option>
                  <option value="medium">Среднее</option>
                  <option value="hard">Сложное</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Баллы за задачу</label>
                <input type="number" min={0} className="input" placeholder="1" value={form.points}
                       onChange={e => setForm({ ...form, points: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Шаблон названия</label>
                <input className="input" placeholder="Задание" value={form.title_prefix}
                       onChange={e => setForm({ ...form, title_prefix: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Шаблон описания</label>
                <textarea className="input h-24" placeholder="Опишите условие задания" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Создаём…' : 'Создать'}</button>
              <button className="btn" type="button" onClick={() => setAdding(false)} disabled={busy}>Отмена</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {groups.map(group => {
          const isOpen = !!open[String(group.id)]
          return (
            <section key={group.id} className="rounded-2xl border border-zinc-200 bg-white shadow dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen(o => { const key = String(group.id); return { ...o, [key]: !o[key] } }) } }}
                onClick={() => setOpen(o => {
                  const key = String(group.id)
                  return { ...o, [key]: !o[key] }
                })}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-violet-50/50 dark:hover:bg-violet-500/10 transition-colors"
              >
                <div>
                  <h4 className="text-base font-semibold text-violet-700 dark:text-violet-300">{group.name}</h4>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Задач: {group.tasks.length}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`btn ${topicById(group.id)?.is_locked ? 'opacity-80' : ''}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTopicLock(group.id, !(topicById(group.id)?.is_locked)) }}
                    title={topicById(group.id)?.is_locked ? 'Разблокировать тему' : 'Заблокировать тему'}
                  >
                    {topicById(group.id)?.is_locked ? 'Разблокировать' : 'Заблокировать'}
                  </button>
                  {group.id !== 'none' && (
                    <button
                      type="button"
                      className="btn"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); askRemoveTopic(group) }}
                    >
                      Удалить тему
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn"
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      setOpen(o => { const key = String(group.id); return { ...o, [key]: !o[key] } })
                    }}
                  >
                    {isOpen ? 'Свернуть' : 'Раскрыть'}
                  </button>
                </div>
              </div>
              <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0.95 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.95 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{ transformOrigin: 'top' }}
                  className="space-y-3 p-4 pt-0 overflow-hidden"
                >
                  {group.tasks.map(t => (
                    <div key={t.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                      {editingId === t.id ? (
                        <div className="space-y-2">
                          <input className="input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                          <textarea className="input h-24" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                          <select className="input" value={editForm.difficulty} onChange={e => setEditForm({ ...editForm, difficulty: e.target.value })}>
                            <option value="easy">Лёгкое</option>
                            <option value="medium">Среднее</option>
                            <option value="hard">Сложное</option>
                          </select>
                          <select className="input" value={editForm.topic_id} onChange={e => setEditForm({ ...editForm, topic_id: e.target.value })}>
                            <option value="">Без темы</option>
                            {topics.map(tp => (
                              <option key={tp.id} value={tp.id}>{tp.name}</option>
                            ))}
                          </select>
                          <input className="input" placeholder="Новая тема (если нет в списке)" value={editForm.new_topic_name} onChange={e => setEditForm({ ...editForm, new_topic_name: e.target.value })} />
                          <input type="number" min={0} className="input" placeholder="Баллы за задачу" value={editForm.points}
                                 onChange={e => setEditForm({ ...editForm, points: e.target.value })} />
                          <input className="input" placeholder="Правильный ответ (опционально)" value={editForm.correct_answer} onChange={e => setEditForm({ ...editForm, correct_answer: e.target.value })} />
                          <div className="flex gap-2">
                            <button type="button" className="btn" disabled={busy} onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await saveEdit(t.id) }}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
                            <button type="button" className="btn" disabled={busy} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingId(null) }}>Отмена</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="text-base font-semibold text-violet-700 dark:text-violet-300">{t.title}</h4>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">Сложность: {{ easy: 'Лёгкое', medium: 'Среднее', hard: 'Сложное' }[t.difficulty] || t.difficulty} • Баллы: {t.points ?? 0} • Тема: {topicNameById(t.topic_id)}</div>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" className="btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEdit(t) }}>Редактировать</button>
                              <button type="button" className="btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDelete(t) }}>Удалить</button>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono">{t.description}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {group.tasks.length === 0 && (
                    <div className="text-zinc-500 dark:text-zinc-400">Пока задач нет.</div>
                  )}
                </motion.div>
              )}
              </AnimatePresence>
            </section>
          )
        })}
      </div>

      {/* Confirm delete task */}
      <Modal open={confirmOpen} onClose={() => (busy ? null : setConfirmOpen(false))} title="Удалить задачу" mode="modal">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Удалить задачу <span className="font-semibold">{target?.title}</span>? Это действие необратимо.</p>
        {error && <div className="mt-2 text-sm text-rose-400">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirmOpen(false)} disabled={busy}>Отмена</button>
          <button type="button" className="btn" onClick={removeTaskConfirmed} disabled={busy}>{busy ? 'Удаление…' : 'Удалить'}</button>
        </div>
      </Modal>

      {/* Confirm delete topic */}
      <Modal open={topicConfirm.open} onClose={() => (topicConfirm.busy ? null : setTopicConfirm({ open: false, id: null, name: '', tasksCount: 0, solutionsCount: 0, busy: false }))} title="Удалить тему" mode="modal">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Удалить тему <span className="font-semibold">{topicConfirm.name}</span>? Это действие необратимо.
          {topicConfirm.busy ? (
            <> Загружаем статистику…</>
          ) : (
            <>
              {topicConfirm.tasksCount > 0 ? (
                <> Будут также удалены все задания этой темы ({topicConfirm.tasksCount}) и их решения{typeof topicConfirm.solutionsCount === 'number' ? ` (${topicConfirm.solutionsCount})` : ''}.</>
              ) : (
                <> В этой теме нет заданий.</>
              )}
            </>
          )}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setTopicConfirm({ open: false, id: null, name: '', tasksCount: 0, solutionsCount: 0, busy: false })} disabled={topicConfirm.busy}>Отмена</button>
          <button type="button" className="btn" onClick={removeTopicConfirmed} disabled={topicConfirm.busy}>{topicConfirm.busy ? 'Удаление…' : 'Удалить'}</button>
        </div>
      </Modal>
    </div>
  )
}
