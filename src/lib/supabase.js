import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // 开发期给出明确提示，避免静默失败
  console.warn(
    '[supabase] 缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，请检查 .env 文件（参考 .env.example）。',
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

/** 批量注册学生用的独立客户端，不会替换当前教师的登录状态。 */
export function createEphemeralClient() {
  return createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/** 课件文件所在的 Storage 桶名 */
export const MATERIALS_BUCKET =
  import.meta.env.VITE_SUPABASE_MATERIALS_BUCKET ?? 'course-materials'
