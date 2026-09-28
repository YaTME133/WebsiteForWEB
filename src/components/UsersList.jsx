import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../auth.jsx'
import Modal from './Modal.jsx'

const SkeletonRow = () => (
  <div className="animate-pulse rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
    <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" />
    <div className="mt-2 h-3 w-1/5 rounded bg-zinc-200 dark:bg-zinc-700" />
  </div>
)

export default function UsersList() {
  const { token, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [topics, setTopics] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdTarget, setPwdTarget] = useState(null)
  const [newPwd, setNewPwd] = useState('')
  const [reOpen, setReOpen] = useState(false)
  const [reUser, setReUser] = useState(null)
  const [reTopicId, setReTopicId] = useState(null)
  const [reAll, setReAll] = useState(false)
  const [reBusy, setReBusy] = useState(false)
  const [reError, setReError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      // NOTE: backend endpoint for users
      // Replace '/api/users' if your backend has a different route
  const data = await api.get('/users', token)
  const arr = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : [])
  setUsers(arr)
  // load auxiliary data for re-issue control
  const [tp, subs] = await Promise.all([
    api.get('/topics', token).catch(() => ({ topics: [] })),
    api.get('/topicSubmissions', token).catch(() => ({ submissions: [] }))
  ])
  setTopics(Array.isArray(tp?.topics) ? tp.topics : [])
  setSubmissions(Array.isArray(subs?.submissions) ? subs.submissions : [])
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function changeRole(id, role) {
    // NOTE: backend roles: 'student' | 'admin' | 'superadmin'
    if (user?.role !== 'superadmin') return // защита на стороне UI
    await api.patch(`/users/${id}/role`, { role }, token)
    await load()
  }

  function openDelete(u) { setTarget(u); setConfirmOpen(true); setError('') }
  function openResetPwd(u) { setPwdTarget(u); setNewPwd(''); setError(''); setPwdOpen(true) }
  async function removeUserConfirmed() {
    if (!target) return
    // Guards: нельзя удалить себя; нельзя удалять привилегированных без superadmin
    if (user?.id && target.id === user.id) { setError('Нельзя удалить свой аккаунт'); return }
    const isPriv = target.role === 'admin' || target.role === 'superadmin'
    if (isPriv && user?.role !== 'superadmin') { setError('Удаление администратора доступно только супер‑админу'); return }
    setBusy(true)
    try {
      // NOTE: users delete endpoint. If your backend uses different path, adjust here
      await api.delete(`/users/${target.id}`, token)
      setConfirmOpen(false)
      setTarget(null)
      await load()
    } catch (e) {
      const msg = (e?.message || '').includes('<') ? 'Не удалось удалить пользователя (маршрут недоступен). Проверьте перезапуск сервера и права.' : e.message
      setError(msg)
    } finally { setBusy(false) }
  }

  // Map submissions by user id for quick access
  const subsByUser = useMemo(() => {
    const map = new Map()
    for (const s of submissions) {
      if (!map.has(s.user_id)) map.set(s.user_id, [])
      map.get(s.user_id).push(s)
    }
    // sort per user by created_at desc, id desc
    for (const [k, arr] of map) {
      arr.sort((a,b)=>{
        const ad = new Date(a.created_at || 0).getTime()
        const bd = new Date(b.created_at || 0).getTime()
        if (bd !== ad) return bd - ad
        return (b.id||0) - (a.id||0)
      })
    }
    return map
  }, [submissions])

  // Latest submission by user+topic
  function getLatestByUserTopic(uid, topicId) {
    const arr = (subsByUser.get(uid) || []).filter(s => Number(s.topic_id) === Number(topicId))
    return arr[0] // subsByUser arrays are sorted desc
  }

  // Build full topics list with latest submission status for a user
  function getAllTopicsForUser(uid) {
    const list = topics.map(t => ({
      topic_id: t.id,
      topic_name: t.name,
      latest: getLatestByUserTopic(uid, t.id)
    }))
    list.sort((a,b)=> String(a.topic_name).localeCompare(String(b.topic_name), 'ru'))
    return list
  }

  function openReissue(u) {
    setReUser(u)
    setReError('')
    const list = getAllTopicsForUser(u.id)
    setReTopicId(list[0]?.topic_id ?? null)
    setReAll(false)
    setReOpen(true)
  }

  async function performReissue() {
    if (!reUser || !reTopicId) { setReError('Выберите тему'); return }
    const uid = reUser.id
    const allSubs = (subsByUser.get(uid) || []).filter(s => Number(s.topic_id) === Number(reTopicId))
    if (!allSubs.length) { setReError('Для выбранного пользователя нет попыток по этой теме'); return }
    const toDelete = reAll ? allSubs.map(s=>s.id) : [allSubs[0].id] // allSubs already sorted desc
    setReBusy(true)
    setReError('')
    try {
      for (const id of toDelete) {
        await api.delete(`/topicSubmissions/${id}`, token)
      }
      // reload submissions after delete
      const subs = await api.get('/topicSubmissions', token).catch(() => ({ submissions: [] }))
      setSubmissions(Array.isArray(subs?.submissions) ? subs.submissions : [])
      setReOpen(false)
      setReUser(null)
      setReTopicId(null)
      setReAll(false)
    } catch (e) {
      const msg = /404/.test(String(e?.message))
        ? 'Маршрут удаления попытки недоступен (404). Перезапустите сервер, чтобы применить новые маршруты.'
        : (e?.message || 'Не удалось удалить попытку')
      setReError(msg)
    } finally { setReBusy(false) }
  }

  function StatusPill({ value }) {
    const label = value === 'active' ? 'Активный' : (value || '—')
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
        {label}
      </span>
    )
  }

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_,i) => <SkeletonRow key={i} />)}</div>
  if (error) return <div className="text-sm text-red-500">{error}</div>

  // Сортируем по иерархии ролей: superadmin -> admin -> student; затем по email/имени.
  const roleRank = (r) => (r === 'superadmin' ? 0 : r === 'admin' ? 1 : 2)
  const sorted = [...users].sort((a, b) => {
    const ra = roleRank(a.role)
    const rb = roleRank(b.role)
    if (ra !== rb) return ra - rb
    const aKey = (a.email || a.name || '').toLowerCase()
    const bKey = (b.email || b.name || '').toLowerCase()
    return aKey.localeCompare(bKey, 'ru')
  })

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="hidden md:grid grid-cols-[1.3fr_1.8fr_1.6fr_auto] items-center gap-2 rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900/40">
        <div>Имя</div>
        <div>Выдать заново</div>
        <div>Роль</div>
        <div className="justify-self-end pr-1">Действия</div>
      </div>
      {/* Rows */}
      {sorted.map(u => (
        <div key={u.id} className="grid grid-cols-1 md:grid-cols-[1.3fr_1.8fr_1.6fr_auto] items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <div className="min-w-0 truncate text-zinc-900 dark:text-zinc-100">{u.name || u.email?.split('@')[0] || 'user'}</div>
          <div className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" className="btn" onClick={(e)=>{e.preventDefault(); e.stopPropagation(); openReissue(u)}}>
                Выдать заново…
              </button>
              <span className="text-xs text-zinc-400">{(subsByUser.get(u.id)||[]).length ? `${(subsByUser.get(u.id)||[]).length} попыток` : 'Попыток нет'}</span>
            </div>
          </div>
          <div className="min-w-0">
            <select
              value={u.role || 'student'}
              onChange={(e) => changeRole(u.id, e.target.value)}
              className={`input h-9 ${user?.role !== 'superadmin' ? 'opacity-60 cursor-not-allowed' : ''}`}
              disabled={user?.role !== 'superadmin'}
              title={user?.role !== 'superadmin' ? 'Изменение ролей доступно только Главному Администратору' : ''}
            >
              <option value="student">Студент</option>
              <option value="admin">Админ</option>
              <option value="superadmin">Главный Администратор</option>
            </select>
          </div>
          <div className="justify-self-end flex gap-2">
            {/* Сброс пароля */}
            {(user?.role === 'superadmin' || (user?.role === 'admin' && u.role === 'student')) ? (
              <button type="button" className="btn" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); openResetPwd(u) }}>Сброс пароля</button>
            ) : (
              <button type="button" className="btn opacity-60 cursor-not-allowed" disabled title="Сброс пароля: админ — только студентам, супер‑админ — всем">Сброс пароля</button>
            )}
            {/* Удаление */}
            {user?.role === 'superadmin' ? (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDelete(u) }}
                className="btn"
              >
                Удалить
              </button>
            ) : (
              <button type="button" className="btn opacity-60 cursor-not-allowed" disabled title="Удаление доступно только Главному Администратору">Удалить</button>
            )}
          </div>
        </div>
      ))}

      {/* Confirm delete modal */}
      <Modal open={confirmOpen} onClose={() => (busy ? null : setConfirmOpen(false))} title="Удалить аккаунт" mode="modal">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Вы уверены, что хотите удалить аккаунт <span className="font-semibold">{target?.email || target?.name}</span>? Это действие необратимо.</p>
        {error && <div className="mt-2 text-sm text-rose-400">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirmOpen(false)} disabled={busy}>Отмена</button>
          <button type="button" className="btn" onClick={removeUserConfirmed} disabled={busy}>{busy ? 'Удаление…' : 'Удалить'}</button>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal open={pwdOpen} onClose={() => (busy ? null : setPwdOpen(false))} title="Сбросить пароль" mode="modal">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Задайте новый пароль для пользователя <span className="font-semibold">{pwdTarget?.email}</span>.</p>
        <input
          className="input mt-3"
          type="password"
          placeholder="Новый пароль (не короче 6 символов)"
          value={newPwd}
          onChange={(e)=>setNewPwd(e.target.value)}
        />
        {error && <div className="mt-2 text-sm text-rose-400">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setPwdOpen(false)} disabled={busy}>Отмена</button>
          <button type="button" className="btn" disabled={busy || (newPwd||'').length<6} onClick={async()=>{
            if ((newPwd||'').length < 6) { setError('Пароль должен быть не короче 6 символов'); return }
            setBusy(true)
            setError('')
            try {
              await api.patch(`/users/${pwdTarget.id}/password`, { password: newPwd }, token)
              setPwdOpen(false); setPwdTarget(null); setNewPwd('')
            } catch (e) {
              const msg = /404/.test(String(e?.message))
                ? 'Маршрут сброса пароля недоступен (404). Перезапустите сервер, чтобы применить новые маршруты.'
                : e.message
              setError(msg)
            } finally { setBusy(false) }
          }}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
        </div>
      </Modal>

      {/* Re-issue (reset topic) modal */}
      <Modal open={reOpen} onClose={() => (reBusy ? null : setReOpen(false))} title="Выдать задание заново" mode="modal">
        <div className="space-y-3">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Пользователь: <span className="font-semibold">{reUser?.name || reUser?.email}</span>
          </div>
          <label className="text-sm block">
            Тема для повторной выдачи
            <select className="input mt-1 w-full" value={reTopicId ?? ''} onChange={(e)=>setReTopicId(Number(e.target.value)||null)}>
              {getAllTopicsForUser(reUser?.id || -1).map(({topic_id, topic_name, latest}) => (
                <option key={topic_id} value={topic_id}>
                  {topic_name} — последняя: {latest ? `${latest.status}${Number(latest.auto_fail_count||0)>0?' (auto)':''}` : 'нет'}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={reAll} onChange={(e)=>setReAll(e.target.checked)} />
            <span>Полный сброс: удалить все попытки по выбранной теме (включая одобренные/отклонённые/на проверке)</span>
          </label>
          {reError && <div className="text-sm text-rose-400">{reError}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={()=>setReOpen(false)} disabled={reBusy}>Отмена</button>
            <button type="button" className="btn" onClick={performReissue} disabled={reBusy || !reTopicId}>{reBusy ? 'Выполняю…' : 'Выдать заново'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
