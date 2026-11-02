import { useEffect, useMemo, useState } from 'react'
import { Button, inputClass } from './ui.jsx'
import {
  fetchChapterByKnowledgePoint,
  fetchClasses,
  fetchGradedAnswerDetails,
  fetchStudentAnswerDetails,
  fetchStudentRoster,
} from '../../lib/api.js'
import { ANSWER_COLUMNS, summarizeAnswers, toAnswerDetailRow } from '../../lib/answerRows.js'
import { zhError } from '../../lib/errors.js'
import { downloadBlob, fileStamp, toCsv, toXlsxBlob } from '../../lib/tableExport.js'

const PAGE_SIZES = [10, 20, 50]

function applyView(source, { search, chapter, type, result, sortKey, sortDir }) {
  const keyword = search.trim().toLowerCase()
  const next = source.filter((row) => {
    if (chapter && row.章节 !== chapter) return false
    if (type && row.题型 !== type) return false
    if (result && row.作答结果 !== result) return false
    if (!keyword) return true
    return ANSWER_COLUMNS.some((key) => String(row[key]).toLowerCase().includes(keyword))
  })
  next.sort((a, b) => {
    const compared = String(a[sortKey]).localeCompare(String(b[sortKey]), 'zh', { numeric: true })
    return sortDir === 'asc' ? compared : -compared
  })
  return next
}

