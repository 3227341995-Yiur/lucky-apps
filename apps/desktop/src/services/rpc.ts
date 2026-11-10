/** 浏览器 ↔ Cordis Node 服务的本地 RPC。 */
const token = typeof window !== 'undefined' ? window.__WR_TOKEN__ || '' : ''

async function request(path, options = {}) {
  const headers = {
    'content-type': 'application/json',
    'x-wr-token': token,
    ...(options.headers || {}),
  }
  const response = await fetch(path, { ...options, headers })
  if (!response.ok) {
    let detail = ''
    try {
      detail = (await response.json()).error || ''
    } catch {}
    throw new Error(detail || `请求失败 (${response.status})`)
  }
  const type = response.headers.get('content-type') || ''
  return type.includes('application/json') ? response.json() : response.text()
}

export function dbSelect(sql, params = []) {
  return request('/api/db/select', {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  })
}

export function dbExecute(sql, params = []) {
  return request('/api/db/execute', {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  })
}

export function apiGet(path) {
  return request(path)
}

export function apiPost(path, body = {}) {
  return request(path, { method: 'POST', body: JSON.stringify(body) })
}

/** 返回原始 Response，供 NDJSON 流式接口使用 */
export function apiStream(path, body = {}) {
  return fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-wr-token': token,
    },
    body: JSON.stringify(body),
  })
}
