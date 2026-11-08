import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context.js'
import { isSuperAdmin } from '../../lib/roles.js'
import FullPageLoading from '../shared/FullPageLoading.jsx'

/** 超级管理员专页。普通教师直接打开地址时回到看板。 */
export default function AdminOnly({ children }) {
  const { loading, profile } = useAuth()
  if (loading) return <FullPageLoading />
  if (!isSuperAdmin(profile?.role)) return <Navigate to="/teacher" replace />
  return children
}
