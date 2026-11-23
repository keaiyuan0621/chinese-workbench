/** 三版共用的品牌语法。评审通过前只用于出稿，不替换产品头像。 */

export const IP_INK = '#2C2C2C'
export const IP_CINNABAR = '#B54434'
export const IP_PAPER = '#F8F4EC'
export const IP_PEACH = ['#FFF1F5', '#F4D0D7', '#E9A2BB']
export const IP_MOUNTAIN = ['#EFF9FF', '#B2CDD7', '#7CA8C8']

/** 飞白轴：与 Logo 右下飞白同向。见微沿此轴收入，知著沿此轴指出。 */
export const IP_AXIS_DEG = 42
export const IP_VIEWBOX = 96

/** 细墨线：约 1.5px @ 24px（viewBox 96）。三版同一粗细，才能横比。 */
export const IP_STROKE_OUTER = 6
export const IP_STROKE_INNER = 3.2
export const IP_STROKE_FLY = 2.6
export const IP_CINNABAR_R = 3.6

export const IP_VERSIONS = [
  {
    id: 'a',
    name: 'A｜水墨极简',
    focus: '小尺寸品牌辨识：闭合收束 vs 开口引路',
  },
  {
    id: 'b',
    name: 'B｜轻拟人',
    focus: '在 A 的轮廓上加五官；常驻头像不含书本、眼镜、放大镜',
  },
  {
    id: 'c',
    name: 'C｜印章徽记',
    focus: '跨课程入口标识；需与现有 SVG 吉祥物二选一',
  },
]

export const IP_ROLES = {
  jianwei: {
    id: 'jianwei',
    name: '见微',
    motion: '向内聚焦 / 拆解',
    entry: '让见微拆开讲',
    duty: '讲清错因、考点和难句，不另起一套角色',
  },
  zhizhu: {
    id: 'zhizhu',
    name: '知著',
    motion: '向外引路 / 追问',
    entry: '跟知著想一想',
    duty: '只给下一步可执行的线索，不直接给答案',
  },
}
