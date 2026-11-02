import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL } from './constants.js'

export const ANSWER_COLUMNS = [
  '记录编号',
  '姓名',
  '学号',
  '班级',
  '作答时间',
  '章节',
  '知识点',
  '题型',
  '难度',
  '题干',
  '学生答案',
  '作答结果',
  '得分',
]

function text(value) {
  if (value == null) return ''
  return String(value)
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (item) => String(item).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatStudentAnswer(question, value) {
  if (value == null || value === '') return ''
  if (question?.type === '判断' && typeof value === 'boolean') return value ? '对' : '错'
  if (Array.isArray(value)) {
    return value
      .map((item) => (item == null ? '' : typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join('\n')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key} → ${item == null ? '' : typeof item === 'object' ? JSON.stringify(item) : item}`)
      .join('\n')
  }
  return String(value)
}

export function toAnswerDetailRow(record, chapterOf = {}) {
  const question = record.question ?? {}
  const student = record.student ?? {}
  const score = record.final_score ?? record.ai_score
  return {
    记录编号: text(record.id),
    姓名: text(student.display_name),
    学号: text(student.student_no),
    班级: text(student.class_name),
    作答时间: formatTime(record.created_at),
    章节: text(chapterOf[question.knowledge_point_id]),
    知识点: text(question.knowledge_point?.name),
    题型: text(QUESTION_TYPE_LABEL[question.type] ?? question.type),
    难度: text(DIFFICULTY_LABEL[question.difficulty] ?? question.difficulty),
    题干: text(question.stem),
    学生答案: formatStudentAnswer(question, record.student_answer),
    作答结果: record.is_correct === true ? '正确' : record.is_correct === false ? '不正确' : '',
    得分: score == null || score === '' ? '' : String(score),
  }
}

export function summarizeAnswers(records) {
  const total = records.length
  const correct = records.filter((record) => record.is_correct === true).length
  return {
    total,
    correct,
    accuracy: total ? Math.round((correct / total) * 100) : null,
    students: new Set(records.map((record) => record.student_id).filter(Boolean)).size,
    sessions: new Set(records.map((record) => record.session_id).filter(Boolean)).size,
  }
}
