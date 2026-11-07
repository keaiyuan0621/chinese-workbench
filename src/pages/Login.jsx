import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import InkSeal from '../components/student/InkSeal.jsx'
import { toVirtualEmail } from '../lib/constants.js'
import { useAuth } from '../lib/auth-context.js'
import { zhError } from '../lib/errors.js'
import { supabase } from '../lib/supabase.js'

const LOGIN_TIMEOUT_MS = 10_000
const NETWORK_TIMEOUT_MESSAGE = '网络连接超时，请切换 WiFi/流量后重试'

function withTimeout(promise, ms) {
  let timer
  let settled = false
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      settled = true
      const error = new Error('timeout')
      error.name = 'TimeoutError'
      reject(error)
    }, ms)
  })
  const guarded = Promise.resolve(promise).then(
    (value) => (settled ? undefined : value),
    (error) => {
      if (settled) return undefined
      throw error
    },
  )
  return Promise.race([guarded, timeout]).finally(() => clearTimeout(timer))
}

function isNetworkFailure(err) {
  const name = String(err?.name ?? '')
  const msg = String(err?.message ?? err ?? '')
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    name === 'AuthRetryableFetchError' ||
    /load failed|failed to fetch|networkerror|network request failed|fetch failed|timeout|timed out|\bnetwork\b/i.test(
      msg,
    )
  )
}

function loginErrorText(err) {
  if (isNetworkFailure(err)) return NETWORK_TIMEOUT_MESSAGE
  return zhError(err, '登录失败，请稍后再试')
}

const ROLES = [
  { id: 'student', label: '学生' },
  { id: 'teacher', label: '教师' },
]

