import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './auth-context.js'
import { supabase } from './supabase.js'

async function loadProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, role, display_name, student_no, class_id, class_name, created_at')
    .eq('id', userId)
    .maybeSingle()
  return data ?? null
}

/**
 * 全局登录状态：session（Supabase Auth）+ profile（public.profiles）
 * loading 为 true 时表示还没拿到 session 或 profile，路由守卫应等待。
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = 尚未初始化
  // profile 与所属 userId 绑定，userId 变化时自动视为"未加载"
  const [profileState, setProfileState] = useState({ forUser: null, data: null })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    loadProfile(userId).then((data) => {
      if (!cancelled) setProfileState({ forUser: userId, data })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (!userId) return null
    const data = await loadProfile(userId)
    setProfileState({ forUser: userId, data })
    return data
  }, [userId])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const profile = userId && profileState.forUser === userId ? profileState.data : null
  const profileLoading = Boolean(userId) && profileState.forUser !== userId

  const value = useMemo(
    () => ({
      session: session ?? null,
      user: session?.user ?? null,
      profile,
      loading: session === undefined || profileLoading,
      refreshProfile,
      signOut,
    }),
    [session, profile, profileLoading, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
