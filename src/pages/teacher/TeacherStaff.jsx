import { useCallback, useEffect, useState } from 'react'
import { zhError } from '../../lib/errors.js'
import { createTeacher, deleteTeacher, fetchTeachers, resetTeacherPassword } from '../../lib/teacherAdmin.js'

const fieldClass =
  'mt-1 w-full rounded-lg border-[0.5px] border-gold bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-60'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function PaperDialog({ title, busy, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-teacher bg-paper p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="book-title text-lg text-ink">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export default function TeacherStaff() {
  const [teachers, setTeachers] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  const [pendingReset, setPendingReset] = useState(null)
  const [nextPassword, setNextPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetting, setResetting] = useState(false)

  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoadError('')
    fetchTeachers()
      .then(setTeachers)
      .catch((err) => {
        setTeachers([])
        setLoadError(zhError(err, '教师列表加载失败'))
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function closeAdd() {
    if (adding) return
    setShowAdd(false)
    setName('')
    setAccount('')
    setPassword('')
    setAddError('')
  }

  async function handleAdd(event) {
    event.preventDefault()
    const teacherName = name.trim()
    const loginAccount = account.trim()
    if (!teacherName) return setAddError('请填写姓名')
    if (!loginAccount) return setAddError('请填写登录邮箱或账号')
    if (password.length < 6) return setAddError('初始密码至少 6 位')

    setAdding(true)
    setAddError('')
    try {
      await createTeacher({ name: teacherName, account: loginAccount, password })
      setNotice(`已添加教师「${teacherName}」`)
      setShowAdd(false)
      setName('')
      setAccount('')
      setPassword('')
      load()
    } catch (err) {
      setAddError(zhError(err, '添加教师失败'))
    } finally {
      setAdding(false)
    }
  }

  async function handleReset(event) {
    event.preventDefault()
    if (!pendingReset) return
    if (nextPassword.length < 6) return setResetError('新密码至少 6 位')
    setResetting(true)
    setResetError('')
    try {
      const result = await resetTeacherPassword(pendingReset.id, nextPassword)
      if (result?.id && result.id !== pendingReset.id) {
        throw new Error('重置后账号标识发生了变化')
      }
      setNotice(`已重置「${pendingReset.display_name || '该教师'}」的密码`)
      setPendingReset(null)
      setNextPassword('')
    } catch (err) {
      setResetError(zhError(err, '重置密码失败'))
    } finally {
      setResetting(false)
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteTeacher(pendingDelete.id)
      setNotice(`已删除教师「${pendingDelete.display_name || '该教师'}」`)
      setPendingDelete(null)
      load()
    } catch (err) {
      setDeleteError(zhError(err, '删除教师失败'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">教师管理</h1>
          <p className="mt-1 text-sm text-ink/60">
            管理普通教师账号。纯数字账号会自动加上 @chinese.local。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true)
            setAddError('')
          }}
          className="shrink-0 rounded-teacher bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/90"
        >
          + 添加新教师
        </button>
      </header>

      {notice && (
        <div role="status" className="rounded-teacher bg-peach/40 px-4 py-2 text-sm text-ink">
          {notice}
        </div>
      )}

      <section className="overflow-hidden rounded-teacher bg-white">
        {loadError ? (
          <div className="flex items-center justify-between p-6 text-sm text-coral-600">
            <span>{loadError}</span>
            <button type="button" onClick={load} className="text-ink underline">
              重新加载
            </button>
          </div>
        ) : teachers === null ? (
          <div className="p-6 text-sm text-ink/50">加载中…</div>
        ) : teachers.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink/50">还没有普通教师，点击右上角添加</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-ink/60">
              <tr>
                <th className="px-4 py-2.5 font-medium">姓名</th>
                <th className="px-4 py-2.5 font-medium">登录邮箱</th>
                <th className="px-4 py-2.5 font-medium">添加日期</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/30">
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td className="px-4 py-2.5 font-medium text-ink">{teacher.display_name || '—'}</td>
                  <td className="px-4 py-2.5 text-ink/80">{teacher.email || '—'}</td>
                  <td className="px-4 py-2.5 text-ink/60">{formatDate(teacher.created_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingReset(teacher)
                        setNextPassword('')
                        setResetError('')
                      }}
                      className="mr-3 text-ink hover:underline"
                    >
                      重置密码
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDelete(teacher)
                        setDeleteError('')
                      }}
                      className="text-coral-600 hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showAdd && (
        <PaperDialog title="添加新教师" busy={adding} onClose={closeAdd}>
          <form onSubmit={handleAdd} noValidate className="mt-4 space-y-3">
            <label className="block text-sm text-ink/80">
              姓名
              <input
                autoFocus
                className={fieldClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={adding}
                placeholder="请输入教师姓名"
              />
            </label>
            <label className="block text-sm text-ink/80">
              登录邮箱
              <input
                className={fieldClass}
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                disabled={adding}
                placeholder="邮箱，或纯数字账号"
                autoComplete="off"
              />
            </label>
            <label className="block text-sm text-ink/80">
              初始密码
              <input
                type="password"
                className={fieldClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={adding}
                placeholder="至少 6 位"
                autoComplete="new-password"
              />
            </label>
            {addError && <p className="text-sm text-coral-600">{addError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={adding}
                onClick={closeAdd}
                className="rounded-teacher bg-white px-4 py-2 text-sm text-ink/70 hover:bg-peach/40 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={adding}
                className="rounded-teacher bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/90 disabled:opacity-60"
              >
                {adding ? '添加中…' : '确认添加'}
              </button>
            </div>
          </form>
        </PaperDialog>
      )}

      {pendingReset && (
        <PaperDialog
          title={`重置「${pendingReset.display_name || '教师'}」的密码`}
          busy={resetting}
          onClose={() => !resetting && setPendingReset(null)}
        >
          <form onSubmit={handleReset} noValidate className="mt-4 space-y-3">
            <p className="text-sm text-ink/60">只更换密码，账号和已有数据都会保留。</p>
            <label className="block text-sm text-ink/80">
              新密码
              <input
                autoFocus
                type="password"
                className={fieldClass}
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                disabled={resetting}
                placeholder="至少 6 位"
                autoComplete="new-password"
              />
            </label>
            {resetError && <p className="text-sm text-coral-600">{resetError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={resetting}
                onClick={() => setPendingReset(null)}
                className="rounded-teacher bg-white px-4 py-2 text-sm text-ink/70 hover:bg-peach/40 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={resetting}
                className="rounded-teacher bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/90 disabled:opacity-60"
              >
                {resetting ? '保存中…' : '保存新密码'}
              </button>
            </div>
          </form>
        </PaperDialog>
      )}

      {pendingDelete && (
        <PaperDialog
          title="删除教师"
          busy={deleting}
          onClose={() => !deleting && setPendingDelete(null)}
        >
          <p className="mt-3 text-sm text-ink/70">
            确定删除「{pendingDelete.display_name || pendingDelete.email}」？该教师将无法再登录。题目和试卷会保留。
          </p>
          {deleteError && <p className="mt-2 text-sm text-coral-600">{deleteError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              className="rounded-teacher bg-white px-4 py-2 text-sm text-ink/70 hover:bg-peach/40 disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="rounded-teacher bg-coral-600 px-4 py-2 text-sm text-white hover:bg-coral-500 disabled:opacity-60"
            >
              {deleting ? '删除中…' : '确认删除'}
            </button>
          </div>
        </PaperDialog>
      )}
    </div>
  )
}
