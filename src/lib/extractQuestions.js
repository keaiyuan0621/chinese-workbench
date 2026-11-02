import { matchTextbookNode, TEXTBOOK_LABEL } from './textbook.js'

const QUESTION_START = /(?:^|\n)\s*(\d{1,3})\s*[、.．]\s*/g

/**
 * 从教材练习、课件讲义的纯文本里拆题。
 * 知识点只允许落在《现代汉语》增订七版的节次上。
 */
export function extractQuestionsFromText(text) {
  const normalized = String(text ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
  if (!normalized) return []

  const blocks = splitBlocks(normalized)
  const drafts = []
  for (const block of blocks) {
    const draft = parseBlock(block)
    if (draft) drafts.push(draft)
  }
  return drafts
}

function splitBlocks(text) {
  const marks = [...text.matchAll(QUESTION_START)]
  if (marks.length === 0) return [text]
  const blocks = []
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index + marks[i][0].length
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length
    const body = text.slice(start, end).trim()
    if (body) blocks.push(body)
  }
  return blocks
}

function parseBlock(block) {
  const answerMatch = block.match(/(?:参考答案|答案|【答案】)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:解析|【解析】|难度)|$)/)
  const explainMatch = block.match(/(?:解析|【解析】|答题要点)\s*[:：]\s*([\s\S]*)$/)
  let body = block
  if (explainMatch) body = body.slice(0, explainMatch.index).trim()
  if (answerMatch) body = body.slice(0, answerMatch.index).trim()

  const { stem, options } = splitOptions(body)
  const cleanStem = stem.replace(/\s+/g, ' ').trim()
  if (cleanStem.length < 4) return null

  const answerText = answerMatch ? answerMatch[1].trim() : ''
  const explanationText = explainMatch ? explainMatch[1].trim() : ''
  const type = detectType(cleanStem, options, answerText)
  const answer = buildAnswer(type, options, answerText)
  const node = matchTextbookNode(`${cleanStem}\n${explanationText}\n${answerText}`)
  const difficulty = detectDifficulty(cleanStem, type, explanationText)
  const pointPack = type === '简答' ? scoringFrom(answerText || explanationText) : { scoring_points: null, point_scores: null }

  const section = node ? `${node.chapter}·${node.name}` : '待核对节次'
  const explanation = [
    explanationText,
    `依据${TEXTBOOK_LABEL}${node ? `（${node.volume}${node.bookChapter}·${node.name}）` : ''}。`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    stem: cleanStem,
    type,
    options: options.length ? options : null,
    answer,
    explanation,
    reference_answer: type === '简答' ? answerText || explanationText || null : null,
    scoring_points: pointPack.scoring_points,
    point_scores: pointPack.point_scores,
    difficulty: difficulty.value,
    difficulty_reason: `${difficulty.reason}；材料属于${TEXTBOOK_LABEL}「${section}」。`,
    chapter: node?.chapter ?? '',
    knowledge_point_name: node?.name ?? '',
    textbook_volume: node?.volume ?? '',
    confident: Boolean(node) && Boolean(answerText),
    missing_answer: !answerText,
    missing_point: !node,
  }
}

function splitOptions(body) {
  const lines = body.split('\n')
  const options = []
  const stemLines = []
  const optRe = /^\s*([A-Ha-h])\s*[.、．]\s*(.+?)\s*$/
  for (const line of lines) {
    const m = line.match(optRe)
    if (m && stemLines.length) options.push({ key: m[1].toUpperCase(), text: m[2].trim() })
    else stemLines.push(line)
  }
  let stem = stemLines.join('\n').trim()
  if (!options.length) {
    const inline = [...stem.matchAll(/([A-Ha-h])\s*[.、．]\s*([^A-Ha-h\n]{1,40})/g)]
    if (inline.length >= 2) {
      const cut = stem.indexOf(inline[0][0])
      options.push(...inline.map((m) => ({ key: m[1].toUpperCase(), text: m[2].trim() })))
      stem = stem.slice(0, cut).trim()
    }
  }
  return { stem, options }
}

function detectType(stem, options, answerText) {
  if (/判断|对错/.test(stem) && options.length === 0) return '判断'
  if (/_{2,}|＿{2,}|（\s*）|\(\s*\)/.test(stem) && options.length === 0) return '填空'
  if (options.length >= 2) {
    const letters = answerText.replace(/[^A-Ha-h]/g, '').toUpperCase()
    if (letters.length >= 2 || /多选/.test(stem)) return '多选'
    return '单选'
  }
  if (/简答|论述|分析|说明|阐述|问答/.test(stem) || answerText.length > 24) return '简答'
  if (/对|错|正确|错误|√|×/.test(answerText) && answerText.length <= 4) return '判断'
  return '简答'
}

function buildAnswer(type, options, answerText) {
  const letters = answerText.replace(/[^A-Ha-h]/g, '').toUpperCase()
  if (type === '单选') return letters[0] || null
  if (type === '多选') return letters ? [...new Set(letters)].sort() : null
  if (type === '判断') {
    if (/错|误|×|否|不正确/.test(answerText)) return false
    if (/对|√|正确|是/.test(answerText)) return true
    return null
  }
  if (type === '填空') {
    const parts = answerText
      .split(/[；;／/|｜]/)
      .map((s) => s.replace(/^\s*\d+\s*[.、．]\s*/, '').trim())
      .filter(Boolean)
    return parts.length ? parts : null
  }
  return null
}

function scoringFrom(text) {
  const parts = String(text)
    .split(/[；;。\n]/)
    .map((s) => s.replace(/^\s*[（(]?\d+[）).、．]\s*/, '').trim())
    .filter((s) => s.length >= 4)
    .slice(0, 5)
  if (parts.length < 2) return { scoring_points: null, point_scores: null }
  const each = Math.max(1, Math.round(10 / parts.length))
  const scores = parts.map(() => each)
  scores[scores.length - 1] += 10 - each * parts.length
  return { scoring_points: parts, point_scores: scores }
}

/** 难度看材料复杂度，不看知识点个数。 */
function detectDifficulty(stem, type, explanation) {
  const len = stem.length + explanation.length
  const hard = /长句|多重复句|例外|特殊字|综合运用|套用|语段|层次分析|音位变体/.test(stem + explanation)
  const mid = /易错|变调|语境|分析|短句|形近|辨析/.test(stem + explanation) || type === '简答' || type === '多选'
  if (hard || len > 180) {
    return { value: 'high', reason: '材料长或含例外、多层分析，属高难度' }
  }
  if (mid || len > 70) {
    return { value: 'mid', reason: '材料变长或有易错点，需要套规则，属中难度' }
  }
  return { value: 'low', reason: '材料简短、用例典型，属低难度' }
}
