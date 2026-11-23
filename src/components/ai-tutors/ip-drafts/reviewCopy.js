export const DUTY_CARD = [
  {
    role: 'jianwei',
    name: '见微',
    motion: '向内聚焦 / 拆解',
    shape: '闭合同心圆，飞白沿 42° 轴向圆心收，像涟漪还没散开',
    cinnabar: '落在圆心：看这里',
    does: '讲清错因、选项差异、考点或把难句说成人话',
    doesNot: '不靠放大镜、腮红或气球头来认人',
  },
  {
    role: 'zhizhu',
    name: '知著',
    motion: '向外引路 / 追问',
    shape: '开口同心圆，飞白沿同一 42° 轴指向下一处',
    cinnabar: '落在笔锋尽头：想到这里，下一步你来',
    does: '首轮只给一条可执行的线索，留出学生自己推导的空间',
    doesNot: '不捧书、不戴眼镜、不做成会给答案的百科',
  },
]

export const FAMILY_RULES = [
  '共用细墨线：外圈 2.2 @ viewBox 96，与 Logo 1.15 @ 64 同比例（约 2.3%）',
  '共用朱砂规则：见微在圆心，知著在飞白尽头，半径同一量级，只点不铺面',
  '共用母体：同心圆；飞白同轴反向（收入 / 指出）',
  'B 只加五官与低头/侧身姿态，不引入第二套母体；32px 保底轮廓与 A 相同',
  'C 可加圆角方印作徽记容器，圆环母体不变；与现有 SVG 须二选一',
]

export const VERSION_CLAIMS = {
  a: {
    jianwei: '密圈闭合 + 向内飞白，粉色只洗内圈。自证：剪影是实心圆。',
    zhizhu: '疏圈开口 + 向外飞白，蓝色只走笔锋。自证：剪影是开口与指向。',
  },
  b: {
    jianwei: '沿用 A 骨，低头看圆心朱砂（纸色晕开，朱砂不是鼻子）。无嘴、无腮红。',
    zhizhu: '沿用 A 骨，侧身沿飞白看向尽头。无书、无眼镜。32px 去掉五官。',
  },
  c: {
    jianwei: '圆角落在方印里，留白更多，粉只作淡渍。自证：剪影是方印。',
    zhizhu: '方印被右下飞白破边，开口更大。自证：徽记仍能指向「下一步」。',
  },
}

export const ACCEPTANCE = {
  testers: '10 名互不重叠、未参与设计的受测者；每人每项只测一组。',
  timing: '展示 3 秒后立即撤图再作答，禁止边看边答。系统减少动效时改为手动撤图。',
  order: '左右随机并记录位序。同一人测多版时必须换左右。',
  sil32: '32px 纯单色剪影只保留轮廓 + 朱砂点，正确配对 ≥8/10。另交极限墨色稿：朱砂也改用同一墨色，无任何色阶。',
  color96: '96px 彩色正确配对 ≥9/10。',
  family: '三条硬指标：同细墨线比例、同同心圆母体、朱砂同一相对规则（只点不铺面）。',
  anti: '看「跟知著想一想」，若预期「直接给答案」则该版入口未通过。记录误判来自文案还是造型。',
}

