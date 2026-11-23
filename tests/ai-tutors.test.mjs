import { trimTutorHistory } from '../src/lib/tutorHistory.js'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { handleTutorRequest, resetTutorRateLimit } from '../server/ai-tutors/handler.mjs'
import { buildMessages, systemPrompt } from '../server/ai-tutors/prompts.mjs'

afterEach(() => {
  resetTutorRateLimit()
})

const sample = {
  role: 'jianwei',
  type: '单选',
  stem: '下列关于音位的表述，正确的一项是？',
  options: 'A. 音位可以直接听见\nB. 音位具有区别意义的作用',
  studentAnswer: 'A',
  originalExplanation: '音位从音素中归纳，具有辨义作用。',
  referenceAnswer: 'B',
}

const envOk = {
  AI_TUTORS_ENABLED: 'true',
  DEEPSEEK_API_KEY: 'test-key-not-real',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
}

function jsonEvent(body, headers = { authorization: 'Bearer test-token' }) {
  return {
    httpMethod: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
}

function parse(result) {
  return { status: result.statusCode, body: JSON.parse(result.body) }
}

async function call(body, options = {}) {
  return handleTutorRequest(jsonEvent(body, options.headers), {
    allowDevPreview: options.allowDevPreview ?? false,
    env: options.env ?? envOk,
    fetchImpl: options.fetchImpl ?? (async () => ({ ok: true, json: async () => ({}) })),
    verifyUser: options.verifyUser ?? (async () => ({ id: 'user-1' })),
  })
}

function okFetch(content = '这是讲解') {
  return async (_url, init) => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
    request: init,
  })
}

test('见微与知著的系统提示职责不同', () => {
  const jianwei = systemPrompt('jianwei')
  const zhizhu = systemPrompt('zhizhu')
  assert.match(jianwei, /见微/)
  assert.match(jianwei, /细节/)
  assert.doesNotMatch(jianwei, /首轮/)
  assert.match(zhizhu, /知著/)
  assert.match(zhizhu, /一步一步/)
  assert.match(zhizhu, /不要直接给出完整标准答案/)
  assert.notEqual(jianwei, zhizhu)
})

test('知著首轮提示不倾倒答案，见微首轮要求讲细节', () => {
  const zhizhuFirst = buildMessages({ role: 'zhizhu', payload: sample })
  const jianweiFirst = buildMessages({ role: 'jianwei', payload: { ...sample, role: 'jianwei' } })
  const zhizhuKickoff = zhizhuFirst.at(-1).content
  const jianweiKickoff = jianweiFirst.at(-1).content
  assert.match(zhizhuKickoff, /这是首轮/)
  assert.match(zhizhuKickoff, /不要直接给出完整答案/)
  assert.match(jianweiKickoff, /关键细节/)
  assert.doesNotMatch(jianweiKickoff, /这是首轮/)
})

test('作答中的知著看不到标准答案和原解析', () => {
  const messages = buildMessages({
    role: 'zhizhu',
    payload: { ...sample, role: 'zhizhu', withholdAnswer: true },
  })
  const kickoff = messages.at(-1).content
  assert.match(kickoff, /还在作答/)
  assert.match(kickoff, /不要写出标准答案/)
  assert.doesNotMatch(kickoff, /参考答案/)
  assert.doesNotMatch(kickoff, /音位从音素/)
  assert.doesNotMatch(kickoff, /原解析/)
})

test('知著追问后不再使用首轮限制语', () => {
  const messages = buildMessages({
    role: 'zhizhu',
    payload: {
      ...sample,
      history: [{ role: 'assistant', content: '先看题干里哪个词最关键？' }],
      message: '是「区别意义」吗？',
    },
  })
  const joined = messages.map((item) => item.content).join('\n')
  assert.doesNotMatch(joined, /这是首轮/)
  assert.match(joined, /是「区别意义」吗？/)
})

test('提示里包含题目、作答和原解析，不包含姓名学号', () => {
  const messages = buildMessages({
    role: 'jianwei',
    payload: { ...sample, studentName: '张三', student_no: '20250001' },
  })
  const joined = messages.map((item) => item.content).join('\n')
  assert.match(joined, /音位/)
  assert.match(joined, /学生作答：A/)
  assert.match(joined, /原解析：/)
  assert.doesNotMatch(joined, /张三/)
  assert.doesNotMatch(joined, /20250001/)
  assert.doesNotMatch(joined, /studentName/)
})

test('无会话 token 时拒绝匿名访问', async () => {
  const result = parse(
    await call(sample, {
      headers: {},
      verifyUser: async () => null,
    }),
  )
  assert.equal(result.status, 401)
  assert.equal(result.body.error, 'unauthorized')
})

