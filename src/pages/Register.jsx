import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { register } = useAuth()
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try { await register(email, password); navigate('/') } catch (e) { setError(e.message) }
  }

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-4">Регистрация</h1>
      <form className="space-y-3 card" onSubmit={submit}>
        <input className="input" placeholder="Имя пользователя" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input" placeholder="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn w-full">Создать аккаунт</button>
        {error && <div className="text-red-400 text-sm">{error}</div>}
      </form>
    </div>
  )
}