export const PEDAGOGY = [
  {
    course: '语文 · 现代汉语',
    type: '单选',
    stem: '下列关于音位的表述，正确的一项是？',
    options: [
      'A. 音位是具体的语音，可以直接听见',
      'B. 音位是从语音中归纳出来的、具有区别意义作用的最小语音单位',
      'C. 音位等于音素，二者没有分别',
      'D. 音位没有辨义作用',
    ],
    mine: 'C',
    answer: 'B',
    explanation:
      '音位是音系学概念，从具体音素中归纳而来，作用是区别意义。音素是语音的最小单位；音位是能区别意义的最小语音单位。',
    jianwei:
      '你选 C，是把「音素」和「音位」叠成了一个词。音素是听得见的最小语音片段；音位是从这些片段里归纳出来、专门用来区别意义的单位。本题考点是「辨义」。A 把音位说成具体语音，D 直接否定辨义，都偏了。',
    zhizhu:
      '先把两层拆开：一层是「耳朵听得见的」，一层是「能把意思区别开的」。你选的 C 把这两层当成同一件事。先问问自己：这道题问的是哪一层？',
  },
  {
    course: '数学 · 等差数列',
    type: '填空',
    stem: '等差数列 {an} 中，a1 = 3，公差 d = 2，则 a10 = ____。',
    options: [],
    mine: '23',
    answer: '21',
    explanation: '等差数列通项 a_n = a1 + (n−1)d。从第 1 项到第 10 项，公差加 9 次。',
    jianwei:
      '你大概用成了 a1 + n·d，所以 3 + 10×2 = 23。通项是 a_n = a1 + (n−1)d：从第 1 项到第 10 项，公差只加了 9 次。代入得 3 + 9×2 = 21。错因是把「项数」当成了「相加次数」。',
    zhizhu:
      '相邻两项的差是多少？从第 1 项走到第 10 项，这个差实际加了几次？先把次数数清楚，再代入，不要先写答案。',
  },
  {
    course: '开放 · 修辞赏析',
    type: '简答',
    stem: '结合上下文，简要说明「见微知著」在文中的作用。',
    options: [],
    mine: '这句话很好，说明作者观察细致。',
    answer: '由学生自行完成，本题无唯一成品',
    explanation: '赏析需落到文本中的「微」与「著」，并说明二者如何衔接。空评不算作答。',
    jianwei:
      '「很好」「细致」还停在评价，没有落到文本。先圈出文中写「微」的那一处具体物象，再标出它通向的「著」（结构、主旨或后文事件）。作用通常落在：以小见大、提示读法、或为后文收束埋伏笔。把这三步写全，就不是空评。',
    zhizhu:
      '先不要写「这句话很好」。请在文中各找一处：写得很小的，和写得很大的。两者中间，作者用了什么笔法把它们接起来？想到哪一步就说到哪一步。',
  },
]

export const REPLACE_SCOPE = [
  { surface: '错题回看入口头像', now: '现有 AiTutorMascot', after: '选定稿 48px 成对', rollback: '恢复组件即可' },
  { surface: '角色切换按钮', now: '现有 28px 头像', after: '选定稿 28–32px', rollback: '恢复组件即可' },
  { surface: '讲解中加载态', now: '文案 + 现有头像', after: '评审二选一：选定稿 / 旧 SVG 作加载', rollback: '保留开关' },
  { surface: '宣传页 / 256px', now: '无独立插画', after: '仅当选定含大尺寸时再接', rollback: '不接则无此资产' },
  { surface: '登录页 Logo', now: 'InkSeal 三件套', after: '不替换', rollback: '—' },
  { surface: '原解析与评分', now: '独立于形象', after: '不改', rollback: '—' },
]

export const C_VS_EXISTING = {
  question: 'C 版与现有 SVG 吉祥物的关系，评审须二选一，不能并存两套极简图标。',
  options: ['替换现有 AiTutorMascot', '保留旧版仅作加载态'],
}

export const REVIEW_ROWS = [
  { id: 'shape', label: '遮名、去色后仍能区分向内 / 向外' },
  { id: 'family', label: '与 Logo 并排看得出同源' },
  { id: 'px32', label: '32px 灰度配对 ≥80%（记录实测人数与结果）' },
  { id: 'px96', label: '96px 彩色配对 ≥90%' },
  { id: 'entry', label: '点击前能说出两个入口分别提供什么帮助' },
  { id: 'anti', label: '反例：无人把知著理解成直接给答案' },
  { id: 'course', label: '语文 / 数学 / 开放题沿用同一轮廓与职责' },
]

export const ROLLBACK = [
  '本轮不替换产品默认头像，关闭评审页不影响现网。',
  '若将来接入：VITE_AI_TUTORS_ENABLED=false 可关闭整个 AI 讲解入口。',
  '形象回滚：恢复 src/components/ai-tutors/AiTutorMascot.jsx。',
  '本轮出稿前回滚：git switch --detach af0b633，或分支 codex/baseline-before-ip-review-20261123。',
  '去掉全部 IP 出稿：分支 codex/baseline-before-ip-drafts-20261123。',
]

export const LEDGER_KEY = 'zhiweizhui-ip-draft-review-ledger'
export const LEDGER_CHOICES = [
  { id: '', label: '待签' },
  { id: 'pass', label: '通过' },
  { id: 'fail', label: '未过' },
]
