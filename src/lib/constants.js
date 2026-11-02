/**
 * 领域常量：全局唯一来源，前后端命名保持一致。
 */

/** 一级章节，顺序固定，不可打乱 */
export const CHAPTERS = ['语音', '汉字', '词汇', '语法', '修辞']

/** 题型（与 questions.type 字段取值一致） */
export const QUESTION_TYPES = ['单选', '多选', '判断', '填空', '简答', 'match', 'correction']

/** 页面上显示的题型名称。match、correction 在库里用英文，界面用中文。 */
export const QUESTION_TYPE_LABEL = {
  单选: '单选',
  多选: '多选',
  判断: '判断',
  填空: '填空',
  简答: '简答',
  match: '连线',
  correction: '病句修改',
}

/**
 * 难度（与 questions.difficulty 字段取值一致）
 * 判定依据是“材料复杂度”，不是知识点数量：
 *  low  —— 材料典型、简短，常用例（短语 / 常用字 / 识别常见辞格）
 *  mid  —— 材料变长或变复杂，有易错点，需套规则（短句 / 易错字 / 分析语境效果）
 *  high —— 长句、特殊字、例外情况、多层分析（长句成分 / 凹凸九笔顺 / 语段辞格套用）
 */
export const DIFFICULTIES = [
  { value: 'low', label: '低' },
  { value: 'mid', label: '中' },
  { value: 'high', label: '高' },
]

export const DIFFICULTY_LABEL = Object.fromEntries(
  DIFFICULTIES.map((d) => [d.value, d.label]),
)

/** 课程资料分类（与 course_materials.category 字段取值一致） */
export const MATERIAL_CATEGORIES = ['核心必看', '拓展阅读', '参考教材']

/** 快捷练习模板 */
export const QUICK_TEMPLATES = [
  {
    id: 'quick10',
    label: '10题快速练',
    count: 10,
    ratio: null, // 不限难度比例
  },
  {
    id: 'quiz20',
    label: '20题小测（低中高 5:3:2）',
    count: 20,
    ratio: { low: 5, mid: 3, high: 2 },
  },
]

/** 简答题 AI 评分与满分差距超过该比例时，推入教师复核队列 */
export const AI_REVIEW_THRESHOLD = 0.3

/** 学生用学号登录，前端拼成虚拟邮箱交给 Supabase Auth */
export const VIRTUAL_EMAIL_DOMAIN = 'chinese.local'

export function toVirtualEmail(studentNo) {
  return `${String(studentNo).trim().toLowerCase()}@${VIRTUAL_EMAIL_DOMAIN}`
}

/** 学生端各章节配色（马卡龙） */
export const CHAPTER_THEME = {
  语音: {
    emoji: '🔊',
    card: 'bg-coral-50 ring-coral-100',
    title: 'text-coral-600',
    chip: 'bg-white text-coral-600 ring-coral-100 hover:bg-coral-100',
    dot: 'bg-coral-400',
  },
  汉字: {
    emoji: '✍️',
    card: 'bg-cream-50 ring-cream-300',
    title: 'text-cream-800',
    chip: 'bg-white text-cream-800 ring-cream-300 hover:bg-cream-100',
    dot: 'bg-cream-500',
  },
  词汇: {
    emoji: '📚',
    card: 'bg-mint-50 ring-mint-100',
    title: 'text-mint-600',
    chip: 'bg-white text-mint-600 ring-mint-100 hover:bg-mint-100',
    dot: 'bg-mint-400',
  },
  语法: {
    emoji: '🧩',
    card: 'bg-lavender-50 ring-lavender-100',
    title: 'text-lavender-600',
    chip: 'bg-white text-lavender-600 ring-lavender-100 hover:bg-lavender-100',
    dot: 'bg-lavender-400',
  },
  修辞: {
    emoji: '🎨',
    card: 'bg-sky-50 ring-sky-100',
    title: 'text-sky-600',
    chip: 'bg-white text-sky-600 ring-sky-100 hover:bg-sky-100',
    dot: 'bg-sky-400',
  },
}
