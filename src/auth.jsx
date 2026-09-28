import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from './lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))
  const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 минут
  const lastActivityRef = useRef(Date.now())
  const idleTimerRef = useRef(null)
  const hiddenTimerRef = useRef(null)

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    setToken(res.token)
    setUser(res.user)
  }

  const register = async (email, password) => {
    const res = await api.post('/auth/register', { email, password })
    setToken(res.token)
    setUser(res.user)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('lastActivity')
      localStorage.setItem('loggedOutAt', String(Date.now())) // для других вкладок
    } catch {}
  }

  const value = { token, user, login, register, logout }
  // Инициализация таймаута неактивности и обработчиков видимости/активности
  useEffect(() => {
    function clearIdleTimer() {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }
    function clearHiddenTimer() {
      if (hiddenTimerRef.current) {
        clearTimeout(hiddenTimerRef.current)
        hiddenTimerRef.current = null
      }
    }
    function doLogout() {
      // двойная проверка, чтобы не срабатывать без авторизации
      if (!token) return
      logout()
    }
    function scheduleIdleCheck() {
      clearIdleTimer()
      const now = Date.now()
      const last = lastActivityRef.current || now
      const elapsed = now - last
      const remaining = Math.max(0, IDLE_TIMEOUT_MS - elapsed)
      if (remaining === 0) {
        doLogout()
      } else {
        idleTimerRef.current = setTimeout(doLogout, remaining)
      }
    }
    function markActivity() {
      const ts = Date.now()
      lastActivityRef.current = ts
      try { localStorage.setItem('lastActivity', String(ts)) } catch {}
      scheduleIdleCheck()
    }
    function onVisibilityChange() {
      if (document.hidden) {
        clearHiddenTimer()
        hiddenTimerRef.current = setTimeout(doLogout, IDLE_TIMEOUT_MS)
      } else {
        clearHiddenTimer()
        markActivity()
      }
    }
    function onStorage(e) {
      if (!e) return
      if (e.key === 'loggedOutAt' && e.newValue) {
        // другая вкладка вышла — синхронизируемся
        if (token) {
          setToken(null)
          setUser(null)
        }
      } else if (e.key === 'lastActivity' && e.newValue) {
        const v = Number(e.newValue)
        if (Number.isFinite(v)) {
          lastActivityRef.current = v
          scheduleIdleCheck()
        }
      }
    }

    // навешиваем слушатели только когда пользователь авторизован
    if (token) {
      // при монтировании проверим, не истёк ли прошлый lastActivity
      try {
        const saved = Number(localStorage.getItem('lastActivity'))
        if (Number.isFinite(saved)) {
          lastActivityRef.current = saved
        } else {
          localStorage.setItem('lastActivity', String(lastActivityRef.current))
        }
        const diff = Date.now() - (lastActivityRef.current || Date.now())
        if (diff >= IDLE_TIMEOUT_MS) {
          doLogout()
        }
      } catch {}

      const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
      activityEvents.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }))
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('focus', markActivity)
      window.addEventListener('storage', onStorage)

      // стартуем основной таймер
      scheduleIdleCheck()
    }

    return () => {
      clearIdleTimer()
      clearHiddenTimer()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', markActivity)
      window.removeEventListener('storage', onStorage)
      const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
      activityEvents.forEach((ev) => window.removeEventListener(ev, markActivity))
    }
  }, [token])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

// ====== Вспомогательные эффекты внутри провайдера ======
// Реализуем здесь, чтобы не засорять компонент App

// Обёртка, чтобы хуки могли использовать стейт провайдера
// Переопределим компонент внутри файла (после экспорта), чтобы подписаться на активность
export function _AuthProviderInactivityHooks() { return null }

