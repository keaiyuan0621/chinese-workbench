import { buildMessages, isKnownRole } from './prompts.mjs'

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }
const MAX_BODY_BYTES = 32 * 1024
const DEFAULT_TIMEOUT_MS = 18_000
const RATE_WINDOW_MS = 60_000
const DEFAULT_RATE_LIMIT = 20
const PREVIEW_HEADER = 'local'

const hits = new Map()

export function resetTutorRateLimit() {
  hits.clear()
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  }
}

function fail(statusCode, error, message) {
  return json(statusCode, { ok: false, error, message })
}

function header(event, name) {
  const headers = event?.headers ?? {}
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === wanted) {
      return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
    }
  }
  return ''
}

function readBody(event) {
  if (!event?.body) return ''
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64').toString('utf8')
  return String(event.body)
}

function enabledFrom(env) {
  const raw = String(env.AI_TUTORS_ENABLED ?? 'true').trim().toLowerCase()
  return raw !== 'false' && raw !== '0' && raw !== 'off'
}

function timeoutMsFrom(env) {
  const n = Number(env.AI_TUTORS_TIMEOUT_MS)
  if (Number.isFinite(n) && n >= 20 && n <= 60_000) return n
  return DEFAULT_TIMEOUT_MS
}

function rateLimitFrom(env) {
  const n = Number(env.AI_TUTORS_RATE_LIMIT)
  if (Number.isFinite(n) && n >= 1 && n <= 200) return n
  return DEFAULT_RATE_LIMIT
}

export function extractBearerToken(event) {
  const raw = header(event, 'authorization')
  const match = raw.match(/^Bearer\s+(\S+)/i)
  return match ? match[1] : ''
}

function tooLong(value, max) {
  return String(value ?? '').length > max
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return '请求格式不正确'
  }
  if (!isKnownRole(payload.role)) return '请选择见微或知著'
  if (!String(payload.stem ?? '').trim()) return '缺少题干'
  if (tooLong(payload.stem, 4000)) return '题干过长'
  if (tooLong(payload.type, 40)) return '题型过长'
  if (tooLong(payload.options, 2000)) return '选项过长'
  if (tooLong(payload.studentAnswer, 2000)) return '作答过长'
  if (tooLong(payload.originalExplanation, 4000)) return '原解析过长'
  if (tooLong(payload.referenceAnswer, 2000)) return '参考答案过长'
  if (tooLong(payload.message, 1000)) return '追问过长'
  if (payload.history != null) {
    if (!Array.isArray(payload.history)) return '对话记录格式不正确'
    if (payload.history.length > 12) return '对话轮次过多'
    for (const turn of payload.history) {
      if (!turn || typeof turn !== 'object') return '对话记录格式不正确'
      if (turn.role !== 'user' && turn.role !== 'assistant') return '对话记录格式不正确'
      if (tooLong(turn.content, 2000)) return '对话记录过长'
    }
  }
  return ''
}

export async function verifySupabaseUser(token, env, fetchImpl) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon || !token) return null
  let response
  try {
    response = await fetchWithTimeout(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } }, 5000, async (...args) => {
      const result = await fetchImpl(...args)
      return { ok: result.ok, data: result.ok ? await result.json() : null }
    })
  } catch (error) {
    if (error?.code === 'timeout') { const timeout = new Error('auth timeout'); timeout.code = 'auth_timeout'; throw timeout }
    return null
  }
  if (!response.ok) return null
  let user
  try {
    user = response.data
  } catch {
    return null
  }
  if (!user?.id) return null
  return { id: String(user.id) }
}

function allowPreview(event, { allowDevPreview }) {
  return Boolean(allowDevPreview) && process.env.NODE_ENV !== 'production' && header(event, 'x-ai-tutors-preview') === PREVIEW_HEADER
}

function rateLimited(userId, limit, now) {
  const windowStart = now - RATE_WINDOW_MS
  const list = (hits.get(userId) ?? []).filter((t) => t > windowStart)
  if (list.length >= limit) {
    hits.set(userId, list)
    return true
  }
  list.push(now)
  hits.set(userId, list)
  return false
}

