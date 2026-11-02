import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AuthCard,
  ErrorBanner,
  Field,
  PrimaryButton,
  SuccessBanner,
  inputClass,
} from '../../components/student/AuthCard.jsx'
import { fetchClasses } from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.js'
import { toVirtualEmail } from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'
import { supabase } from '../../lib/supabase.js'

const NAME_RE = /^[\u4e00-\u9fa5·]{2,10}$/
const STUDENT_NO_RE = /^[A-Za-z0-9]{4,20}$/
const MIN_PASSWORD = 6

export default function StudentRegister() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  const [classes, setClasses] = useState(null) // null = 加载中
  const [classesError, setClassesError] = useState('')

  const [form, setForm] = useState({ name: '', studentNo: '', classId: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchClasses()
      .then((rows) => !cancelled && setClasses(rows))
      .catch((err) => {
        if (cancelled) return
        setClasses([])
        setClassesError(zhError(err, '班级列表加载失败，请刷新页面重试'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function validate() {
    const name = form.name.trim()
    const no = form.studentNo.trim()
    if (!name) return '请输入姓名'
    if (!NAME_RE.test(name)) return '姓名请填写 2～10 个汉字'
    if (!no) return '请输入学号'
    if (!STUDENT_NO_RE.test(no)) return '学号为 4～20 位数字或字母'
    if (!form.classId) return '请选择班级'
    if (!form.password) return '请设置密码'
    if (form.password.length < MIN_PASSWORD) return `密码至少需要 ${MIN_PASSWORD} 位`
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const v = validate()
    if (v) return setError(v)

    const name = form.name.trim()
    const no = form.studentNo.trim()
    // <select> 的值是字符串，classes.id 是整数
    const cls = classes.find((c) => String(c.id) === form.classId)
    if (!cls) return setError('所选班级不存在，请重新选择')

    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: toVirtualEmail(no),
      password: form.password,
      options: {
        data: {
          display_name: name,
          student_no: no,
          class_id: cls.id,
          class_name: cls.name,
        },
      },
    })

    if (err) {
      setLoading(false)
      return setError(zhError(err, '注册失败，请稍后再试'))
    }

    // 开启邮箱确认时，重复注册不会报错，而是返回 identities 为空的用户
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setLoading(false)
      return setError('该学号已注册，请直接登录')
    }

    if (data.session) {
      // 触发器已按元数据写入 profiles；这里再兜底写一次，确保字段齐全
      await supabase
        .from('profiles')
        .update({ display_name: name, student_no: no, class_id: cls.id, class_name: cls.name })
        .eq('id', data.user.id)
      await refreshProfile()
      setLoading(false)
      navigate('/student', { replace: true })
      return
    }

    // 没有 session：说明项目仍开启了邮箱确认
    setLoading(false)
    setSuccess('注册成功，请前往登录')
    setTimeout(() => navigate('/student/login', { replace: true }), 1200)
  }

  const noClasses = classes !== null && classes.length === 0

  return (
    <AuthCard emoji="🌱" title="学生注册" subtitle="填写基本信息，开始你的练习之旅">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="姓名">
          <input
            className={inputClass}
            type="text"
            autoComplete="name"
            placeholder="请输入姓名"
            value={form.name}
            onChange={update('name')}
            disabled={loading}
          />
        </Field>

        <Field label="学号" hint="学号将作为你的登录账号">
          <input
            className={inputClass}
            type="text"
            inputMode="numeric"
            autoComplete="username"
            placeholder="请输入学号"
            value={form.studentNo}
            onChange={update('studentNo')}
            disabled={loading}
          />
        </Field>

        <Field label="班级">
          <select
            className={inputClass}
            value={form.classId}
            onChange={update('classId')}
            disabled={loading || classes === null || noClasses}
          >
            <option value="">
              {classes === null
                ? '班级列表加载中…'
                : noClasses
                  ? '暂无可选班级，请联系教师'
                  : '请选择班级'}
            </option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="密码" hint={`至少 ${MIN_PASSWORD} 位`}>
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            placeholder="请设置密码"
            value={form.password}
            onChange={update('password')}
            disabled={loading}
          />
        </Field>

        <ErrorBanner>{classesError || error}</ErrorBanner>
        <SuccessBanner>{success}</SuccessBanner>

        <PrimaryButton type="submit" loading={loading} disabled={loading || noClasses}>
          注册
        </PrimaryButton>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        已有账号？
        <Link to="/student/login" className="ml-1 font-medium text-ink hover:underline">
          直接登录
        </Link>
      </p>
    </AuthCard>
  )
}