function roleFromPath(pathname) {
  if (pathname.startsWith('/teacher')) return 'teacher'
  return 'student'
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, loading: authLoading, signOut } = useAuth()
  const [role, setRole] = useState(() => roleFromPath(location.pathname))
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    const previous = document.title
    document.title = '登录｜知微追'
    return () => {
      document.title = previous
    }
  }, [])

  const student = role === 'student'
  const signedInRole = profile?.role === 'student' || profile?.role === 'teacher' ? profile.role : null
  const signedInName = profile?.display_name?.trim() || (signedInRole === 'teacher' ? '教师' : '学生')

  function chooseRole(next) {
    setRole(next)
    setError('')
  }

  async function handleSignOut() {
    await signOut()
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const acc = account.trim()
    if (!acc) return setError(student ? '请输入学号' : '请输入账号')
    if (!password) return setError('请输入密码')

    const email = student || !acc.includes('@') ? toVirtualEmail(acc) : acc

    console.log('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL)
    console.log('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY)

    setLoading(true)
    try {
      const { data, error: err } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        LOGIN_TIMEOUT_MS,
      )
      if (err) return setError(loginErrorText(err))

      const { data: nextProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError || (nextProfile?.role !== 'student' && nextProfile?.role !== 'teacher')) {
        await supabase.auth.signOut()
        if (profileError && isNetworkFailure(profileError)) return setError(NETWORK_TIMEOUT_MESSAGE)
        return setError('登录没有完成，请稍后再试')
      }

      if (nextProfile.role !== role) {
        setRole(nextProfile.role)
        setPassword('')
        return setError(
          nextProfile.role === 'teacher'
            ? '这个账号是教师账号，可以直接进入教师工作台'
            : '这个账号是学生账号，可以直接进入学生练习',
        )
      }

      const from = location.state?.from
      const home = nextProfile.role === 'teacher' ? '/teacher' : '/student'
      navigate(from && from.startsWith(home) ? from : home, { replace: true })
    } catch (error) {
      setError(loginErrorText(error))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'min-h-12 w-full rounded-lg border-[0.5px] border-gold bg-white px-4 py-3 text-base text-ink placeholder:text-ink/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-peach disabled:opacity-60'
  const submitClass =
    'min-h-12 w-full rounded-lg bg-ink py-3 text-base font-semibold tracking-widest text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <main className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-paper font-ui text-ink">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -left-24 top-[-10%] h-[28rem] w-[28rem] rounded-full bg-peach/70 blur-3xl" />
        <div className="absolute -right-20 bottom-[-8%] h-[26rem] w-[26rem] rounded-full bg-mountain/70 blur-3xl" />
      </div>
      <div className="relative flex min-h-screen items-start justify-center px-4 py-8 sm:items-center sm:px-8 sm:py-12">
      <motion.section
        initial={reduce ? false : { opacity: 0, scaleX: 0.92 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-6xl"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-8 -left-2 w-3 rounded-full bg-[linear-gradient(90deg,#f8f4ec,#c9b08a_42%,#f4efe4_70%,#c9b08a)] shadow-[0_8px_18px_rgba(44,44,44,0.08)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-8 -right-2 w-3 rounded-full bg-[linear-gradient(270deg,#f8f4ec,#c9b08a_42%,#f4efe4_70%,#c9b08a)] shadow-[0_8px_18px_rgba(44,44,44,0.08)]"
        />
        <div className="rounded-lg border-[0.5px] border-gold bg-[#F8F4EC] px-5 py-10 shadow-[0_22px_50px_rgba(44,44,44,0.08)] sm:px-16 sm:py-14">
        <header className="text-center">
          <InkSeal className="mx-auto h-14 w-16" />
          <h1 className="book-title mt-3 text-[1.75rem] text-ink">知微追</h1>
          <p className="mt-2 text-base tracking-[0.18em] text-ink/60">现代汉语研习工作台</p>
        </header>
        <div className="mx-auto mt-10 w-full max-w-lg">
        <p className="text-center text-base text-ink/60">请选择身份，然后登录</p>

        {!authLoading && signedInRole && (
          <div
            className={`mt-5 rounded-teacher px-4 py-3 text-sm ${
              signedInRole === 'teacher' ? 'bg-navy-50 text-navy-800' : 'bg-coral-50 text-gray-700'
            }`}
          >
            <p>
              当前已登录{signedInRole === 'teacher' ? '教师' : '学生'}：{signedInName}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                to={signedInRole === 'teacher' ? '/teacher' : '/student'}
                className="inline-flex min-h-9 items-center rounded-full bg-white px-3 font-medium text-gray-800 ring-1 ring-black/10"
              >
                {signedInRole === 'teacher' ? '进入教师工作台' : '进入学生练习'}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex min-h-9 items-center rounded-full px-3 text-gray-500 hover:bg-white"
              >
                退出登录
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3" role="group" aria-label="选择身份">
          {ROLES.map((item) => {
            const active = role === item.id
            const activeClass = item.id === 'student' ? 'bg-peach text-ink' : 'bg-mountain text-ink'
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => chooseRole(item.id)}
                className={`book-title min-h-12 rounded-lg border-[0.5px] border-gold text-base transition-colors ${
                  active ? activeClass : 'bg-white text-ink/70 hover:bg-peach/40'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-base font-medium text-ink/80">
              {student ? '学号' : '账号'}
            </span>
            <input
              className={inputClass}
              type="text"
              inputMode={student ? 'numeric' : 'text'}
              autoComplete="username"
              placeholder={student ? '请输入学号' : '请输入邮箱或账号'}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              disabled={loading}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-base font-medium text-ink/80">密码</span>
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </label>

          {error && (
            <div
              role="alert"
              className={`px-4 py-2.5 text-sm ${
                student
                  ? 'rounded-student-sm bg-coral-50 text-coral-600 ring-1 ring-coral-100'
                  : 'rounded-teacher border border-red-100 bg-red-50 text-red-600'
              }`}
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className={submitClass}>
            {loading ? '登录中…' : student ? '学生登录' : '教师登录'}
          </button>
        </form>

        {student ? (
          <p className="mt-5 text-center text-base text-ink/60">
            还没有账号？
            <Link to="/student/register" className="ml-1 font-medium text-ink hover:underline">
              立即注册
            </Link>
          </p>
        ) : (
          <p className="mt-5 text-center text-base text-ink/45">
            教师账号由管理员统一创建，如需开通请联系课程负责人。
          </p>
        )}
        </div>
        </div>
      </motion.section>
      </div>
    </main>
  )
}
