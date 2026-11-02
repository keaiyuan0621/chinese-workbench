/**
 * 把题库 JSON 导入 questions。
 * knowledge_point_name 到 knowledge_points.name 上查 id，重名时再用 chapter 区分。
 * 在项目根目录执行：node import_questions.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const TYPE_MAP = {
  single: '单选',
  单选: '单选',
  multiple: '多选',
  multi: '多选',
  多选: '多选',
  judge: '判断',
  boolean: '判断',
  判断: '判断',
  blank: '填空',
  fill: '填空',
  填空: '填空',
  short: '简答',
  essay: '简答',
  简答: '简答',
  match: 'match',
  连线: 'match',
  correction: 'correction',
  病句修改: 'correction',
}

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
)

const FILE_NAMES = ['questions_yufa_juxing_jushi_julei.json', 'questions_yufa_biaodian.json']

const questions = FILE_NAMES.flatMap((name) => {
  const jsonPath = [path.resolve(name), path.resolve('..', name)].find((p) => fs.existsSync(p))
  if (!jsonPath) throw new Error(`找不到 ${name}。请放在项目根目录，或放在项目上一级目录。`)
  const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${name} 不是非空数组`)
  console.log(`${name}：${rows.length} 道`)
  return rows
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: 'teacher01@chinese.local',
  password: 'Test123456',
})
if (authError) throw authError

const { data: points, error: kpError } = await supabase
  .from('knowledge_points')
  .select('id, name, parent_id, level')
if (kpError) throw kpError

const byId = new Map(points.map((p) => [p.id, p]))

function chapterOf(point) {
  let current = point
  const guard = new Set()
  while (current?.parent_id && !guard.has(current.id)) {
    guard.add(current.id)
    current = byId.get(current.parent_id)
  }
  return current?.name ?? ''
}

function inChapter(point, chapter) {
  return !chapter || chapterOf(point) === chapter
}

function coversName(pointName, name) {
  if (pointName === name) return true
  const parts = pointName.split(/[、，,]/).flatMap((part) => part.split('和'))
  return parts.some((part) => part.trim() === name)
}

const NAME_ALIAS = {
  词汇的发展变化和规范: '词汇的发展变化和词汇的规范',
  多义短语与短语分析: '短语',
  定语和状语: '定语、状语、补语和中心语',
  补语和中心语: '定语、状语、补语和中心语',
  '句型（主谓句与非主谓句）': '句型',
  '句式（把字句、被字句等）': '句式',
  '句类（陈述、疑问等）': '句类',
  '复句的意义类型（并列、因果、转折等）': '复句的意义类型',
  '句式的选择（常式/变式、长/短句、整/散句等）': '句式的选择',
  '语体（口头语体、书面语体）': '语体',
  '词的结构（单纯词与合成词）': '词汇和词的结构',
  '词义的性质与构成': '词义的性质和构成',
  '语义场（同义词/反义词）': '语义场',
  '词汇的构成（外来词/方言词等）': '词汇的构成',
  '熟语（成语/歇后语等）': '熟语',
  '词汇的发展与规范': '词汇的发展变化和词汇的规范',
  '实词（名、动、形、数、量、代）': '实词',
  '虚词（副、介、连、助、叹）': '虚词',
  '句法成分（主谓宾定状补）': '句法成分',
  '句式（把字句、被字句、连动句等）': '句式',
  修辞概说与词语锤炼: '修辞概说',
  '核心辞格辨析（比喻/借代/比拟/排比/对偶等）': '辞格',
  汉字的形体与整理: '汉字的形体',
  词汇概说与词的结构: '词汇概说',
  词汇的构成与熟语: '词汇的构成',
  语境与词汇的发展规范: '语境与词义',
  '词类（实词与虚词）': '词类',
  '单句与句式（把字句/被字句等）': '单句',
  复句的意义类型与常见错误: '复句',
  词语与句式的选择: '词语的锤炼',
  '核心辞格的辨析与运用（如比喻、借代、排比、对偶等）': '辞格',
  '语体（口头与书面）': '语体',
}

function matchKnowledgePoint(item) {
  const rawName = String(item.knowledge_point_name ?? '').trim()
  const name = NAME_ALIAS[rawName] ?? rawName
  if (!name) throw new Error(`题目缺少知识点名称：${item.stem}`)
  const chapter = String(item.chapter ?? '').trim()
  const hits = pickDeepest(points.filter((p) => p.name === name && inChapter(p, chapter)))
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) throw new Error(`知识点「${name}」匹配到 ${hits.length} 条，无法确定 ID`)
  const covered = pickDeepest(
    points.filter((p) => inChapter(p, chapter) && (coversName(p.name, name) || p.name.includes(name))),
  )
  if (covered.length === 1) return covered[0]
  if (covered.length === 0) throw new Error(`知识点不存在：${chapter ? chapter + ' / ' : ''}${name}`)
  throw new Error(
    `知识点「${name}」对应多条：${covered.map((p) => p.name).join('、')}`,
  )
}

function pickDeepest(list) {
  if (list.length <= 1) return list
  const maxLevel = Math.max(...list.map((point) => point.level))
  return list.filter((point) => point.level === maxLevel)
}

function toType(raw) {
  const type = TYPE_MAP[String(raw ?? '').trim()]
  if (!type) throw new Error(`无法识别的题型：${raw}`)
  return type
}

function toOptions(type, options) {
  if (type === '判断' || type === '填空' || type === '简答' || type === 'correction') return null
  if (type === 'match') {
    const left = Array.isArray(options?.left) ? options.left.map((item) => String(item ?? '').trim()).filter(Boolean) : []
    const right = Array.isArray(options?.right) ? options.right.map((item) => String(item ?? '').trim()).filter(Boolean) : []
    if (!left.length || !right.length) throw new Error('连线题需要 options.left 和 options.right')
    return { left, right }
  }
  if (!Array.isArray(options) || options.length === 0) return null
  return options.map((opt, index) => {
    if (opt && typeof opt === 'object' && opt.key) {
      return { key: String(opt.key).trim(), text: String(opt.text ?? '').trim() }
    }
    const text = String(opt).trim()
    const matched = text.match(/^([A-Ha-h])\s*[.、．:：]\s*(.*)$/)
    if (matched) return { key: matched[1].toUpperCase(), text: matched[2].trim() }
    return { key: String.fromCharCode(65 + index), text }
  })
}

function toAnswer(type, raw, stem, options) {
  if (type === '判断') {
    if (raw === true || /^(正确|对|true|t|√)$/i.test(String(raw).trim())) return true
    if (raw === false || /^(错误|错|false|f|×|x)$/i.test(String(raw).trim())) return false
    throw new Error(`判断题答案无法识别：${stem}`)
  }
  if (type === '单选') {
    const text = String(raw ?? '').trim()
    const matched = text.match(/^([A-Ha-h])/)
    if (!matched) throw new Error(`单选题答案无法识别：${stem}`)
    return matched[1].toUpperCase()
  }
  if (type === '多选') {
    const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,，、\s]+/)
    const keys = parts.map((part) => String(part).trim().match(/^([A-Ha-h])/)?.[1]).filter(Boolean)
    if (!keys.length) throw new Error(`多选题答案无法识别：${stem}`)
    return [...new Set(keys.map((key) => key.toUpperCase()))].sort()
  }
  if (type === '填空') {
    const parts = Array.isArray(raw) ? raw : [raw]
    return parts.map((part) => String(part ?? '').trim()).filter(Boolean)
  }
  if (type === 'match') {
    const left = Array.isArray(options?.left) ? options.left.map((item) => String(item ?? '').trim()) : []
    if (Array.isArray(raw) && raw.every((item) => item == null || typeof item !== 'object')) {
      if (raw.length !== left.length) throw new Error(`连线题答案数量与左列不一致：${stem}`)
      return Object.fromEntries(left.map((item, index) => [item, String(raw[index] ?? '').trim()]))
    }
    if (raw && typeof raw === 'object') return raw
    throw new Error(`连线题答案无法识别：${stem}`)
  }
  return null
}

const rows = questions.map((item) => {
  const point = matchKnowledgePoint(item)
  const type = toType(item.type)
  const stem = String(item.stem ?? '').trim()
  if (!stem) throw new Error('存在空题干')
  return {
    knowledge_point_id: point.id,
    type,
    difficulty: item.difficulty,
    difficulty_reason: item.difficulty_reason ?? null,
    stem,
    options: toOptions(type, item.options),
    answer: toAnswer(type, item.answer, stem, item.options),
    explanation: item.explanation ?? null,
    reference_answer: item.reference_answer ?? null,
    scoring_points: item.scoring_points ?? null,
    point_scores: item.point_scores ?? null,
    created_by: auth.user.id,
  }
})

const stems = [...new Set(rows.map((row) => row.stem))]
const seen = new Set()
for (let i = 0; i < stems.length; i += 4) {
  const { data: existing, error: existingError } = await supabase
    .from('questions')
    .select('stem')
    .in('stem', stems.slice(i, i + 4))
  if (existingError) throw existingError
  for (const row of existing ?? []) seen.add(row.stem)
}
const fresh = rows.filter((row) => !seen.has(row.stem))

let inserted = 0
for (let i = 0; i < fresh.length; i += 40) {
  const batch = fresh.slice(i, i + 40)
  const { data, error } = await supabase.from('questions').insert(batch).select('id')
  if (error) throw error
  inserted += data.length
}

console.log(`成功导入 ${inserted} 道题（文件 ${rows.length} 道，已存在并跳过 ${rows.length - fresh.length} 道）`)
