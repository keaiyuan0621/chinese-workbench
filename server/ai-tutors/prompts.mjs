export const ROLES = {
  jianwei: {
    id: 'jianwei',
    name: '见微',
    duty: '讲清这道题的细节、选项差异和易漏之处',
  },
  zhizhu: {
    id: 'zhizhu',
    name: '知著',
    duty: '一步一步引导学生思考，首轮不直接倾倒答案',
  },
}

const SHARED = [
  '你是「知微追」现代汉语研习工作台的讲解助手。',
  '面向大学生讲解黄伯荣、廖序东《现代汉语》相关题目。',
  '用简体中文，语气亲切克制，像一位认真的学伴。',
  '不要使用 Markdown 标题，不要输出 HTML 或代码块。',
  '不要索要、提及或使用学生姓名、学号或其他身份信息。',
  '题目、学生作答和原解析会随请求传入。原解析已经展示给学生，不要假装那是你写的。',
  '不要编造题干里没有的材料。拿不准时如实说明。',
].join('')

export function isKnownRole(role) {
  return role === 'jianwei' || role === 'zhizhu'
}

export function systemPrompt(role) {
  if (role === 'jianwei') {
    return [
      SHARED,
      '你的角色是「见微」。',
      '职责是把细节讲清楚：题干关键处、选项差异、学生作答卡在哪、原解析为什么这样说。',
      '可以点明正确思路和答案要点，但必须讲「为什么」，不要只复述原解析。',
      '分段宜短，便于阅读。',
    ].join('')
  }
  return [
    SHARED,
    '你的角色是「知著」。',
    '职责是一步一步引导学生思考，帮助学生看见规律。',
    '首轮（还没有学生追问时）不要直接给出完整标准答案，也不要把解析一次性倾倒出来。',
    '先提出一个关键问题或一个观察角度，再给一小步提示。等学生追问后再加深。',
    '只有学生明确要求公布答案时，才完整说明。',
  ].join('')
}

function clip(value, max) {
  return String(value ?? '').trim().slice(0, max)
}

export function formatQuestionContext({
  type,
  stem,
  options,
  studentAnswer,
  originalExplanation,
  referenceAnswer,
}) {
  const lines = [
    `题型：${clip(type, 40) || '未知'}`,
    `题干：${clip(stem, 4000)}`,
  ]
  const optionText = clip(options, 2000)
  if (optionText) lines.push(`选项：\n${optionText}`)
  lines.push(`学生作答：${clip(studentAnswer, 2000) || '未作答'}`)
  lines.push(`原解析：${clip(originalExplanation, 4000) || '本题暂无解析'}`)
  const answerText = clip(referenceAnswer, 2000)
  if (answerText) lines.push(`参考答案：${answerText}`)
  return lines.join('\n')
}

export function buildMessages({ role, payload }) {
  const history = Array.isArray(payload.history) ? payload.history : []
  const firstRound = history.length === 0 && !String(payload.message ?? '').trim()
  const context = formatQuestionContext(payload)
  let kickoff = `请根据下面的题目讲解。\n\n${context}`
  if (role === 'zhizhu' && firstRound) {
    kickoff += '\n\n这是首轮。请只给一步引导，不要直接给出完整答案。'
  } else if (role === 'jianwei' && firstRound) {
    kickoff += '\n\n请讲解这道题的关键细节。'
  }

  const messages = [
    { role: 'system', content: systemPrompt(role) },
    { role: 'user', content: kickoff },
  ]

  for (const turn of history) {
    const turnRole = turn?.role === 'assistant' ? 'assistant' : 'user'
    const content = clip(turn?.content, 2000)
    if (content) messages.push({ role: turnRole, content })
  }

  const followUp = clip(payload.message, 1000)
  if (followUp) messages.push({ role: 'user', content: followUp })
  return messages
}
