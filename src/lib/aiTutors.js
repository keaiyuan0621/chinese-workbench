import { trimTutorHistory } from './tutorHistory.js'
import { formatAnswer, formatStudentAnswer, matchColumns } from './practice.js'
import { supabase } from './supabase.js'

export const AI_TUTOR_ROLES = {
  jianwei: {
    id: 'jianwei',
    name: '见微',
    gate: '把细节讲清楚',
    note: '讲清选项差异和易漏之处',
    duty: '讲清细节、选项差异和易漏之处',
    startLabel: '请见微讲讲这题',
    askLabel: '想问哪个细节？',
    loadingLabel: '见微正在看这道题…',
  },
  zhizhu: {
    id: 'zhizhu',
    name: '知著',
    gate: '引导下一步思考',
    note: '只给下一步，不直接给答案',
    duty: '一步一步带你想，不急着给完整答案',
    startLabel: '请知著带我想想',
    askLabel: '想到哪一步了？可以说说你的想法',
    loadingLabel: '知著正在想下一问…',
  },
}

export function isAiTutorsUiEnabled() {
  const flag = import.meta.env.VITE_AI_TUTORS_ENABLED
  return flag !== 'false' && flag !== '0'
}

function optionText(question) {
  if (Array.isArray(question?.options)) {
    return question.options
      .map((item) => `${item.key}. ${item.text}`)
      .join('\n')
  }
  if (question?.type === 'match') {
    const { left, right } = matchColumns(question)
    return [`左列：${left.join('、')}`, `右列：${right.join('、')}`].join('\n')
  }
  return ''
}

export function buildTutorPayload(question, {
  studentAnswer,
  originalExplanation,
  role,
  message,
  history,
  withholdAnswer = false,
}) {
  const answerText =
    typeof studentAnswer === 'string' ? studentAnswer : formatStudentAnswer(question, studentAnswer)
  return {
    role,
    type: question?.type ?? '',
    stem: question?.stem ?? '',
    options: optionText(question),
    studentAnswer: answerText,
    originalExplanation: withholdAnswer ? '' : (originalExplanation ?? question?.explanation ?? ''),
    referenceAnswer: withholdAnswer ? '' : formatAnswer(question ?? {}),
    withholdAnswer: Boolean(withholdAnswer),
    message: message ?? '',
    history: trimTutorHistory(history),
  }
}

export async function askAiTutor(payload, { preview = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (!(preview && import.meta.env.DEV)) {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (token) headers.Authorization = `Bearer ${token}`
    } catch { return { ok: false, error: 'unauthorized', message: '登录状态读取失败，请重新登录' } }
  }
  if (preview && import.meta.env.DEV) headers['X-AI-Tutors-Preview'] = 'local'

  let response
  try {
    response = await fetch('/.netlify/functions/tutor', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch {
    return { ok: false, error: 'network', message: '网络连接失败，请检查网络后重试' }
  }

  let dataJson
  try {
    dataJson = await response.json()
  } catch {
    return { ok: false, error: 'upstream', message: '讲解服务暂时不可用，请稍后重试' }
  }

  if (dataJson?.ok && typeof dataJson.content === 'string') {
    return { ok: true, role: dataJson.role, content: dataJson.content }
  }
  return {
    ok: false,
    error: dataJson?.error || 'upstream',
    message: dataJson?.message || '讲解服务暂时不可用，请稍后重试',
  }
}
