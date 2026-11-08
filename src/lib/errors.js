/**
 * 把 Supabase / Postgres 返回的英文错误翻译成中文提示。
 * 页面上展示给用户的所有错误都必须经过这里。
 */

const AUTH_RULES = [
  [/invalid login credentials/i, '学号或密码错误'],
  [/already registered|already been registered|already exists/i, '该学号已注册，请直接登录'],
  [/password should be at least (\d+)/i, (m) => `密码至少需要 ${m[1]} 位`],
  [/weak password|known to be weak|pwned/i, '密码过于简单，请换一个更复杂的密码'],
  [/email not confirmed/i, '账号尚未激活，请联系教师'],
  [/signups? (is|are)? ?(not allowed|disabled)/i, '当前未开放注册，请联系教师'],
  [/invalid email|unable to validate email|is invalid/i, '学号格式不正确'],
  [/rate limit|too many requests|over_request_rate_limit/i, '操作过于频繁，请稍后再试'],
  [/failed to fetch|network|load failed|fetch failed/i, '网络连接失败，请检查网络后重试'],
  [/jwt expired|session.*expired|refresh_token_not_found/i, '登录已过期，请重新登录'],
]

const PG_CODES = {
  23505: '该名称已存在，请勿重复添加',
  23503: '该记录仍被其他数据引用，无法操作',
  23502: '必填信息不完整',
  42501: '没有执行此操作的权限',
  '22P02': '数据格式不正确',
  PGRST116: '未找到对应的数据',
}

export function zhError(err, fallback = '操作失败，请稍后再试') {
  if (!err) return fallback
  const code = err.code ?? err.status
  if (code && PG_CODES[code]) return PG_CODES[code]

  const msg = String(err.message ?? err)
  if (/row-level security|violates row-level/i.test(msg)) return PG_CODES[42501]
  if (/[\u4e00-\u9fff]/.test(msg)) return msg

  for (const [re, out] of AUTH_RULES) {
    const m = msg.match(re)
    if (m) return typeof out === 'function' ? out(m) : out
  }
  return fallback
}