export async function fetchWithTimeout(url, init, timeoutMs, fetchImpl) {
  let settled = false
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
      if (settled) return
      settled = true
      const err = new Error('timeout')
      err.code = 'timeout'
      reject(err)
    }, timeoutMs)

    Promise.resolve(fetchImpl(url, { ...init, signal: controller.signal })).then(
      (value) => {
        clearTimeout(timer)
        if (settled) return
        settled = true
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        if (settled) return
        settled = true
        if (err?.name === 'AbortError' || err?.code === 'timeout') {
          const timeout = new Error('timeout')
          timeout.code = 'timeout'
          reject(timeout)
          return
        }
        reject(err)
      },
    )
  })
}

async function callDeepSeek({ env, fetchImpl, messages, role, timeoutMs }) {
  const apiUrl = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions'
  const response = await fetchWithTimeout(
    apiUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-flash',
        thinking: { type: 'disabled' },
        messages,
        temperature: role === 'zhizhu' ? 0.6 : 0.4,
        max_tokens: 800,
      }),
    },
    timeoutMs,
    async (...args) => {
      const result = await fetchImpl(...args)
      return { ok: result.ok, status: result.status, data: result.ok ? await result.json() : null }
    },
  )

  if (!response.ok) {
    const err = new Error('upstream')
    err.code = 'upstream'
    err.status = response.status
    throw err
  }

  let data
  try {
    data = response.data
  } catch {
    const err = new Error('upstream')
    err.code = 'upstream'
    throw err
  }

  const content = String(data?.choices?.[0]?.message?.content ?? '').trim()
  if (!content) {
    const err = new Error('upstream')
    err.code = 'upstream'
    throw err
  }
  return content
}

export async function handleTutorRequest(event, options = {}) {
  const {
    allowDevPreview = false,
    env = process.env,
    fetchImpl = fetch,
    now = Date.now(),
    verifyUser = verifySupabaseUser,
  } = options

  const method = String(event?.httpMethod || event?.method || '').toUpperCase()
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' }
  }
  if (method !== 'POST') {
    return fail(405, 'method_not_allowed', '请使用 POST 请求')
  }

  const raw = readBody(event)
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return fail(413, 'invalid_request', '请求内容过大')
  }

  let payload
  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    return fail(400, 'invalid_request', '请求不是合法 JSON')
  }

  const preview = allowPreview(event, { allowDevPreview })
  const token = extractBearerToken(event)
  let user
  try {
    user = preview ? { id: 'dev-preview' } : await verifyUser(token, env, fetchImpl)
  } catch {
    return fail(504, 'auth_timeout', '登录校验超时，请稍后重试')
  }
  if (!user?.id) {
    return fail(401, 'unauthorized', '请先登录后再使用 AI 讲解')
  }

  if (!enabledFrom(env)) {
    return fail(403, 'disabled', 'AI 讲解已暂时关闭')
  }

  if (!String(env.DEEPSEEK_API_KEY ?? '').trim()) {
    return fail(503, 'not_configured', 'AI 讲解暂未配置，原解析仍可阅读')
  }

  const invalid = validatePayload(payload)
  if (invalid) return fail(400, 'invalid_request', invalid)

  if (rateLimited(user.id, rateLimitFrom(env), now)) {
    return fail(429, 'rate_limited', '提问过于频繁，请稍后再试')
  }

  const messages = buildMessages({ role: payload.role, payload })
  try {
    const content = await callDeepSeek({
      env,
      fetchImpl,
      messages,
      role: payload.role,
      timeoutMs: timeoutMsFrom(env),
    })
    return json(200, { ok: true, role: payload.role, content })
  } catch (err) {
    if (['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(err?.cause?.code || err?.code)) {
      return fail(503, 'network', '\u8bb2\u89e3\u670d\u52a1\u6682\u65f6\u65e0\u6cd5\u8fde\u63a5 DeepSeek\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5')
    }
    if (err?.code === 'timeout') {
      return fail(504, 'timeout', '讲解超时，请稍后重试')
    }
    return fail(502, 'upstream', '讲解服务暂时不可用，请稍后重试')
  }
}
