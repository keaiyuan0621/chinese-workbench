/** 黄伯荣、廖序东《现代汉语》单句句型。句型看结构，不看语气。 */

export const LEAVES = [
  {
    id: 'np',
    group: 'pred',
    name: '名词谓语句',
    brief: '谓语由名词性词语充当。',
    examples: ['今天星期一。', '这位老师绍兴人。'],
  },
  {
    id: 'vp',
    group: 'pred',
    name: '动词谓语句',
    brief: '谓语由动词性词语充当。',
    examples: ['我们研究语言。', '花开了。'],
  },
  {
    id: 'ap',
    group: 'pred',
    name: '形容词谓语句',
    brief: '谓语由形容词性词语充当。',
    examples: ['天空晴朗。', '他的手冰凉。'],
  },
  {
    id: 'sp',
    group: 'pred',
    name: '主谓谓语句',
    brief: '谓语本身是一个主谓短语。',
    examples: ['他身体健康。', '这件事我知道。'],
  },
  {
    id: 'vnp',
    group: 'non',
    name: '动词性非主谓句',
    brief: '由动词性词语单独成句，没有主语。',
    examples: ['下雨了。', '禁止吸烟。'],
  },
  {
    id: 'anp',
    group: 'non',
    name: '形容词性非主谓句',
    brief: '由形容词性词语单独成句，没有主语。',
    examples: ['好极了！', '多么安静！'],
  },
  {
    id: 'nnp',
    group: 'non',
    name: '名词性非主谓句',
    brief: '由名词性词语单独成句，没有主语。',
    examples: ['好大的雪！', '一九四九年春天。'],
  },
  {
    id: 'intj',
    group: 'non',
    name: '叹词句',
    brief: '由叹词单独成句。',
    examples: ['喂！', '啊！'],
  },
]

export const LEAF_MAP = Object.fromEntries(LEAVES.map((leaf) => [leaf.id, leaf]))

export const GROUPS = {
  pred: { id: 'pred', name: '主谓句', brief: '由主语和谓语两部分构成。' },
  non: { id: 'non', name: '非主谓句', brief: '分不出主语和谓语，由词或短语单独成句。' },
}

export const QUESTIONS = [
  { id: 'q1', leaf: 'np', text: '今天星期一。', why: '“今天”是主语，“星期一”是名词性谓语。' },
  { id: 'q2', leaf: 'np', text: '这位老师绍兴人。', why: '“这位老师”是主语，“绍兴人”是名词性谓语。' },
  { id: 'q3', leaf: 'np', text: '他二十岁。', why: '“二十岁”是数量短语，名词性词语作谓语。' },
  { id: 'q4', leaf: 'vp', text: '我们研究语言。', why: '“研究语言”是动词性谓语。' },
  { id: 'q5', leaf: 'vp', text: '花开了。', why: '“花”是主语，“开了”是动词性谓语。' },
  { id: 'q6', leaf: 'vp', text: '小王昨天完成了作业。', why: '“完成了作业”是动词性谓语，“昨天”是状语。' },
  { id: 'q7', leaf: 'vp', text: '学生们打扫干净了教室。', why: '谓语中心是动词“打扫”。' },
  { id: 'q8', leaf: 'ap', text: '天空晴朗。', why: '“天空”是主语，“晴朗”是形容词性谓语。' },
  { id: 'q9', leaf: 'ap', text: '他的手冰凉。', why: '“冰凉”是形容词性谓语。' },
  { id: 'q10', leaf: 'ap', text: '教室里干干净净。', why: '“教室里”是处所主语，“干干净净”是形容词性谓语。' },
  { id: 'q11', leaf: 'sp', text: '他身体健康。', why: '全句主语是“他”，谓语“身体健康”本身又是主谓短语。' },
  { id: 'q12', leaf: 'sp', text: '这件事我知道。', why: '谓语“我知道”是主谓短语。' },
  { id: 'q13', leaf: 'sp', text: '同学们情绪很高。', why: '谓语“情绪很高”是主谓短语。' },
  { id: 'q14', leaf: 'vnp', text: '下雨了。', why: '只有动词性词语，分不出主语。' },
  { id: 'q15', leaf: 'vnp', text: '禁止吸烟。', why: '动词性短语单独成句，没有主语。' },
  { id: 'q16', leaf: 'vnp', text: '随手关门。', why: '祈使语气不改变句型，结构上仍是动词性非主谓句。' },
  { id: 'q17', leaf: 'anp', text: '好极了！', why: '形容词性词语单独成句。感叹号表示语气，不是句型。' },
  { id: 'q18', leaf: 'anp', text: '多么安静！', why: '没有主语，由形容词性短语成句。' },
  { id: 'q19', leaf: 'anp', text: '好香啊！', why: '“好香”是形容词性词语，句末“啊”是语气。' },
  { id: 'q20', leaf: 'nnp', text: '好大的雪！', why: '名词性短语单独成句，没有主语。' },
  { id: 'q21', leaf: 'nnp', text: '一九四九年春天。', why: '名词性词语单独成句，用来说明时间。' },
  { id: 'q22', leaf: 'nnp', text: '飞机！', why: '一个名词单独成句。' },
  { id: 'q23', leaf: 'intj', text: '喂！', why: '叹词单独成句，用来呼喊。' },
  { id: 'q24', leaf: 'intj', text: '啊！', why: '叹词单独成句，表示感叹。' },
  { id: 'q25', leaf: 'intj', text: '嗯。', why: '叹词单独成句，表示应答。' },
]

export const LEVELS = [
  {
    id: 1,
    title: '辨主干',
    play: '二选一',
    blurb: '先判断：这句分不分得出主语和谓语。',
    pass: 5,
    count: 6,
  },
  {
    id: 2,
    title: '主谓四型',
    play: '四选一',
    blurb: '已经是主谓句。再看谓语是名词、动词、形容词，还是主谓短语。',
    pass: 5,
    count: 6,
  },
  {
    id: 3,
    title: '点树归位',
    play: '点知识树',
    blurb: '句子出现后，直接点到知识树上的那一片叶子。',
    pass: 5,
    count: 6,
  },
  {
    id: 4,
    title: '连珠闯关',
    play: '连对挑战',
    blurb: '八种句型混在一起。连续答对 6 题过关，答错连击清零。',
    streak: 6,
    count: 12,
  },
]

export function shuffle(list) {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function deckFor(levelId) {
  const level = LEVELS.find((item) => item.id === levelId)
  let pool = QUESTIONS
  if (levelId === 2) pool = QUESTIONS.filter((item) => LEAF_MAP[item.leaf].group === 'pred')
  return shuffle(pool).slice(0, level.count)
}

export function answerOf(question, levelId) {
  if (levelId === 1) return LEAF_MAP[question.leaf].group
  return question.leaf
}
