import { extractQuestionsFromText } from './extractQuestions.js'
import { extractTextFromFile } from './extractText.js'
import { listTextbookNodes, TEXTBOOK_LABEL } from './textbook.js'

/**
 * 上传后的识别入口。
 * 若配置了题目识别接口，先请接口按教材节次补全；接口不可用时，改用正文里的题号、选项、答案、解析。
 * 两种结果都会再核对一遍，知识点超出教材节次的一律丢掉。
 */
export async function recognizeFile(file) {
  const text = (await extractTextFromFile(file)).trim()
  if (!text) {
    throw new Error('没有读到文字。扫描版 PDF 需要先转成可选中文字的文件，或改用 Word、PPT')
  }

  const endpoint = import.meta.env.VITE_AI_QUESTION_ENDPOINT
  let drafts = []
  let source = '正文识别'
  if (endpoint) {
    try {
      drafts = await recognizeByEndpoint(endpoint, text)
      if (drafts.length) source = '自动补全'
    } catch {
      drafts = []
    }
  }
  if (!drafts.length) drafts = extractQuestionsFromText(text)
  return { drafts: drafts.map(lockToTextbook), source, textLength: text.length }
}

async function recognizeByEndpoint(endpoint, text) {
  const nodes = listTextbookNodes().map((n) => ({
    chapter: n.chapter,
    name: n.name,
    volume: n.volume,
  }))
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      textbook: TEXTBOOK_LABEL,
      instruction:
        '只根据给定正文提取练习题。知识点必须从 nodes 里选择，不得新造。题型只能是单选、多选、判断、填空、简答。难度只能是 low、mid、high，且按材料复杂度而不是知识点数量判断。',
      nodes,
      text: text.slice(0, 20000),
    }),
  })
  if (!res.ok) throw new Error('识别接口不可用')
  const data = await res.json()
  const list = Array.isArray(data) ? data : data?.questions
  if (!Array.isArray(list)) return []
  return list
    .map((q) => ({
      stem: String(q.stem ?? '').trim(),
      type: q.type,
      options: Array.isArray(q.options) ? q.options : null,
      answer: q.answer ?? null,
      explanation: String(q.explanation ?? ''),
      reference_answer: q.reference_answer ?? null,
      scoring_points: q.scoring_points ?? null,
      point_scores: q.point_scores ?? null,
      difficulty: q.difficulty,
      difficulty_reason: q.difficulty_reason ?? '',
      chapter: q.chapter ?? '',
      knowledge_point_name: q.knowledge_point_name ?? q.knowledge_point ?? '',
      missing_answer: q.answer == null || q.answer === '',
      missing_point: !q.knowledge_point_name && !q.knowledge_point,
      confident: true,
    }))
    .filter((q) => q.stem.length >= 4)
}

function lockToTextbook(draft) {
  const allowed = listTextbookNodes()
  const hit =
    allowed.find((n) => n.chapter === draft.chapter && n.name === draft.knowledge_point_name) ||
    allowed.find((n) => n.name === draft.knowledge_point_name)
  if (!hit) {
    return { ...draft, chapter: '', knowledge_point_name: '', missing_point: true, confident: false }
  }
  return {
    ...draft,
    chapter: hit.chapter,
    knowledge_point_name: hit.name,
    textbook_volume: hit.volume,
    missing_point: false,
  }
}
