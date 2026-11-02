/**
 * 简答按点给分。最终分 = 命中得分点的分值之和。
 * 置信度只决定要不要对照参考答案再判一次，不改分，也不因此送老师。
 * 只有网络失败或返回内容无法解析时，才进入教师复核。
 */

const CONFIDENT = 0.85

const SCORE_PROMPT =
  '请逐一判断学生答案是否命中了下列得分点（只要意思相近、同义替换即可算命中），并将命中的得分点分值相加。不要因为表述不同而扣分。'

function scorePrompt(question) {
  if (question?.type === 'correction') {
    return `${SCORE_PROMPT}请评估学生是否找出了语病并正确修改。`
  }
  return SCORE_PROMPT
}

const SYNONYM_GROUPS = [
  ['意义', '意思', '含义'],
  ['有声', '声音'],
  ['联系', '关联'],
  ['约定', '习惯'],
  ['社会属性', '社会约定'],
  ['物理属性', '声波'],
  ['生理属性', '发音器官'],
]

function canon(text) {
  let value = String(text ?? '')
  for (const group of SYNONYM_GROUPS) {
    for (const word of group.slice(1)) value = value.split(word).join(group[0])
  }
  return value
}

function contentBigrams(text) {
  const compact = canon(text).replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, '')
  const grams = []
  for (let i = 0; i < compact.length - 1; i++) grams.push(compact.slice(i, i + 2))
  return [...new Set(grams)]
}

function coverage(student, target) {
  const grams = contentBigrams(target)
  if (!grams.length) return 0
  const compact = canon(student).replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, '')
  const hit = grams.filter((gram) => compact.includes(gram)).length
  return hit / grams.length
}

function clauses(text) {
  return String(text ?? '')
    .split(/[。；;！？\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)
}

function anchorClause(point, materials) {
  let best = ''
  let bestScore = 0
  for (const material of materials) {
    for (const clause of clauses(material)) {
      const score = coverage(clause, point)
      if (score > bestScore) {
        bestScore = score
        best = clause
      }
    }
  }
  return bestScore >= 0.2 ? best : ''
}

function judgePoint(student, point, scoreValue, materials, reflect) {
  const direct = coverage(student, point)
  const directLine = reflect ? 0.34 : 0.42
  if (direct >= directLine) {
    return { hit: true, score: scoreValue, confidence: direct >= 0.55 ? 0.94 : 0.72 }
  }
  const anchor = anchorClause(point, materials)
  const via = anchor ? coverage(student, anchor) : 0
  const viaLine = reflect ? 0.4 : 0.58
  if (via >= viaLine) {
    return { hit: true, score: scoreValue, confidence: via >= 0.58 ? 0.9 : 0.7 }
  }
  const ratio = Math.max(direct, via)
  if (ratio <= 0.15) return { hit: false, score: 0, confidence: 0.93 }
  return { hit: false, score: 0, confidence: 0.58 }
}

function feedbackFor(hits, score, full) {
  if (!hits.some((item) => item.hit)) return '未达到得分点要求'
  const names = hits.filter((item) => item.hit).map((item) => item.point)
  return `命中得分点：${names.join('；')}。得分 ${score} / ${full}。`
}

function localJudge(question, studentAnswer, reflect) {
  const points = question.scoring_points ?? []
  const scores = question.point_scores ?? []
  const materials = [question.reference_answer, question.explanation].filter(Boolean)
  const referenceCover = coverage(studentAnswer, question.reference_answer ?? '')
  if (!reflect && referenceCover >= 0.6) {
    const pointHits = points.map((point, index) => ({
      point,
      hit: true,
      score: Number(scores[index] || 0),
    }))
    const score = pointHits.reduce((sum, item) => sum + item.score, 0)
    return { point_hits: pointHits, confidence: 0.95, feedback: feedbackFor(pointHits, score, score) }
  }
  const judged = points.map((point, index) =>
    judgePoint(studentAnswer, point, Number(scores[index] || 0), materials, reflect),
  )
  const pointHits = judged.map(({ hit, score }, index) => ({ point: points[index], hit, score }))
  const confidence = judged.reduce((sum, item) => sum + item.confidence, 0) / judged.length
  const score = pointHits.reduce((sum, item) => sum + item.score, 0)
  return { point_hits: pointHits, confidence, feedback: feedbackFor(pointHits, score, fullScoreOf(question)) }
}

function alignHits(question, rawHits) {
  const points = question.scoring_points ?? []
  const scores = question.point_scores ?? []
  if (!Array.isArray(rawHits) || rawHits.length === 0) throw new Error('解析错误')
  return points.map((point, index) => {
    const found =
      rawHits.find((item) => item && String(item.point ?? '') === point) ??
      rawHits.find((item) => item && (point.includes(String(item.point ?? '')) || String(item.point ?? '').includes(point))) ??
      rawHits[index]
    if (!found || typeof found.hit !== 'boolean') throw new Error('解析错误')
    const hit = found.hit
    return { point, hit, score: hit ? Number(scores[index] || 0) : 0 }
  })
}

async function remoteJudge(question, studentAnswer, reflect, previous) {
  const endpoint = import.meta.env?.VITE_AI_GRADING_ENDPOINT
  const materials = [question.reference_answer, question.explanation].filter(Boolean).join('\n')
  const basePrompt = scorePrompt(question)
  const prompt = reflect
    ? `${basePrompt}\n请结合教材资料和参考答案，重新逐条判断是否命中得分点。\n参考资料：\n${materials}\n上一次判断：${JSON.stringify(previous ?? {})}`
    : basePrompt
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        stem: question.stem,
        reference_answer: question.reference_answer,
        scoring_points: question.scoring_points ?? [],
        point_scores: question.point_scores ?? [],
        student_answer: studentAnswer,
      }),
    })
  } catch {
    throw new Error('网络错误')
  }
  if (!response.ok) throw new Error('网络错误')
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('解析错误')
  }
  if (typeof data?.confidence !== 'number' || typeof data?.score !== 'number') throw new Error('解析错误')
  const pointHits = alignHits(question, data.point_hits)
  return {
    point_hits: pointHits,
    confidence: Math.min(1, Math.max(0, data.confidence)),
    feedback: typeof data.feedback === 'string' ? data.feedback : '',
  }
}

