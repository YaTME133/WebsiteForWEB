// Anti-cheat hook: tracks visibility/blur, multi-tab, simple DevTools heuristic.
// Важно: Alt+Tab — системное событие, браузер не даёт прямого доступа. Мы опираемся
// на надёжные браузерные сигналы (visibility/focus/blur/pagehide/unload) и межвкладочную
// коммуникацию (BroadcastChannel/storage). Клавиатурные сочетания только как эвристика.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

function uuid4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

export function useAntiCheat({
  userId,
  taskId,
  logFn, // async (payload)
  onAutoFail, // async () => {}
  config = {}
} = {}) {
  const {
    warnAfter = 1,
    lockAfter = 2,
    autoFailAfter = 3,
    lockDurationSec = 30,
    useFullscreenPrompt = true,
  } = config

  const [started, setStarted] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [warningOpen, setWarningOpen] = useState(false)
  const [finalOpen, setFinalOpen] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [lockRemaining, setLockRemaining] = useState(0)
  const [devtoolsSuspected, setDevtoolsSuspected] = useState(false)
  const tabIdRef = useRef(uuid4())
  const bcRef = useRef(null)
  const lockTimerRef = useRef(null)
  const devtoolsTimerRef = useRef(null)
  const storageKey = useMemo(() => `ytme133_task_${userId || 'anon'}_${taskId}`, [userId, taskId])
  const stateKey = useMemo(() => storageKey + '_state', [storageKey])
  const activityRef = useRef({ active: true })
  const lastViolationAtRef = useRef(0)
  const lastReasonRef = useRef('')
  const LEAVE_REASONS = useRef(new Set(['visibility_hidden','window_blur','pagehide','beforeunload','shortcut_tab','inactive_heartbeat','multitab_broadcast','multitab_storage','route_link','route_leave','exit_fullscreen']))
  const COOLDOWN_MS = 1200 // защита от двойного срабатывания при возврате/двойных событиях

  const locked = lockedUntil > Date.now()

  // Persistence helpers
  const persist = useCallback((override = {}) => {
    try {
      const data = {
        attempts,
        lockedUntil,
        finalOpen,
        ...override,
      }
      localStorage.setItem(stateKey, JSON.stringify(data))
    } catch {}
  }, [attempts, finalOpen, lockedUntil, stateKey])

  const loadPersisted = useCallback(() => {
    try {
      const raw = localStorage.getItem(stateKey)
      if (!raw) return
      const p = JSON.parse(raw)
      if (Number.isFinite(p?.attempts)) setAttempts(Number(p.attempts))
      if (Number.isFinite(p?.lockedUntil)) setLockedUntil(Number(p.lockedUntil))
      if (p?.finalOpen) setFinalOpen(true)
    } catch {}
  }, [stateKey])

  const updateLockCountdown = useCallback(() => {
    if (!locked) { setLockRemaining(0); return }
    const remain = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
    setLockRemaining(remain)
  }, [locked, lockedUntil])

  const tickLock = useCallback(() => {
    clearInterval(lockTimerRef.current)
    if (!locked) return
    lockTimerRef.current = setInterval(() => {
      updateLockCountdown()
      if (Date.now() >= lockedUntil) {
        clearInterval(lockTimerRef.current)
        setLockRemaining(0)
      }
    }, 250)
  }, [locked, lockedUntil, updateLockCountdown])

  const logEvent = useCallback(async (eventType, details={}) => {
    try {
      await logFn?.({ userId, taskId, eventType, timestamp: Date.now(), details: { ...details, tabId: tabIdRef.current, attemptCount: attempts + 1 } })
    } catch (e) {
      if (import.meta.env.DEV) console.warn('logCheatEvent failed', e)
    }
  }, [attempts, logFn, taskId, userId])

  // Global guard broadcaster so Header can react in any route
  const setGlobalGuard = useCallback((active) => {
    try {
      localStorage.setItem('ytme133_guard_active', active ? '1' : '0')
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('ytme133_guard_change', { detail: { active } }))
    } catch {}
  }, [])

  const increment = useCallback(async (reason, details={}) => {
    // Не увеличиваем счётчик если уже финал
    if (finalOpen) return
    // Дедупликация: игнорируем повторные события ухода в рамках короткого окна
    const now = Date.now()
    if (LEAVE_REASONS.current.has(String(reason))) {
      const lastTs = lastViolationAtRef.current || 0
      const lastReason = lastReasonRef.current || ''
      if (now - lastTs < COOLDOWN_MS) {
        // в окне подавления — не считаем повтор
        return
      }
      lastViolationAtRef.current = now
      lastReasonRef.current = String(reason)
    }
    const next = attempts + 1
    setAttempts(next)
    await logEvent(reason, details)

    if (next >= autoFailAfter) {
      setFinalOpen(true)
      try { await onAutoFail?.() } catch {}
      persist({ attempts: next, finalOpen: true })
      return
    }
    if (next >= lockAfter) {
      // блокировка
      if (!locked) {
        const until = Date.now() + lockDurationSec * 1000
        setLockedUntil(until)
        persist({ attempts: next, lockedUntil: until })
        tickLock()
      } else {
        // уже заблокированы — не сбрасываем таймер; просто сохраняем attempts
        persist({ attempts: next })
      }
      setWarningOpen(false)
      return
    }
    if (next >= warnAfter) {
      // Показываем предупреждение только если вкладка видима и окно в фокусе
      const visible = document.visibilityState === 'visible'
      const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true
      if (visible && hasFocus) {
        setWarningOpen(true)
        // если включён режим, пытаемся держать fullscreen при предупреждении
        try { await requestFullscreen() } catch {}
      }
      persist({ attempts: next })
    }
  }, [attempts, autoFailAfter, lockAfter, lockDurationSec, finalOpen, logEvent, onAutoFail, tickLock, warnAfter, persist])

  // Event handlers
  useEffect(() => {
    if (!started) return

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        increment('visibility_hidden', { visibilityState: document.visibilityState })
      }
    }
    const onBlur = () => increment('window_blur')
    const onPageHide = () => increment('pagehide')
    const onBeforeUnload = () => increment('beforeunload')
    const onKey = (e) => {
      const k = e.key?.toLowerCase()
      // эвристика: любое нажатие Tab/` с модификаторами — считаем попыткой переключения
      if ((k === 'tab' || k === '`') && (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) {
        increment('shortcut_tab', { ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, shift: e.shiftKey, key: e.key })
      }
      // опционально: одиночный Tab может переводить фокус; если при этом окно теряет focus — heartbeat поймает
    }

    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('keydown', onKey)
    }
  }, [increment, started])

  // Multi-tab: BroadcastChannel + storage fallback
  useEffect(() => {
    if (!started) return
    const tabId = tabIdRef.current
    const payload = { type: 'task_open', userId, taskId, tabId, ts: Date.now() }

    // BroadcastChannel
    try {
      const bc = new BroadcastChannel('ytme133_anticheat')
      bcRef.current = bc
      bc.onmessage = (ev) => {
        const msg = ev.data || {}
        if (msg.type === 'task_open' && msg.userId === userId && msg.taskId === taskId && msg.tabId !== tabId) {
          increment('multitab_broadcast', { otherTabId: msg.tabId })
        }
      }
      bc.postMessage(payload)
    } catch {}

    // storage fallback
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload))
      const onStorage = (e) => {
        if (e.key !== storageKey) return
        try {
          const msg = JSON.parse(e.newValue || '{}')
          if (msg?.tabId && msg.tabId !== tabId && msg.userId === userId && msg.taskId === taskId) {
            increment('multitab_storage', { otherTabId: msg.tabId })
          }
        } catch {}
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    } catch {}
  }, [increment, started, storageKey, taskId, userId])

  // Simple DevTools heuristic
  useEffect(() => {
    if (!started) return
    clearInterval(devtoolsTimerRef.current)
    devtoolsTimerRef.current = setInterval(() => {
      try {
        const dw = Math.abs((window.outerWidth || 0) - (window.innerWidth || 0))
        const dh = Math.abs((window.outerHeight || 0) - (window.innerHeight || 0))
        const suspected = (dw > 160 || dh > 160)
        setDevtoolsSuspected(suspected)
        if (suspected) {
          // логируем как сигнал (не доказательство)
          logEvent('devtools_suspected', { dw, dh })
        }
      } catch {}
    }, 2000)
    return () => clearInterval(devtoolsTimerRef.current)
  }, [logEvent, started])

  // Heartbeat для надёжной фиксации ухода (Alt/Ctrl+Tab, смена окна)
  useEffect(() => {
    if (!started) return
    const interval = setInterval(() => {
      try {
        const hidden = document.visibilityState === 'hidden'
        const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true
        const active = !hidden && !!hasFocus
        if (activityRef.current.active && !active) {
          increment('inactive_heartbeat', { hidden, hasFocus })
        }
        activityRef.current.active = active
      } catch {}
    }, 500)
    return () => clearInterval(interval)
  }, [increment, started])

  useEffect(() => {
    updateLockCountdown()
    tickLock()
    // Сбрасываем persisted lockedUntil, только если он был и реально истёк
    if (lockedUntil && Date.now() >= lockedUntil) {
      persist({ lockedUntil: 0 })
    }
    return () => clearInterval(lockTimerRef.current)
  }, [lockedUntil, tickLock, updateLockCountdown, persist])

  const start = useCallback(async () => {
    setStarted(true)
    loadPersisted()
    await logEvent('start_protection')
    setGlobalGuard(true)
    // Пытаемся войти в fullscreen сразу при старте (может быть отклонено без user-gesture)
    if (useFullscreenPrompt) {
      try { await requestFullscreen() } catch {}
    }
  }, [loadPersisted, logEvent, setGlobalGuard])
  const stop = useCallback(async () => {
    setStarted(false)
    try { bcRef.current?.close?.() } catch {}
    await logEvent('stop_protection')
    setGlobalGuard(false)
  }, [logEvent])

  // SPA route leave hook: counts as violation to prevent bypass by navigation
  const routeLeave = useCallback(async (details={}) => {
    // Если уже финал — просто стоп
    if (finalOpen) return stop()
    await increment('route_leave', details)
    await stop()
  }, [finalOpen, increment, stop])

  const requestFullscreen = useCallback(async () => {
    if (!useFullscreenPrompt) return false
    const el = document.documentElement
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      else if (el.msRequestFullscreen) await el.msRequestFullscreen()
      return true
    } catch { return false }
  }, [useFullscreenPrompt])

  const acknowledgeWarning = useCallback(() => setWarningOpen(false), [])

  // При возврате (вкладка стала видимой) — не показываем предупреждение заново
  useEffect(() => {
    if (!started) return
    const onVisBack = () => {
      if (document.visibilityState === 'visible') {
        setWarningOpen(false)
      }
    }
    document.addEventListener('visibilitychange', onVisBack)
    return () => document.removeEventListener('visibilitychange', onVisBack)
  }, [started])

  // Следим за выходом из fullscreen — считаем нарушением и повторно запрашиваем
  useEffect(() => {
    if (!started) return
    if (!useFullscreenPrompt) return
    const onFsChange = () => {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement)
      if (!inFs) {
        increment('exit_fullscreen')
        // Пытаемся вернуть fullscreen (не всегда получится без пользовательского жеста)
        requestFullscreen()
      }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    document.addEventListener('msfullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
      document.removeEventListener('msfullscreenchange', onFsChange)
    }
  }, [increment, requestFullscreen, started, useFullscreenPrompt])

  // При старте: на первое пользовательское действие пробуем включить fullscreen (если запретили без gesture)
  useEffect(() => {
    if (!started || !useFullscreenPrompt) return
    const handler = () => {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement)
      if (!inFs) { requestFullscreen() }
      document.removeEventListener('pointerdown', handler, true)
      document.removeEventListener('keydown', handler, true)
    }
    document.addEventListener('pointerdown', handler, true)
    document.addEventListener('keydown', handler, true)
    return () => {
      document.removeEventListener('pointerdown', handler, true)
      document.removeEventListener('keydown', handler, true)
    }
  }, [started, useFullscreenPrompt, requestFullscreen])

  // Фиксируем клики по внутренним ссылкам (SPA-навигация) как уход со страницы
  useEffect(() => {
    if (!started) return
    const onClickCapture = (e) => {
      try {
        const el = e.target.closest ? e.target.closest('a[href]') : null
        if (!el) return
        const href = el.getAttribute('href') || ''
        if (!href || href.startsWith('#')) return
        // абсолютные ссылки
        const url = new URL(href, window.location.href)
        // внутренний роут другого пути
        if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
          // не спамим: одно срабатывание на клик
          increment('route_link', { href: url.pathname })
        }
      } catch {}
    }
    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [increment, started])

  return {
    // state
    started,
    attempts,
    warningOpen,
    finalOpen,
    locked,
    lockRemaining,
    devtoolsSuspected,
    // global guard helpers
    guardActive: started, // для блокировки навигации в Header
    // actions
    start,
    stop,
  routeLeave,
    acknowledgeWarning,
    requestFullscreen,
    // for external control
    config: { warnAfter, lockAfter, autoFailAfter, lockDurationSec, useFullscreenPrompt }
  }
}
