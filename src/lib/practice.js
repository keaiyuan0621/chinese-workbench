/**
 * 练习相关纯逻辑：抽题、判题、奖励文案、等级徽章
 */
import { fullScoreOf } from './aiGrading.js'

export const PRAISE = ['博学多才', '对答如流', '妙哉', '才思敏捷', '融会贯通', '一字不差']
export const COMFORT = [
  '没关系，再来一次～',
  '这题有点小陷阱',
  '差一点点，看看解析吧',
  '记住这个，下次就会了',
  '别灰心，错一次记得更牢',
]
export const STICKERS = ['⭐', '🌟', '✨', '🎉', '🎈', '🍭', '🍰', '🌈', '🦄', '💖', '🐣', '🍀', '🌸', '🎀']
export const COMBO_MILESTONES = [3, 5, 10]

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 从候选题中抽取 count 道；ratio 形如 { low: 5, mid: 3, high: 2 }，
 * 某档不足时从其他档补齐。
 */
export function sampleQuestions(candidates, count, ratio) {
  const n = Math.min(count, candidates.length)
  if (!ratio) return shuffle(candidates).slice(0, n)

  const total = ratio.low + ratio.mid + ratio.high
  const groups = {
    low: shuffle(candidates.filter((q) => q.difficulty === 'low')),
    mid: shuffle(candidates.filter((q) => q.difficulty === 'mid')),
    high: shuffle(candidates.filter((q) => q.difficulty === 'high')),
  }
  const target = {
    low: Math.round((n * ratio.low) / total),
    mid: Math.round((n * ratio.mid) / total),
  }
  target.high = Math.max(0, n - target.low - target.mid)

  const chosen = []
  const leftover = []
  for (const d of ['low', 'mid', 'high']) {
    chosen.push(...groups[d].slice(0, target[d]))
    leftover.push(...groups[d].slice(target[d]))
  }
  if (chosen.length < n) chosen.push(...shuffle(leftover).slice(0, n - chosen.length))
  return shuffle(chosen)
}

// ---------------- 判题 ----------------

/** 全角标点统一为半角，忽略空白与大小写 */
const PUNCT = { '，': ',', '。': '.', '、': ',', '；': ';', '：': ':', '！': '!', '？': '?', '（': '(', '）': ')' }

function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。、；：！？（）]/g, (c) => PUNCT[c])
}

/** 填空比对用：去掉空白和标点，只留核心字眼 */
function coreText(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。、；：！？,.!?:;'"“”‘’（）()【】[\]《》<>·…—\-、]/g, '')
}

/**
 * 填空：标准答案可用 / 或 | 列出多种写法。
 * 学生答案与任一写法完全一致，或（标准答案至少两个字时）包含该写法，都算对。
 * 例如标准答案「冷淡」，学生填「态度冷淡」判对；单字答案仍须完全一致，避免「是」被「不是」带过。
 */
function matchBlank(expected, got) {
  const student = coreText(got)
  if (!student) return false
  const alts = String(expected ?? '')
    .split(/[|/／｜]/)
    .map(coreText)
    .filter(Boolean)
  return alts.some((alt) => student === alt || ([...alt].length >= 2 && student.includes(alt)))
}

function charSpan(text) {
  const alts = String(text ?? '')
    .split(/[|/／｜]/)
    .map(coreText)
    .filter(Boolean)
  if (!alts.length) return ''
  const lens = alts.map((s) => [...s].length)
  const min = Math.min(...lens)
  const max = Math.max(...lens)
  return min === max ? `${min}个字` : `${min}-${max}个字`
}

/** 填空题干末尾的字数提示，只用于展示，不写入题干 */
export function fillStemHint(answer) {
  const blanks = Array.isArray(answer) ? answer : [answer]
  const parts = blanks
    .map((blank, i) => {
      const span = charSpan(blank)
      if (!span) return ''
      return blanks.length > 1 ? `第${i + 1}空请填写${span}` : `请填写${span}`
    })
    .filter(Boolean)
  if (!parts.length) return ''
  return `（提示：${parts.join('，')}的专业术语）`
}

/** 单个空的输入框提示 */
export function blankPlaceholder(expected) {
  const span = charSpan(expected)
  return span ? `请填写${span}` : '请输入答案'
}

export function isEssay(type) {
  return type === '简答' || type === 'correction'
}

export function isObjective(type) {
  return !isEssay(type)
}

function labelOf(item) {
  if (item && typeof item === 'object') return String(item.text ?? item.label ?? item.left ?? item.right ?? '').trim()
  return String(item ?? '').trim()
}

/** 连线题左右两列。options 形如 { left: [...], right: [...] } */
export function matchColumns(question) {
  const options = question?.options ?? {}
  const left = Array.isArray(options.left) ? options.left.map(labelOf).filter(Boolean) : []
  const right = Array.isArray(options.right) ? options.right.map(labelOf).filter(Boolean) : []
  return { left, right }
}

