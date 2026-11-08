import { toAccountEmail } from './constants.js'
import { zhError } from './errors.js'
import { createEphemeralClient, supabase } from './supabase.js'

export function fetchTeachers() {
  return supabase.rpc('list_teachers').then(({ data, error }) => {
    if (error) throw error
    return data ?? []
  })
}

export async function createTeacher({ name, account, password }) {
  const email = toAccountEmail(account)
  const client = createEphemeralClient()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: name,
        role: 'teacher',
      },
    },
  })
  if (data?.session) await client.auth.signOut()
  if (error) {
    const message = error.message ?? ''
    if (/already registered|already been registered|already exists/i.test(message)) {
      throw new Error('该账号已存在')
    }
    throw new Error(zhError(error, '添加教师失败'))
  }
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('该账号已存在')
  }
  const userId = data.user?.id
  if (!userId) throw new Error('添加教师没有完成')

  let saved = false
  let lastError = null
  for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
    const { error: rpcError } = await supabase.rpc('ensure_teacher_profile', {
      target_id: userId,
      teacher_name: name,
    })
    if (!rpcError) {
      saved = true
      break
    }
    lastError = rpcError
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  if (!saved) throw new Error(zhError(lastError, '写入教师资料失败'))
  return { id: userId, email }
}

export async function resetTeacherPassword(id, password) {
  const { data, error } = await supabase.rpc('reset_teacher_password', {
    target_id: id,
    new_password: password,
  })
  if (error) throw new Error(zhError(error, '重置密码失败'))
  return data
}

export async function deleteTeacher(id) {
  const { error } = await supabase.rpc('delete_teacher', { target_id: id })
  if (error) throw new Error(zhError(error, '删除教师失败'))
}
