import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../auth.jsx'

export default function TopicsAdmin() {
  const { token, user } = useAuth()
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', sort_order: '', count: '10' })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', sort_order: '' })

  const canEdit = user && (user.role === 'admin' || user.role === 'superadmin')

  async function load() {
    setLoading(true); setError('')
    try {
      const resp = await api.get('/topics', token)
      const arr = Array.isArray(resp?.topics) ? resp.topics : []
      setTopics(arr)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const [creating, setCreating] = useState(false)

  async function submit(e) {
    e?.preventDefault?.()
    setCreating(true)
    try {
      const resp = await api.post('/topics', {
        name: form.name,
        description: form.description || null,
        sort_order: form.sort_order === '' ? null : Number(form.sort_order)
      }, token)
      const newTopic = resp?.topic
      const count = Math.max(0, Math.min(100, Number(form.count || 0)))
      if (newTopic && newTopic.id && count > 0) {
        for (let i = 1; i <= count; i++) {
          await api.post('/tasks', {
            title: `Задание ${i}`,
            description: 'Опишите условие задания',
            difficulty: 'easy',
            points: 1,
            topic_id: newTopic.id
          }, token)
        }
      }
      setAdding(false); setForm({ name: '', description: '', sort_order: '', count: '10' })
      await load()
    } catch (err) {
      // отобразим ошибку сверху
      setError(err.message || 'Ошибка создания темы')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(tp) {
    setEditingId(tp.id)
    setEditForm({ name: tp.name, description: tp.description || '', sort_order: tp.sort_order ?? '' })
  }

  async function saveEdit(id) {
    await api.put(`/topics/${id}`, {
      name: editForm.name,
      description: editForm.description || null,
      sort_order: editForm.sort_order === '' ? null : Number(editForm.sort_order)
    }, token)
    setEditingId(null)
    await load()
  }

  const [confirm, setConfirm] = useState({ open: false, id: null, name: '', tasksCount: 0, solutionsCount: 0, busy: false })
  async function askRemove(tp) {
    // Подтягиваем точные цифры из /topics/:id/stats
    try {
      setConfirm(prev => ({ ...prev, open: true, id: tp.id, name: tp.name, busy: true }))
      const stats = await api.get(`/topics/${tp.id}/stats`, token)
      setConfirm({ open: true, id: tp.id, name: tp.name, tasksCount: stats?.tasks_count || 0, solutionsCount: stats?.solutions_count || 0, busy: false })
    } catch {
      // fallback на локальные данные, если не доступно
      const tasksCount = Array.isArray(tp.tasks) ? tp.tasks.length : 0
      setConfirm({ open: true, id: tp.id, name: tp.name, tasksCount, solutionsCount: 0, busy: false })
    }
  }
  async function removeConfirmed() {
    if (!confirm.id || confirm.busy) return
    setConfirm(prev => ({ ...prev, busy: true }))
    try {
      await api.delete(`/topics/${confirm.id}`, token)
      setConfirm({ open: false, id: null, name: '', tasksCount: 0, solutionsCount: 0, busy: false })
      await load()
    } catch {
      setConfirm(prev => ({ ...prev, busy: false }))
    }
  }

  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_,i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-zinc-200 dark:border-zinc-800" />)}</div>
  if (error) return <div className="text-sm text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Темы</h3>
        {canEdit && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>Добавить тему</button>
        )}
      </div>

      {adding && canEdit && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow dark:border-zinc-800 dark:bg-zinc-900">
          <input className="input" placeholder="Название темы" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <textarea className="input h-24" placeholder="Описание (необязательно)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input type="number" className="input" placeholder="Порядок сортировки (необязательно)" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
          <input type="number" className="input" min={0} max={100} placeholder="Количество задач (создать сразу)" value={form.count} onChange={e => setForm({ ...form, count: e.target.value })} />
          <div className="flex gap-2">
            <button type="submit" className="btn" disabled={creating}>{creating ? 'Создаём…' : 'Сохранить'}</button>
            <button type="button" className="btn" disabled={creating} onClick={() => setAdding(false)}>Отмена</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {topics.map(tp => (
          <div key={tp.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
            {editingId === tp.id ? (
              <div className="space-y-2">
                <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                <textarea className="input h-24" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                <input type="number" className="input" value={editForm.sort_order} onChange={e => setEditForm({ ...editForm, sort_order: e.target.value })} />
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={() => saveEdit(tp.id)}>Сохранить</button>
                  <button type="button" className="btn" onClick={() => setEditingId(null)}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-base font-semibold text-violet-700 dark:text-violet-300">{tp.name}</h4>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-line">{tp.description || 'Без описания'}{typeof tp.sort_order === 'number' ? ` • Порядок: ${tp.sort_order}` : ''}</div>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button type="button" className="btn" onClick={() => startEdit(tp)}>Редактировать</button>
                    <button type="button" className="btn" onClick={() => askRemove(tp)}>Удалить</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {topics.length === 0 && (
          <div className="text-zinc-400">Тем пока нет.</div>
        )}
      </div>

      {confirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <h4 className="text-lg font-semibold">Удаление темы</h4>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Удалить тему <span className="font-semibold">{confirm.name}</span>? Это действие необратимо.
              {confirm.busy ? (
                <> Загружаем статистику…</>
              ) : (
                <>
                  {confirm.tasksCount > 0 ? (
                    <> Будут также удалены все задания этой темы ({confirm.tasksCount}) и их решения{typeof confirm.solutionsCount === 'number' ? ` (${confirm.solutionsCount})` : ''}.</>
                  ) : (
                    <> В этой теме нет заданий.</>
                  )}
                </>
              )}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn" disabled={confirm.busy} onClick={() => setConfirm({ open: false, id: null, name: '', tasksCount: 0, solutionsCount: 0, busy: false })}>Отмена</button>
              <button type="button" className="btn" disabled={confirm.busy} onClick={removeConfirmed}>{confirm.busy ? 'Удаление…' : 'Удалить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
