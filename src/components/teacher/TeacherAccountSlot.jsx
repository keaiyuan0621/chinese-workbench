import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context.js'
import { isStaffRole } from '../../lib/roles.js'

/** 顶部右侧的教师入口：未登录显示「教师登录」，登录后显示姓名和退出。 */
export default function TeacherAccountSlot() {
  const { profile, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const teacher = !loading && isStaffRole(profile?.role)
  const label = profile?.display_name?.trim() || '教师工作台'

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  if (loading) {
    return <span className="text-sm text-gray-400">正在确认登录状态…</span>
  }

  if (!teacher) {
    return (
      <Link
        to="/teacher/login"
        className="inline-flex min-h-10 items-center rounded-teacher px-3 text-sm font-medium text-navy-700 hover:bg-navy-50"
      >
        教师登录
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        to="/teacher"
        className="inline-flex min-h-10 max-w-[12rem] items-center truncate rounded-teacher px-3 text-sm font-medium text-navy-800 hover:bg-navy-50"
      >
        {label}
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex min-h-10 items-center rounded-teacher px-3 text-sm text-gray-500 hover:bg-gray-100 hover:text-navy-700"
      >
        退出登录
      </button>
    </div>
  )
}
