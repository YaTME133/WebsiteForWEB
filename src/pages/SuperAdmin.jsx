import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../auth.jsx'

export default function SuperAdmin() {
  const { token } = useAuth()
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')

  const load = async () => {
    try { const res = await api.get('/users', token); setUsers(res.users) } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  const setRole = async (id, role) => { await api.patch(`/users/${id}/role`, { role }, token); await load() }
  const setBlocked = async (id, is_blocked) => { await api.patch(`/users/${id}/block`, { is_blocked }, token); await load() }

  // Сортировка пользователей: superadmin -> admin -> student, затем по email
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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Суперадмин: Пользователи</h1>
      {error && <div className="text-red-400">{error}</div>}
      <div className="space-y-3">
        {sorted.map(u => (
          <div key={u.id} className="card flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{u.email}</div>
              <div className="text-xs text-slate-400">role: {u.role} • blocked: {u.is_blocked ? 'yes' : 'no'}</div>
            </div>
            <select className="input w-40" value={u.role} onChange={e => setRole(u.id, e.target.value)}>
              <option value="student">student</option>
              <option value="admin">admin</option>
              <option value="superadmin">superadmin</option>
            </select>
            <button className="btn" onClick={() => setBlocked(u.id, !u.is_blocked)}>{u.is_blocked ? 'Разблок.' : 'Блок.'}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
