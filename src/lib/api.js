const BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof location !== 'undefined' && location.protocol === 'file:'
    ? 'http://localhost:4000/api'
    : '/api')

async function request(path, method = 'GET', body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })

  // Handle non-2xx
  if (!res.ok) {
    let msg = 'Request error'
    try {
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const j = await res.json()
        msg = j.error || j.message || JSON.stringify(j)
      } else {
        const t = await res.text()
        // sanitize potential HTML error pages
        msg = (t && !/^\s*</.test(t)) ? t : `${res.status} ${res.statusText}`
      }
    } catch (_) { msg = `${res.status} ${res.statusText}` }
    throw new Error(msg)
  }

  // No Content
  if (res.status === 204) return {}

  // Try to parse JSON when possible, otherwise return text/empty
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  const text = await res.text()
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { data: text } }
}

export const api = {
  get: (p, token) => request(p, 'GET', undefined, token),
  post: (p, body, token) => request(p, 'POST', body, token),
  patch: (p, body, token) => request(p, 'PATCH', body, token),
  put: (p, body, token) => request(p, 'PUT', body, token),
  delete: (p, token) => request(p, 'DELETE', undefined, token)
}

// Anti-cheat helpers
export async function logCheatEvent(payload, token) {
  // TODO: заменить на реальный эндпоинт, если отличается
  return request('/cheatingAttempts', 'POST', payload, token)
}
