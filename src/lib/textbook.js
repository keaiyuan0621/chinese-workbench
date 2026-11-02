/**
 * 黄伯荣、廖序东《现代汉语》增订七版（上册语音、文字、词汇；下册语法、修辞）
 * 一级仍用课程要求的五章：语音、汉字、词汇、语法、修辞。
 * 「汉字」对应教材第二章「文字」。
 * 识别出的题目只能挂到这里的节次，不能自造知识点。
 */
export const TEXTBOOK = {
  title: '现代汉语',
  edition: '增订七版',
  authors: '黄伯荣、廖序东',
  volumes: '上下册',
}

export const TEXTBOOK_LABEL = `${TEXTBOOK.authors}《${TEXTBOOK.title}》${TEXTBOOK.edition}`

/** @type {{ chapter: string, volume: string, bookChapter: string, nodes: { name: string, sort: number, keywords: string[] }[] }[]} */
export const TEXTBOOK_CHAPTERS = [
  {
    chapter: '语音',
    volume: '上册',
    bookChapter: '第一章 语音',
    nodes: [
      { name: '语音概说', sort: 1, keywords: ['音素', '音位学', '元音', '辅音', '语音四要素', '国际音标', '发音部位', '发音方法'] },
      { name: '声母', sort: 2, keywords: ['声母', '零声母', '送气', '不送气', '塞音', '塞擦音', '擦音', '鼻音', '边音', '舌尖前', '舌尖后', '舌面音', 'zh', 'ch', 'sh', 'zcs', '平翘舌'] },
      { name: '韵母', sort: 3, keywords: ['韵母', '单韵母', '复韵母', '鼻韵母', '韵头', '韵腹', '韵尾', '四呼', '开口呼', '齐齿呼', '合口呼', '撮口呼'] },
      { name: '声调', sort: 4, keywords: ['声调', '调值', '调类', '阴平', '阳平', '上声', '去声', '调号', '五度标记'] },
      { name: '音节', sort: 5, keywords: ['音节', '声韵配合', '拼音', '隔音符号', 'y w', '省写'] },
      { name: '音变', sort: 6, keywords: ['音变', '变调', '轻声', '儿化', '啊的音变', '语气词啊', '上声连读', '一不变调'] },
      { name: '音位', sort: 7, keywords: ['音位', '音位变体', '对立', '互补', '归纳音位'] },
      { name: '朗读和语调', sort: 8, keywords: ['朗读', '语调', '重音', '停连', '句调', '升降调'] },
      { name: '语音规范化', sort: 9, keywords: ['语音规范', '异读词', '普通话水平', '正音', '拼音正词法', '儿化规范'] },
    ],
  },
  {
    chapter: '汉字',
    volume: '上册',
    bookChapter: '第二章 文字',
    nodes: [
      { name: '汉字概说', sort: 1, keywords: ['汉字性质', '表意文字', '语素文字', '汉字特点', '汉字起源'] },
      { name: '汉字的形体', sort: 2, keywords: ['甲骨文', '金文', '篆书', '隶书', '楷书', '草书', '行书', '字体演变', '隶变'] },
      { name: '汉字的结构', sort: 3, keywords: ['笔画', '笔顺', '偏旁', '部首', '独体', '合体', '六书', '象形', '指事', '会意', '形声', '转注', '假借', '间架', '结构类型'] },
      { name: '汉字的整理和标准化', sort: 4, keywords: ['简化字', '异体字', '印刷通用汉字', '整理汉字', '标准化', '定量', '定形', '定音', '定序'] },
      { name: '使用规范汉字', sort: 5, keywords: ['规范汉字', '错别字', '形近字', '不规范字', '繁体字', '异形词'] },
    ],
  },
  {
    chapter: '词汇',
    volume: '上册',
    bookChapter: '第三章 词汇',
    nodes: [
      { name: '词汇和词的结构', sort: 1, keywords: ['语素', '词根', '词缀', '单纯词', '合成词', '复合词', '重叠式', '附加式', '联绵', '偏正', '联合', '动宾', '主谓', '补充', '构词'] },
      { name: '词义的性质和构成', sort: 2, keywords: ['词义', '本义', '引申义', '比喻义', '理性义', '色彩义', '概念义', '语体色彩', '感情色彩'] },
      { name: '义素分析', sort: 3, keywords: ['义素', '义项', '语义特征'] },
      { name: '语义场', sort: 4, keywords: ['语义场', '同义词', '反义词', '上下位', '类义词'] },
      { name: '语境与词义', sort: 5, keywords: ['语境', '言语义', '词义变化', '歧义'] },
      { name: '词汇的构成', sort: 6, keywords: ['基本词汇', '一般词汇', '古语词', '方言词', '外来词', '行业语', '隐语'] },
      { name: '熟语', sort: 7, keywords: ['熟语', '成语', '惯用语', '歇后语', '谚语'] },
      { name: '词汇的发展变化和词汇的规范', sort: 8, keywords: ['新词', '旧词', '词汇规范', '异形词规范', '词的规范'] },
    ],
  },
  {
    chapter: '语法',
    volume: '下册',
    bookChapter: '第四章 语法',
    nodes: [
      { name: '语法概说', sort: 1, keywords: ['语法', '语法单位', '组合', '聚合', '层级性'] },
      { name: '词类', sort: 2, keywords: ['词类', '实词', '虚词', '名词', '动词', '形容词', '区别词', '数词', '量词', '副词', '代词', '介词', '连词', '助词', '语气词', '叹词', '拟声词', '兼类'] },
      { name: '短语', sort: 3, keywords: ['短语', '词组', '偏正短语', '动宾短语', '主谓短语', '中补短语', '联合短语', '同位短语', '连谓短语', '兼语短语'] },
      { name: '句法成分', sort: 4, keywords: ['主语', '谓语', '宾语', '定语', '状语', '补语', '中心语', '独立语', '句法成分'] },
      { name: '句法分析', sort: 5, keywords: ['层次分析', '直接成分', '二分', '句法分析', '语病', '成分残缺', '搭配不当'] },
      { name: '句类', sort: 6, keywords: ['句类', '陈述句', '疑问句', '祈使句', '感叹句', '是非问', '特指问', '选择问', '正反问'] },
      { name: '句型', sort: 7, keywords: ['句型', '主谓句', '非主谓句', '把字句', '被字句', '连谓句', '兼语句', '存现句', '双宾句'] },
      { name: '复句', sort: 8, keywords: ['复句', '分句', '关联词', '并列', '递进', '选择', '转折', '因果', '假设', '条件', '多重复句'] },
      { name: '标点符号', sort: 9, keywords: ['标点', '逗号', '句号', '顿号', '分号', '冒号', '引号', '破折号', '省略号', '书名号'] },
    ],
  },
  {
    chapter: '修辞',
    volume: '下册',
    bookChapter: '第五章 修辞',
    nodes: [
      { name: '修辞概说', sort: 1, keywords: ['修辞', '修辞原则', '语境与修辞'] },
      { name: '词语的锤炼', sort: 2, keywords: ['词语锤炼', '炼字', '词语选用', '同义选用'] },
      { name: '句式的选择', sort: 3, keywords: ['句式', '长句', '短句', '整句', '散句', '主动句', '被动句', '肯定句', '否定句', '口语句式', '书面语句式'] },
      { name: '辞格', sort: 4, keywords: ['辞格', '比喻', '比拟', '借代', '夸张', '对偶', '排比', '双关', '反语', '设问', '反问', '反复', '对比', '顶真', '回环', '拈连', '仿词', '婉曲', '层递', '映衬'] },
      { name: '辞格的综合运用', sort: 5, keywords: ['辞格综合', '兼用', '连用', '套用'] },
      { name: '语体', sort: 6, keywords: ['语体', '公文语体', '科技语体', '政论语体', '文艺语体', '口头语体'] },
    ],
  },
]

const NODE_INDEX = TEXTBOOK_CHAPTERS.flatMap((ch) =>
  ch.nodes.map((node) => ({ ...node, chapter: ch.chapter, volume: ch.volume, bookChapter: ch.bookChapter })),
)

export function listTextbookNodes() {
  return NODE_INDEX
}

/** 在教材节次里找最匹配的一项。没有把握时返回 null，不另造名称。 */
export function matchTextbookNode(text) {
  const raw = String(text ?? '')
  if (!raw.trim()) return null
  let best = null
  let bestScore = 0
  for (const node of NODE_INDEX) {
    let score = 0
    for (const word of node.keywords) {
      if (!word) continue
      if (raw.includes(word)) score += word.length >= 2 ? word.length : 1
    }
    if (raw.includes(node.name)) score += node.name.length + 2
    if (score > bestScore) {
      bestScore = score
      best = node
    }
  }
  if (!best || bestScore < 2) return null
  return { ...best, score: bestScore }
}