export default function AnswerDetails({ answerCount, accuracy, sessionCount }) {
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState(null)
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')
  const [exportError, setExportError] = useState('')
  const [search, setSearch] = useState('')
  const [roster, setRoster] = useState([])
  const [classOrder, setClassOrder] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [studentId, setStudentId] = useState('')
  const [studentRows, setStudentRows] = useState(null)
  const [studentTotal, setStudentTotal] = useState(null)
  const [studentLoading, setStudentLoading] = useState(false)
  const [chapter, setChapter] = useState('')
  const [type, setType] = useState('')
  const [result, setResult] = useState('')
  const [sortKey, setSortKey] = useState('作答时间')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const viewState = { search, chapter, type, result, sortKey, sortDir }

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    loadRows()
      .then(async (next) => {
        if (cancelled) return
        setRecords(next.records)
        setRows(next.rows)
        const [students, classes] = await Promise.all([fetchStudentRoster(), fetchClasses()])
        if (cancelled) return
        setRoster(students)
        setClassOrder(classes)
      })
      .catch((err) => {
        if (cancelled) return
        setRecords([])
        setRows([])
        setError(zhError(err, '明细加载失败，请稍后再试'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!studentId) {
      setStudentRows(null)
      setStudentTotal(null)
      return undefined
    }
    let cancelled = false
    setStudentLoading(true)
    setExportError('')
    Promise.all([fetchStudentAnswerDetails(studentId), fetchChapterByKnowledgePoint()])
      .then(([nextRecords, chapterOf]) => {
        if (cancelled) return
        setStudentTotal(nextRecords.length)
        setStudentRows(nextRecords.map((record) => toAnswerDetailRow(record, chapterOf)))
      })
      .catch((err) => {
        if (cancelled) return
        setStudentRows(null)
        setStudentTotal(null)
        setExportError(zhError(err, '这名学生的学习记录没有加载出来，请稍后再试'))
      })
      .finally(() => {
        if (!cancelled) setStudentLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  const sourceRows = studentId
    ? studentRows
    : !selectedClass || !rows
      ? rows
      : rows.filter((row) => (row.班级 || '未分班') === selectedClass)
  const viewRows = useMemo(
    () => (sourceRows ? applyView(sourceRows, viewState) : []),
    [sourceRows, search, chapter, type, result, sortKey, sortDir],
  )
  const pageCount = Math.max(1, Math.ceil(viewRows.length / pageSize) || 1)
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = viewRows.slice(safePage * pageSize, safePage * pageSize + pageSize)
  const summary = records ? summarizeAnswers(records) : null
  const aligned =
    summary &&
    answerCount != null &&
    summary.total === answerCount &&
    summary.accuracy === accuracy

  async function ensureRows() {
    if (records && rows) return { records, rows }
    const next = await loadRows()
    setRecords(next.records)
    setRows(next.rows)
    return next
  }

  async function rowsForStudent(id) {
    if (id === studentId && studentRows) return studentRows
    const [nextRecords, chapterOf] = await Promise.all([
      fetchStudentAnswerDetails(id),
      fetchChapterByKnowledgePoint(),
    ])
    const next = nextRecords.map((record) => toAnswerDetailRow(record, chapterOf))
    if (id === studentId) {
      setStudentRows(next)
      setStudentTotal(next.length)
    }
    return next
  }

  async function exportFile(format, scope) {
    if (exporting) return
    setExporting(`${format}-${scope}`)
    setExportError('')
    try {
      const loaded = await ensureRows()
      const base = scope === 'all' ? loaded.rows : studentId ? await rowsForStudent(studentId) : loaded.rows
      const data = scope === 'all' ? base : applyView(base, viewState)
      const stamp = fileStamp()
      const scopeName = scope === 'all' ? '全部数据' : '当前筛选'
      const filename = `学生作答明细-${scopeName}-${stamp}`
      await saveTable(format, data, filename)
    } catch (err) {
      setExportError(zhError(err, '导出没有完成，请稍后再试'))
    } finally {
      setExporting('')
    }
  }

  async function exportStudent(format) {
    if (!studentId || exporting) return
    const student = roster.find((item) => item.id === studentId)
    setExporting(`student-${format}`)
    setExportError('')
    try {
      const data = await rowsForStudent(studentId)
      if (!data.length) {
        setExportError('这名学生还没有学习记录')
        return
      }
      const who = [student?.display_name, student?.student_no].filter(Boolean).join('-') || '学生'
      await saveTable(format, data, `${who}-全部学习记录-${fileStamp()}`)
    } catch (err) {
      setExportError(zhError(err, '导出没有完成，请稍后再试'))
    } finally {
      setExporting('')
    }
  }

  const selectedStudent = roster.find((item) => item.id === studentId) ?? null
  const classGroups = useMemo(() => groupStudents(roster, classOrder), [roster, classOrder])
  const classStudents = classGroups.find((group) => group.className === selectedClass)?.students ?? []

  function toggleSort(key) {
    setPage(0)
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <section className="rounded-teacher border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">学生作答明细</h2>
          <p className="mt-0.5 text-xs text-gray-400">每一行是一名学生的一次作答，条数与上方作答总数一致</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={open ? 'primary' : 'secondary'} size="sm" onClick={() => setOpen((value) => !value)}>
            {open ? '收起明细' : '查看明细'}
          </Button>
          <ExportButtons busy={exporting} onExport={exportFile} />
        </div>
      </div>

      {exportError && <p className="px-4 py-2 text-sm text-red-600">{exportError}</p>}

      {open && (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
              }}
              placeholder="搜索姓名、学号、题干、答案"
              className={`${inputClass} min-w-52 flex-1`}
            />
            <label className="flex items-center gap-1.5 text-sm text-gray-500">
              班级
              <select
                aria-label="班级"
                value={selectedClass}
                onChange={(event) => {
                  setSelectedClass(event.target.value)
                  setStudentId('')
                  setPage(0)
                }}
                className={`${inputClass} min-w-52`}
              >
                <option value="">全部班级</option>
                {classGroups.map((group) => (
                  <option key={group.className} value={group.className}>
                    {group.className}
                  </option>
                ))}
              </select>
            </label>
            {selectedClass && (
              <label className="flex items-center gap-1.5 text-sm text-gray-500">
                学生
                <select
                  aria-label="学生"
                  value={studentId}
                  onChange={(event) => {
                    setStudentId(event.target.value)
                    setPage(0)
                  }}
                  className={`${inputClass} min-w-52`}
                >
                  <option value="">全部学生</option>
                  {classStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.display_name || '未命名'}
                      {student.student_no ? `（${student.student_no}）` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selectedStudent && (
              <>
                <Button variant="primary" size="sm" disabled={Boolean(exporting)} onClick={() => exportStudent('xlsx')}>
                  {exporting === 'student-xlsx' ? '正在导出…' : '导出该生 Excel'}
                </Button>
                <Button variant="primary" size="sm" disabled={Boolean(exporting)} onClick={() => exportStudent('csv')}>
                  {exporting === 'student-csv' ? '正在导出…' : '导出该生 CSV'}
                </Button>
              </>
            )}
            <FilterSelect label="章节" value={chapter} options={unique(sourceRows, '章节')} onChange={setChapter} resetPage={() => setPage(0)} />
            <FilterSelect label="题型" value={type} options={unique(sourceRows, '题型')} onChange={setType} resetPage={() => setPage(0)} />
            <FilterSelect label="作答结果" value={result} options={['正确', '不正确']} onChange={setResult} resetPage={() => setPage(0)} />
          </div>

          <p className="text-sm text-gray-500">
            {loading && '正在加载明细…'}
            {studentLoading && '正在加载这名学生的学习记录…'}
            {!loading && !studentLoading && error}
            {!studentId && !loading && summary && (
              <>
                作答 {summary.total} 条，正确 {summary.correct} 条，正确率 {summary.accuracy ?? '—'}%，涉及学生 {summary.students}{' '}
                人、练习 {summary.sessions} 次
                {viewRows.length !== summary.total ? `；当前筛选 ${viewRows.length} 条` : ''}
                {aligned ? '。与看板的作答总数、总体正确率一致' : ''}
                {summary && sessionCount != null && summary.sessions !== sessionCount
                  ? `。看板练习次数为 ${sessionCount}，其中已判分的练习是 ${summary.sessions} 次`
                  : ''}
              </>
            )}
            {selectedStudent && !studentLoading && studentTotal != null && (
              <>
                {selectedStudent.display_name || '未命名'}
                {selectedStudent.student_no ? `（${selectedStudent.student_no}）` : ''}
                {selectedStudent.class_name ? `，${selectedStudent.class_name}` : ''}
                的学习记录 {studentTotal} 条
                {viewRows.length !== studentTotal ? `，当前筛选 ${viewRows.length} 条` : '，可导出该生的全部记录'}
              </>
            )}
          </p>

          {!loading && !studentLoading && sourceRows && viewRows.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              {selectedStudent && studentTotal === 0 ? '这名学生还没有学习记录' : '没有符合条件的作答'}
            </p>
          )}

          {!loading && !studentLoading && viewRows.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[88rem] text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      {ANSWER_COLUMNS.map((key) => (
                        <th key={key} className="whitespace-nowrap px-3 py-2.5 font-medium">
                          <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1">
                            {key}
                            <span className="text-navy-400">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={row.记录编号} className="align-top hover:bg-gray-50">
                        {ANSWER_COLUMNS.map((key) => (
                          <td key={key} className="border-t border-gray-100 px-3 py-2.5 text-gray-700">
                            <div className="max-h-36 max-w-xs overflow-y-auto whitespace-pre-wrap break-words">{row[key]}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
                <label className="flex items-center gap-2">
                  每页
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value))
                      setPage(0)
                    }}
                    className={inputClass}
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size} 条
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>
                    上一页
                  </Button>
                  <span className="tabular-nums">
                    {safePage + 1} / {pageCount}
                  </span>
                  <Button variant="secondary" size="sm" disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}>
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function groupStudents(students, classes) {
  const order = new Map((classes ?? []).map((item) => [item.name, item.sort_order ?? 0]))
  const map = new Map()
  for (const student of students ?? []) {
    const name = student.class_name || '未分班'
    if (!map.has(name)) map.set(name, [])
    map.get(name).push(student)
  }
  return [...map.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999) || a[0].localeCompare(b[0], 'zh'))
    .map(([className, list]) => ({
      className,
      students: [...list].sort((a, b) =>
        String(a.student_no ?? '').localeCompare(String(b.student_no ?? ''), 'zh', { numeric: true }),
      ),
    }))
}

async function saveTable(format, data, filename) {
  if (format === 'csv') {
    downloadBlob(new Blob([toCsv(ANSWER_COLUMNS, data)], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`)
    return
  }
  downloadBlob(await toXlsxBlob(ANSWER_COLUMNS, data), `${filename}.xlsx`)
}

async function loadRows() {
  const [records, chapterOf] = await Promise.all([fetchGradedAnswerDetails(), fetchChapterByKnowledgePoint()])
  return {
    records,
    rows: records.map((record) => toAnswerDetailRow(record, chapterOf)),
  }
}

function unique(rows, key) {
  if (!rows) return []
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'))
}

function FilterSelect({ label, value, options, onChange, resetPage }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-gray-500">
      {label}
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          resetPage()
        }}
        className={inputClass}
      >
        <option value="">全部</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function ExportButtons({ busy, onExport }) {
  const items = [
    ['xlsx', 'filtered', 'Excel·当前筛选'],
    ['xlsx', 'all', 'Excel·全部'],
    ['csv', 'filtered', 'CSV·当前筛选'],
    ['csv', 'all', 'CSV·全部'],
  ]
  return (
    <>
      {items.map(([format, scope, label]) => (
        <Button
          key={`${format}-${scope}`}
          variant="secondary"
          size="sm"
          disabled={Boolean(busy)}
          onClick={() => onExport(format, scope)}
        >
          {busy === `${format}-${scope}` ? '正在导出…' : label}
        </Button>
      ))}
    </>
  )
}