test('生产环境忽略预览头，仍需鉴权', async () => {
  const result = parse(
    await call(sample, {
      allowDevPreview: false,
      headers: { 'x-ai-tutors-preview': 'local' },
      verifyUser: async () => null,
    }),
  )
  assert.equal(result.status, 401)
  assert.equal(result.body.error, 'unauthorized')
})

test('本地预览头仅在 allowDevPreview 时可用', async () => {
  const result = parse(
    await call(sample, {
      allowDevPreview: true,
      headers: { 'x-ai-tutors-preview': 'local' },
      verifyUser: async () => null,
      fetchImpl: okFetch('预览讲解'),
    }),
  )
  assert.equal(result.status, 200)
  assert.equal(result.body.content, '预览讲解')
})

test('缺少 DEEPSEEK_API_KEY 时诚实返回未配置', async () => {
  const result = parse(
    await call(sample, {
      env: { ...envOk, DEEPSEEK_API_KEY: '' },
    }),
  )
  assert.equal(result.status, 503)
  assert.equal(result.body.error, 'not_configured')
  assert.match(result.body.message, /暂未配置/)
})

test('AI_TUTORS_ENABLED=false 时服务端关闭', async () => {
  let called = false
  const result = parse(
    await call(sample, {
      env: { ...envOk, AI_TUTORS_ENABLED: 'false' },
      fetchImpl: async () => {
        called = true
        return { ok: true, json: async () => ({}) }
      },
    }),
  )
  assert.equal(result.status, 403)
  assert.equal(result.body.error, 'disabled')
  assert.equal(called, false)
})

test('上游超时返回 timeout，不把模板当回复', async () => {
  const result = parse(
    await call(sample, {
      env: { ...envOk, AI_TUTORS_TIMEOUT_MS: '80' },
      fetchImpl: () => new Promise(() => {}),
    }),
  )
  assert.equal(result.status, 504)
  assert.equal(result.body.error, 'timeout')
  assert.equal(result.body.ok, false)
  assert.equal(result.body.content, undefined)
})

test('非法角色被拒绝', async () => {
  const result = parse(await call({ ...sample, role: 'other' }))
  assert.equal(result.status, 400)
  assert.equal(result.body.error, 'invalid_request')
})

test('见微请求把细节职责传给模型', async () => {
  let body
  const fetchImpl = async (_url, init) => {
    body = JSON.parse(init.body)
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '细节讲解' } }] }),
    }
  }
  const result = parse(await call(sample, { fetchImpl }))
  assert.equal(result.status, 200)
  assert.equal(result.body.role, 'jianwei')
  assert.match(body.messages[0].content, /见微/)
  assert.match(body.messages[0].content, /细节/)
})

test('知著请求把引导职责传给模型且首轮不倾倒', async () => {
  let body
  const fetchImpl = async (_url, init) => {
    body = JSON.parse(init.body)
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '先看哪个词？' } }] }),
    }
  }
  const result = parse(await call({ ...sample, role: 'zhizhu' }, { fetchImpl }))
  assert.equal(result.status, 200)
  assert.match(body.messages[0].content, /知著/)
  assert.match(body.messages.at(-1).content, /不要直接给出完整答案/)
})


test('默认调用当前可用模型并关闭思考以保证短讲解可见', async () => {
  let body
  const result = parse(await call(sample, { fetchImpl: async (_url, init) => {
    body = JSON.parse(init.body)
    return { ok: true, json: async () => ({ choices: [{ message: { content: '细节讲解' } }] }) }
  } }))
  assert.equal(result.status, 200)
  assert.equal(body.model, 'deepseek-flash')
  assert.deepEqual(body.thinking, { type: 'disabled' })
})

test('长对话保留最近内容，避免第七轮后被服务端拒绝', () => {
  const history = Array.from({ length: 24 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: String(i) }))
  const trimmed = trimTutorHistory(history)
  assert.equal(trimmed.length, 10)
  assert.equal(trimmed[0].content, '14')
  assert.equal(trimmed.at(-1).content, '23')
  assert.equal(trimTutorHistory([{ role: 'assistant', content: '字'.repeat(3000) }])[0].content.length, 2000)
})

test('鉴权超时明确提示重试，不误报未登录', async () => {
  const result = parse(await call(sample, { verifyUser: async () => { throw Object.assign(new Error('timeout'), { code: 'auth_timeout' }) } }))
  assert.equal(result.status, 504)
  assert.equal(result.body.error, 'auth_timeout')
})

test('上游响应体挂起也会超时', async () => {
  const result = parse(await call(sample, { env: { ...envOk, AI_TUTORS_TIMEOUT_MS: '60' }, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) }))
  assert.equal(result.status, 504)
  assert.equal(result.body.error, 'timeout')
})


test('connection resets return a useful network error', async () => {
  const result = parse(await call(sample, { fetchImpl: async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })
  } }))
  assert.equal(result.status, 503)
  assert.equal(result.body.error, 'network')
  assert.match(result.body.message, /DeepSeek/)
})
