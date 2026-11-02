import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

/** 学生端登录/注册的外壳卡片 */
export function AuthCard({ emoji, title, subtitle, children }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-paper font-ui">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="w-full max-w-md bg-white rounded-lg border-[0.5px] border-gold p-8"
      >
        <div className="text-center">
          <div className="text-4xl">{emoji}</div>
          <h1 className="mt-3 text-2xl text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className="mt-6">{children}</div>
        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600">
            ← 返回首页
          </Link>
        </div>
      </motion.div>
    </main>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border-[0.5px] border-gold bg-white px-4 py-2.5 text-ink ' +
  'placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-peach focus:border-gold ' +
  'disabled:opacity-60 transition'

export function ErrorBanner({ children }) {
  if (!children) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-student-sm bg-coral-50 text-coral-600 text-sm px-4 py-2.5 ring-1 ring-coral-100"
      role="alert"
    >
      {children}
    </motion.div>
  )
}

export function SuccessBanner({ children }) {
  if (!children) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-student-sm bg-mint-50 text-mint-600 text-sm px-4 py-2.5 ring-1 ring-mint-100"
      role="status"
    >
      {children}
    </motion.div>
  )
}

export function PrimaryButton({ children, loading, ...rest }) {
  return (
    <motion.button
      whileHover={{ scale: loading ? 1 : 1.02 }}
      whileTap={{ scale: loading ? 1 : 0.98 }}
      disabled={loading}
      className="w-full rounded-lg bg-ink py-3 font-semibold tracking-widest text-paper hover:bg-ink/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      {...rest}
    >
      {loading ? '请稍候…' : children}
    </motion.button>
  )
}