async function judge(question, studentAnswer, reflect, previous) {
  const endpoint = import.meta.env?.VITE_AI_GRADING_ENDPOINT
  if (!endpoint) return localJudge(question, studentAnswer, reflect)
  return remoteJudge(question, studentAnswer, reflect, previous)
}

/** 简答题满分 = 各得分点分值之和 */
export function fullScoreOf(question) {
  const scores = Array.isArray(question.point_scores) ? question.point_scores : []
  const sum = scores.reduce((total, value) => total + Number(value || 0), 0)
  return sum || 10
}

/**
 * 返回可直接入库的批改结果。
 * reviewed 为 false 只表示这次批改失败，需要老师处理。
 */
export async function gradeShortAnswer(question, studentAnswer) {
  const points = Array.isArray(question.scoring_points) ? question.scoring_points : []
  if (!points.length) {
    return { ai_score: null, final_score: null, ai_feedback: null, point_hits: null, reviewed: false, needs_review: true }
  }
  try {
    const first = await judge(question, studentAnswer, false)
    const chosen = first.confidence >= CONFIDENT ? first : await judge(question, studentAnswer, true, first)
    const pointHits = alignHits(question, chosen.point_hits)
    const finalScore = pointHits.reduce((sum, item) => sum + Number(item.score || 0), 0)
    const feedback = pointHits.some((item) => item.hit)
      ? feedbackFor(pointHits, finalScore, fullScoreOf(question))
      : '未达到得分点要求'
    return {
      ai_score: finalScore,
      final_score: finalScore,
      ai_feedback: feedback,
      point_hits: pointHits,
      reviewed: true,
      needs_review: false,
    }
  } catch {
    return { ai_score: null, final_score: null, ai_feedback: null, point_hits: null, reviewed: false, needs_review: true }
  }
}
