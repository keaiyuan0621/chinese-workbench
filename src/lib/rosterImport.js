import * as XLSX from 'xlsx'
import { toVirtualEmail } from './constants.js'
import { zhError } from './errors.js'
import { createEphemeralClient, supabase } from './supabase.js'

const NAME_RE = /^[\u4e00-\u9fa5·]{2,10}$/
const STUDENT_NO_RE = /^[A-Za-z0-9]{4,20}$/

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function downloadImportTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([['姓名', '学号']])
  sheet['!cols'] = [{ wch: 12 }, { wch: 22 }]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '学生名单')
  XLSX.writeFile(book, '学生导入模板.xlsx')
}

export function exportClassRoster(students, className) {
  const header = ['序号', '姓名', '学号', '班级名称', '初始密码']
  const body = students.map((student, index) => [
    index + 1,
    student.display_name ?? '',
    student.student_no ?? '',
    student.class_name || className || '',
    student.student_no ?? '',
  ])
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  sheet['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 22 }]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '学生名单')
  const safeName = (className || '班级').replace(/[\\/:*?"<>|]/g, '')
  XLSX.writeFile(book, `${safeName}学生名单.xlsx`)
}

function cellText(value) {
  return String(value ?? '').trim()
}

export function parseRosterGrid(grid) {
  const rows = (grid ?? []).map((row) => (Array.isArray(row) ? row.map(cellText) : []))
  const headerIndex = rows.findIndex((row) => row.includes('姓名') && row.includes('学号'))
  const nameCol = headerIndex >= 0 ? rows[headerIndex].indexOf('姓名') : 0
  const noCol = headerIndex >= 0 ? rows[headerIndex].indexOf('学号') : 1
  const start = headerIndex >= 0 ? headerIndex + 1 : 0
  const students = []
  const errors = []
  const seen = new Set()

  for (let i = start; i < rows.length; i++) {
    const name = rows[i][nameCol] ?? ''
    const studentNo = rows[i][noCol] ?? ''
    if (!name && !studentNo) continue
    if (!NAME_RE.test(name)) {
      errors.push({ name, studentNo, reason: '姓名需为 2～10 个汉字' })
      continue
    }
    if (!STUDENT_NO_RE.test(studentNo)) {
      errors.push({ name, studentNo, reason: '学号需为 4～20 位数字或字母' })
      continue
    }
    const key = studentNo.toLowerCase()
    if (seen.has(key)) {
      errors.push({ name, studentNo, reason: '学号在表格中重复' })
      continue
    }
    seen.add(key)
    students.push({ name, studentNo })
  }

  return { students, errors }
}

export function readRosterFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const book = XLSX.read(reader.result, { type: 'array' })
        const sheet = book.Sheets[book.SheetNames[0]]
        const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
        resolve(parseRosterGrid(grid))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}

async function registerStudent(client, student, classId, className) {
  const { data, error } = await client.auth.signUp({
    email: toVirtualEmail(student.studentNo),
    password: student.studentNo,
    options: {
      data: {
        display_name: student.name,
        student_no: student.studentNo,
        class_id: classId,
        class_name: className,
      },
    },
  })
  if (data?.session) await client.auth.signOut()
  if (error) {
    const message = error.message ?? ''
    if (/already registered|already been registered|already exists/i.test(message)) {
      return { ok: false, reason: '学号已存在' }
    }
    return { ok: false, reason: zhError(error, '注册失败') }
  }
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, reason: '学号已存在' }
  }
  const userId = data.user?.id
  if (!userId) return { ok: false, reason: '注册没有完成' }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      display_name: student.name,
      student_no: student.studentNo,
      class_id: classId,
      class_name: className,
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle()
  if (updateError) return { ok: false, reason: zhError(updateError, '写入学生资料失败') }
  if (!updated) return { ok: false, reason: '写入学生资料失败' }
  return { ok: true }
}

export async function importStudents({ students, errors = [], classId, className, onProgress }) {
  const failed = errors.map((item) => ({ ...item }))
  let ok = 0
  const total = students.length + failed.length
  const client = createEphemeralClient()
  onProgress?.({ done: failed.length, total: Math.max(total, 1), ok, failed: failed.length })

  for (let i = 0; i < students.length; i++) {
    const student = students[i]
    const result = await registerStudent(client, student, classId, className)
    if (result.ok) ok += 1
    else failed.push({ ...student, reason: result.reason })
    onProgress?.({ done: failed.length + ok, total, ok, failed: failed.length })
    if (i < students.length - 1) await sleep(400)
  }

  return { ok, failed: failed.length, details: failed }
}
