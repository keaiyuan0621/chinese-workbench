import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context.js'
import FullPageLoading from './FullPageLoading.jsx'

const ROLE_LABEL = { student: '学生', teacher: '教师' }

function Blocked({ title, desc, onSignOut }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-8 text-center space-y-4">
        <div className="text-3xl">🔒</div>
        <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        {desc && <p className="text-sm text-gray-500">{desc}</p>}
        <div className="flex gap-3 justify-center pt-2">
          <Link
            to="/"
            className="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            返回首页
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2 rounded-lg text-sm bg-navy-600 text-white hover:bg-navy-700"
          >
            退出登录
          </button>
        </div>
      </div>
    </main>
  )
}

/**
 * 路由守卫：未登录 → 跳转登录页；角色不符 → 提示。
 */
export default function RequireRole({ role, loginPath, children }) {
  const { loading, session, profile, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoading />

  if (!session) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />
  }

  if (!profile) {
    return (
      <Blocked
        title="未找到账号资料"
        desc="账号已登录，但缺少用户资料，请联系教师处理。"
        onSignOut={signOut}
      />
    )
  }

  if (profile.role !== role) {
    return (
      <Blocked
        title="当前账号无法访问此页面"
        desc={`这是${ROLE_LABEL[role]}专用页面，当前登录的是${ROLE_LABEL[profile.role] ?? '其他'}账号。`}
        onSignOut={signOut}
      />
    )
  }

  return children
}