/** 标准答案统一成 { 左列原文: 右列原文 }。答案也可以是与左列等长的数组。 */
export function matchAnswerMap(answer, left = []) {
  if (Array.isArray(answer) && answer.every((item) => item == null || typeof item !== 'object')) {
    const map = {}
    left.forEach((item, index) => {
      map[item] = String(answer[index] ?? '')
    })
    return map
  }
  if (Array.isArray(answer)) {
    const map = {}
    for (const item of answer) {
      if (Array.isArray(item) && item.length >= 2) map[String(item[0])] = String(item[1] ?? '')
      else if (item && typeof item === 'object') {
        const key = String(item.left ?? item.key ?? '').trim()
        const value = String(item.right ?? item.value ?? '').trim()
        if (key) map[key] = value
      }
    }
    return map
  }
  if (answer && typeof answer === 'object') {
    return Object.fromEntries(Object.entries(answer).map(([key, value]) => [String(key), String(value ?? '')]))
  }
  return {}
}

/** 当前作答是否已填写完整 */
export function isAnswered(type, value, question) {
  switch (type) {
    case '单选':
      return typeof value === 'string' && value !== ''
    case '多选':
      return Array.isArray(value) && value.length > 0
    case '判断':
      return typeof value === 'boolean'
    case '填空':
      return Array.isArray(value) && value.length > 0 && value.every((v) => String(v ?? '').trim() !== '')
    case '简答':
    case 'correction':
      return typeof value === 'string' && value.trim() !== ''
    case 'match': {
      const chosen = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
      const { left } = matchColumns(question ?? {})
      return left.length > 0 && left.every((item) => String(chosen[item] ?? '').trim() !== '')
    }
    default:
      return false
  }
}

/** 客观题返回 true/false；简答返回 null（待批改） */
export function checkAnswer(question, value) {
  const { type, answer } = question
  switch (type) {
    case '单选':
      return norm(value) === norm(answer)
    case '判断':
      return typeof value === 'boolean' && value === Boolean(answer)
    case '多选': {
      const a = (Array.isArray(answer) ? answer : []).map(norm).sort()
      const s = (Array.isArray(value) ? value : []).map(norm).sort()
      return a.length === s.length && a.every((v, i) => v === s[i])
    }
    case '填空': {
      const a = Array.isArray(answer) ? answer : [answer]
      const s = Array.isArray(value) ? value : [value]
      return a.length === s.length && a.every((v, i) => matchBlank(v, s[i]))
    }
    case 'match': {
      const { left } = matchColumns(question)
      const expected = matchAnswerMap(answer, left)
      const chosen = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
      const keys = Object.keys(expected)
      return keys.length > 0 && keys.every((key) => norm(chosen[key]) === norm(expected[key]))
    }
    default:
      return null
  }
}

/** 把标准答案格式化成可读文本 */
export function formatAnswer(question) {
  const { type, answer, options } = question
  switch (type) {
    case '单选': {
      const opt = options?.find((o) => o.key === answer)
      return opt ? `${opt.key}. ${opt.text}` : String(answer)
    }
    case '多选':
      return (Array.isArray(answer) ? answer : []).join('、')
    case '判断':
      return answer ? '对' : '错'
    case '填空':
      return (Array.isArray(answer) ? answer : [answer]).join('；')
    case 'match':
      return Object.entries(matchAnswerMap(answer, matchColumns(question).left))
        .map(([left, right]) => `${left} → ${right}`)
        .join('；')
    default:
      return question.reference_answer ?? ''
  }
}

// ---------------- 结算 ----------------

export function summarize(questions, answersByQid) {
  let correct = 0
  let objective = 0
  let pending = 0
  let gradedShort = 0
  let earned = 0
  let possible = 0
  const wrong = []
  for (const q of questions) {
    const a = answersByQid[q.id]
    if (!a) continue
    if (!isObjective(q.type)) {
      if (a.needs_review || a.final_score == null) {
        pending++
        continue
      }
      const full = fullScoreOf(q)
      const got = Number(a.final_score)
      gradedShort++
      earned += got
      possible += full
      if (got >= full) correct++
      else wrong.push(q)
      continue
    }
    objective++
    possible += 1
    if (a.is_correct) {
      correct++
      earned += 1
    } else wrong.push(q)
  }
  const pct = possible ? Math.round((earned / possible) * 100) : pending ? null : 0
  return { correct, objective, pending, pct, wrong, gradedShort }
}

export function gradeBadge(pct) {
  if (pct === null) return { emoji: '📝', title: '已提交', text: '简答题等待老师批改' }
  if (pct >= 90) return { emoji: '🏆', title: '金牌学霸', text: '几乎全对，太厉害了！' }
  if (pct >= 75) return { emoji: '🥈', title: '银牌选手', text: '很棒，离满分只差一点点' }
  if (pct >= 60) return { emoji: '🥉', title: '铜牌达人', text: '不错哦，错题集里再巩固一下' }
  return { emoji: '🌱', title: '成长新芽', text: '每一次练习都在进步，继续加油' }
}
