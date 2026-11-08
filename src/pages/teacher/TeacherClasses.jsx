import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createClass,
  deleteClass,
  fetchClasses,
  fetchStudentCountsByClass,
  fetchStudentRoster,
} from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.js'
import { zhError } from '../../lib/errors.js'
import {
  downloadImportTemplate,
  exportClassRoster,
  importStudents,
  readRosterFile,
} from '../../lib/rosterImport.js'

const MAX_NAME_LEN = 30

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function TeacherClasses() {
  const { user } = useAuth()

  const [classes, setClasses] = useState(null) // null = 加载中
  const [counts, setCounts] = useState({})
  const [loadError, setLoadError] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  const [pendingDelete, setPendingDelete] = useState(null) // 待确认删除的班级
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState('') // 顶部操作结果提示

  const [roster, setRoster] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [importSummary, setImportSummary] = useState(null)
  const [importError, setImportError] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [rows, c, students] = await Promise.all([
        fetchClasses(),
        fetchStudentCountsByClass(),
        fetchStudentRoster(),
      ])
      setClasses(rows)
      setCounts(c)
      setRoster(students)
      setLoadError('')
    } catch (err) {
      setClasses([])
      setRoster([])
      setLoadError(zhError(err, '班级列表加载失败，请刷新重试'))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    if (!classes?.length) return
    if (!classes.some((item) => item.id === selectedId)) setSelectedId(classes[0].id)
  }, [classes, selectedId])

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')

    const name = newName.trim()
    if (!name) return setAddError('请输入班级名称')
    if (name.length > MAX_NAME_LEN) return setAddError(`班级名称不能超过 ${MAX_NAME_LEN} 个字`)
    if (classes?.some((c) => c.name === name)) return setAddError('该班级已存在')

    setAdding(true)
    try {
      const created = await createClass(name, user?.id)
      setClasses((prev) =>
        [...(prev ?? []), created].sort(
          (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-CN'),
        ),
      )
      setNewName('')
      setShowAdd(false)
      setNotice(`已添加班级「${created.name}」`)
    } catch (err) {
      setAddError(zhError(err, '添加失败，请稍后再试'))
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteClass(pendingDelete.id)
      setClasses((prev) => prev.filter((c) => c.id !== pendingDelete.id))
      setNotice(`已删除班级「${pendingDelete.name}」`)
      setPendingDelete(null)
    } catch (err) {
      setNotice(zhError(err, '删除失败，请稍后再试'))
    } finally {
      setDeleting(false)
    }
  }

  const selected = classes?.find((item) => item.id === selectedId) ?? null
  const students = (roster ?? []).filter((student) => student.class_id === selectedId)

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!selected) {
      setImportError('请先点选要导入的班级')
      return
    }
    setImportError('')
    setImportSummary(null)
    setImporting(true)
    setProgress({ done: 0, total: 1 })
    try {
      const parsed = await readRosterFile(file)
      const total = parsed.students.length + parsed.errors.length
      if (total === 0) {
        setImportError('没有读到姓名和学号，请先下载导入模板')
        return
      }
      const summary = await importStudents({
        students: parsed.students,
        errors: parsed.errors,
        classId: selected.id,
        className: selected.name,
        onProgress: setProgress,
      })
      setImportSummary(summary)
      await load()
    } catch (err) {
      setImportError(zhError(err, '没能读取这份名单，请换用模板再试'))
    } finally {
      setImporting(false)
      setProgress(null)
    }
  }

  const total = classes?.length ?? 0

  return (
    <div className="space-y-5 max-w-4xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">班级管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            学生注册时只能从这里的班级中选择，共 {total} 个班级
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAdd((v) => !v)
            setAddError('')
          }}
          className="shrink-0 rounded-teacher bg-navy-700 text-white text-sm px-4 py-2 hover:bg-navy-800 transition-colors"
        >
          + 添加新班级
        </button>
      </header>

      {notice && (
        <div
          role="status"
          className="rounded-teacher bg-navy-50 border border-navy-100 text-navy-700 text-sm px-4 py-2"
        >
          {notice}
        </div>
      )}

      {showAdd && (
        <form
          onSubmit={handleAdd}
          noValidate
          className="rounded-teacher bg-white border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-start gap-3"
        >
          <div className="flex-1">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="请输入班级名称，如：2024级汉语言文学1班"
              maxLength={MAX_NAME_LEN}
              disabled={adding}
              className="w-full rounded-teacher border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-500 disabled:opacity-60"
            />
            {addError && <p className="mt-1.5 text-xs text-red-600">{addError}</p>}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="rounded-teacher bg-navy-700 text-white text-sm px-4 py-2 hover:bg-navy-800 disabled:opacity-60"
            >
              {adding ? '添加中…' : '确认添加'}
            </button>
            <button
              type="button"
              disabled={adding}
              onClick={() => {
                setShowAdd(false)
                setNewName('')
                setAddError('')
              }}
              className="rounded-teacher bg-gray-100 text-gray-700 text-sm px-4 py-2 hover:bg-gray-200 disabled:opacity-60"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <section className="rounded-teacher bg-white border border-gray-200 overflow-hidden">
        {loadError ? (
          <div className="p-6 text-sm text-red-600 flex items-center justify-between">
            <span>{loadError}</span>
            <button type="button" onClick={load} className="text-navy-600 hover:underline">
              重新加载
            </button>
          </div>
        ) : classes === null ? (
          <div className="p-6 text-sm text-gray-400">加载中…</div>
        ) : classes.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            还没有班级，点击右上角「+ 添加新班级」创建第一个班级
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium w-12">序号</th>
                <th className="px-4 py-2.5 font-medium">班级名称</th>
                <th className="px-4 py-2.5 font-medium w-28 text-right">学生人数</th>
                <th className="px-4 py-2.5 font-medium w-32">创建日期</th>
                <th className="px-4 py-2.5 font-medium w-24 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.map((c, i) => {
                const n = counts[c.id] ?? 0
                const on = c.id === selectedId
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`cursor-pointer ${on ? 'bg-navy-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{n}</td>
                    <td className="px-4 py-2.5 text-gray-500">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setPendingDelete(c)
                        }}
                        className="text-red-600 hover:text-red-700 hover:underline"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-navy-800">
              {selected ? `${selected.name}的学生名单` : '学生名单'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">点选上方班级后导入或导出。学生用学号登录，初始密码就是学号。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selected || roster === null}
              onClick={() => exportClassRoster(students, selected?.name)}
              className="rounded-teacher bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              导出名单
            </button>
            <button
              type="button"
              onClick={downloadImportTemplate}
              className="rounded-teacher bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 hover:bg-gray-50"
            >
              下载导入模板
            </button>
            <button
              type="button"
              disabled={!selected || importing}
              onClick={() => fileRef.current?.click()}
              className="rounded-teacher bg-navy-700 text-white text-sm px-4 py-2 hover:bg-navy-800 disabled:opacity-60"
            >
              {importing ? '正在导入…' : '批量导入名单'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </div>

        {progress && progress.total > 0 && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-navy-700 transition-all"
                style={{ width: `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              正在导入 {progress.done} / {progress.total}
            </p>
          </div>
        )}

        {importError && <p className="text-sm text-red-600">{importError}</p>}

        {importSummary && (
          <div role="status" className="rounded-teacher bg-navy-50 border border-navy-100 px-4 py-3 text-sm text-navy-800">
            <p>
              成功导入 {importSummary.ok} 人，失败 {importSummary.failed} 人（学号已存在等）
            </p>
            {importSummary.details.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-navy-700">
                {importSummary.details.slice(0, 8).map((item, index) => (
                  <li key={`${item.studentNo ?? item.name}-${index}`}>
                    {[item.studentNo, item.name].filter(Boolean).join(' ') || '某一行'}：{item.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="rounded-teacher bg-white border border-gray-200 overflow-hidden">
          {roster === null ? (
            <div className="p-6 text-sm text-gray-400">加载中…</div>
          ) : !selected ? (
            <div className="p-8 text-center text-sm text-gray-400">请先选择一个班级</div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">这个班还没有学生，可以下载模板后批量导入</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium w-12">序号</th>
                  <th className="px-4 py-2.5 font-medium">姓名</th>
                  <th className="px-4 py-2.5 font-medium">学号</th>
                  <th className="px-4 py-2.5 font-medium">班级名称</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student, index) => (
                  <tr key={student.id}>
                    <td className="px-4 py-2.5 text-gray-400">{index + 1}</td>
                    <td className="px-4 py-2.5 text-gray-800">{student.display_name}</td>
                    <td className="px-4 py-2.5 text-gray-700 tabular-nums">{student.student_no}</td>
                    <td className="px-4 py-2.5 text-gray-600">{student.class_name || selected.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {pendingDelete && (
        <ConfirmDialog
          cls={pendingDelete}
          studentCount={counts[pendingDelete.id] ?? 0}
          busy={deleting}
          onCancel={() => !deleting && setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

function ConfirmDialog({ cls, studentCount, busy, onCancel, onConfirm }) {
  const hasStudents = studentCount > 0
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-teacher bg-white shadow-xl border border-gray-200 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-800">确认删除班级</h2>
        <p className="mt-2 text-sm text-gray-600">
          确定要删除「{cls.name}」吗？此操作无法撤销。
        </p>
        {hasStudents && (
          <p className="mt-2 rounded-teacher bg-amber-50 border border-amber-100 text-amber-700 text-xs px-3 py-2">
            该班级下还有 {studentCount} 名学生，删除后这些学生的班级信息将被清空。
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-teacher bg-gray-100 text-gray-700 text-sm px-4 py-2 hover:bg-gray-200 disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-teacher bg-red-600 text-white text-sm px-4 py-2 hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  )
}
