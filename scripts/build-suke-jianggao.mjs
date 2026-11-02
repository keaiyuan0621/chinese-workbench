import fs from "node:fs"
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  TextRun,
} from "docx"
import { lectures } from "./suke-lectures.mjs"
import { extras } from "./suke-extras.mjs"

const song = { ascii: "Times New Roman", hAnsi: "Times New Roman", eastAsia: "宋体" }
const hei = { ascii: "Arial", hAnsi: "Arial", eastAsia: "黑体" }
const kai = { ascii: "KaiTi", hAnsi: "KaiTi", eastAsia: "楷体" }

const ink = "1A1A1A"
const brown = "6B542C"
const mute = "6E675C"

function run(text, opts = {}) {
  return new TextRun({
    text,
    font: opts.font || song,
    size: opts.size || 32,
    bold: !!opts.bold,
    color: opts.color || ink,
    italics: !!opts.italics,
  })
}

function para(children, opts = {}) {
  return new Paragraph({
    spacing: opts.spacing,
    alignment: opts.alignment,
    border: opts.border,
    shading: opts.shading,
    pageBreakBefore: opts.pageBreakBefore,
    keepNext: opts.keepNext,
    children,
  })
}

function spokenChars(blocks) {
  return blocks.reduce((n, b) => n + b.say.replace(/\s/g, "").length, 0)
}

function pauseSeconds(blocks) {
  return blocks.reduce((n, b) => n + b.pause, 0)
}

function estimateSeconds(blocks) {
  return spokenChars(blocks) / 140 * 60 + pauseSeconds(blocks)
}

function clock(seconds) {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}分${String(s).padStart(2, "0")}秒`
}

function prepare(list) {
  return list.map((lec, index) => {
    const extra = extras[lec.name]
    if (!extra) throw new Error(`缺少停留段：${lec.name}`)
    const blocks = lec.blocks.slice()
    blocks.splice(blocks.length - 1, 0, extra)
    return { ...lec, index: index + 1, blocks }
  })
}

const prepared = prepare(lectures)

for (const lec of prepared) {
  const sec = estimateSeconds(lec.blocks)
  const flag = sec < 300 || sec > 390 ? "  ← 超出" : ""
  console.log(
    `${String(lec.index).padStart(2, "0")} ${lec.name}  ${spokenChars(lec.blocks)}字  停${pauseSeconds(lec.blocks)}秒  ${clock(sec)}${flag}`,
  )
}

function h1(text, pageBreakBefore = false) {
  return para([run(text, { font: hei, size: 44, bold: true })], {
    pageBreakBefore,
    spacing: { before: 0, after: 160, line: 360, lineRule: "auto" },
    keepNext: true,
  })
}

function body(text, opts = {}) {
  return para([run(text, { size: opts.size || 28, color: opts.color || ink, font: opts.font || song })], {
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80, line: 360, lineRule: "auto" },
  })
}

function action(text) {
  return para(
    [
      run("你要做  ", { font: hei, size: 21, bold: true, color: brown }),
      run(text, { font: kai, size: 21, color: "3D3426" }),
    ],
    {
      shading: { type: ShadingType.CLEAR, fill: "F7F1E4" },
      border: {
        left: { style: BorderStyle.SINGLE, size: 16, color: "8C6A3D", space: 8 },
      },
      spacing: { before: 220, after: 60, line: 300, lineRule: "auto" },
    },
  )
}

function spoken(text) {
  return para([run(text, { font: song, size: 32, color: ink })], {
    spacing: { before: 60, after: 160, line: 400, lineRule: "auto" },
  })
}

function noteBox(lines) {
  return lines.map((line, i) =>
    para([run(line, { font: kai, size: 21, color: mute })], {
      shading: { type: ShadingType.CLEAR, fill: "F4F1EB" },
      spacing: { before: i === 0 ? 160 : 0, after: i === lines.length - 1 ? 160 : 40, line: 300, lineRule: "auto" },
    }),
  )
}

const children = []

children.push(
  para([run("《现代汉语》", { font: hei, size: 72, bold: true, color: ink })], {
    alignment: AlignmentType.CENTER,
    spacing: { before: 1600, after: 0 },
  }),
  para([run("课程速课讲稿", { font: hei, size: 56, bold: true })], {
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 360 },
  }),
  para([run("学习通录制用  ·  全部二级知识点", { font: kai, size: 28, color: brown })], {
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  }),
  para([run("黄伯荣、廖序东《现代汉语》增订七版", { font: song, size: 24, color: mute })], {
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
  }),
  para([run(`共 ${prepared.length} 讲    每讲约 5–6 分钟    语速要慢`, { font: song, size: 24, color: mute })], {
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
  }),
  para([run("浅色框里的字不要念。框下面的大字，才是讲稿。", { font: kai, size: 24, color: brown })], {
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 80 },
  }),
)

children.push(h1("怎么用这份讲稿", true))
const guide = [
  "这三十七讲，对应这门课全部二级知识点。顺序是语音、汉字、词汇、语法、修辞。一讲单独成片。学习通标题可以用「现代汉语速课｜章名｜知识点名」，每一讲下面都写好了。",
  "每一讲按五到六分钟设计，语速要慢。口播故意不写满。浅色框是你要做的事：出字、停顿、读例、比划。这些字不要念出来。停顿做足，这一讲才是五到六分钟。如果把框跳过去连着念，会又短又赶，也不像上课。",
  "框下面的大字才照着念。句子写得短，是为了换气。不要自行再加很多例子或定义。加了就会超过六分钟，核心也会被冲淡。",
  "没有课件时，把框里要点出的字写在纸上，举到镜头前，停够再讲。提示里的「停两秒」「停三秒」，就真的停。",
  "分钟数是这样估的：口播按比较慢的讲课速度，大约每分钟一百四十字，再加上框里的停顿。你照着做，整讲会落在五到六分钟附近。不到五分钟，是停顿被吃掉了。超过六分半，是加了讲稿以外的话。",
  "每讲开头就是「这一讲只讲……」。不必先说「同学们好，上一讲我们讲了……」。学生可能单独点开一讲。",
  "内容依据黄伯荣、廖序东《现代汉语》增订七版，只取核心，不代替课本，也不把三级知识点再展开成细讲。",
]
for (const line of guide) children.push(body(line, { size: 28, before: 120, after: 120 }))

children.push(h1("目录", true))
let lastChapter = ""
prepared.forEach((lec) => {
  if (lec.chapter !== lastChapter) {
    lastChapter = lec.chapter
    const n = prepared.filter((x) => x.chapter === lec.chapter).length
    children.push(
      para([run(`${lec.chapter}  ·  ${n} 讲`, { font: hei, size: 28, bold: true, color: brown })], {
        spacing: { before: 240, after: 80 },
      }),
    )
  }
  const no = String(lec.index).padStart(2, "0")
  children.push(
    para(
      [
        run(`第${no}讲   ${lec.name}`, { font: song, size: 24 }),
        run("      ", { size: 24 }),
        run(`现代汉语速课｜${lec.chapter}｜${lec.name}`, { font: kai, size: 21, color: mute }),
      ],
      { spacing: { before: 40, after: 40, line: 320, lineRule: "auto" } },
    ),
  )
})

prepared.forEach((lec) => {
  const no = String(lec.index).padStart(2, "0")
  const chars = spokenChars(lec.blocks)
  const pause = pauseSeconds(lec.blocks)
  const seconds = estimateSeconds(lec.blocks)
  children.push(
    para([run(`第 ${no} 讲`, { font: kai, size: 22, color: brown })], {
      pageBreakBefore: true,
      spacing: { before: 0, after: 40 },
      keepNext: true,
    }),
    para([run(`${lec.chapter}  ·  ${lec.name}`, { font: hei, size: 40, bold: true })], {
      spacing: { before: 0, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "C9B08A", space: 6 } },
      keepNext: true,
    }),
    para(
      [run(`学习通标题：现代汉语速课｜${lec.chapter}｜${lec.name}`, { font: song, size: 21, color: mute })],
      { spacing: { before: 120, after: 80 }, keepNext: true },
    ),
  )
  children.push(
    ...noteBox([
      "录之前看一眼，这段不要念。",
      ...lec.remember.map((item, i) => `${i + 1}. ${item}`),
      `不要展开：${lec.skip}`,
      `口播约 ${chars} 字，停顿约 ${pause} 秒。按每分钟 140 字估算，整讲约 ${clock(seconds)}。`,
    ]),
  )
  for (const block of lec.blocks) {
    children.push(action(block.do))
    children.push(spoken(block.say))
  }
})

children.push(h1("录制清单", true))
children.push(body("录完一讲，在前面打勾。标题直接复制到学习通。", { size: 24, color: mute }))
prepared.forEach((lec) => {
  const no = String(lec.index).padStart(2, "0")
  children.push(
    para(
      [
        run(`□  第${no}讲  ${lec.chapter} · ${lec.name}`, { font: song, size: 24 }),
      ],
      { spacing: { before: 80, after: 0 } },
    ),
    para(
      [run(`建议标题：现代汉语速课｜${lec.chapter}｜${lec.name}`, { font: kai, size: 20, color: mute })],
      { spacing: { before: 0, after: 40 } },
    ),
  )
})

const doc = new Document({
  title: "《现代汉语》课程速课讲稿",
  description: "学习通速课录制用，覆盖现代汉语课程全部二级知识点",
  styles: {
    default: {
      document: {
        run: { font: song, size: 24 },
        paragraph: { spacing: { line: 360, lineRule: "auto" } },
      },
    },
  },
  sections: [
    {
      properties: {
        titlePage: true,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1000, right: 1080, bottom: 900, left: 1080 },
        },
      },
      headers: {
        first: new Header({ children: [new Paragraph("")] }),
        default: new Header({
          children: [
            para(
              [
                run("《现代汉语》课程速课讲稿", { font: kai, size: 18, color: brown }),
                run("     ", { size: 18 }),
                run("黄伯荣、廖序东《现代汉语》增订七版", { font: song, size: 18, color: mute }),
              ],
              {
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C9B08A", space: 4 } },
                spacing: { after: 80 },
              },
            ),
          ],
        }),
      },
      footers: {
        first: new Footer({ children: [new Paragraph("")] }),
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80 },
              children: [
                run("浅色框不要念  ·  第 ", { font: kai, size: 16, color: mute }),
                new TextRun({ children: [PageNumber.CURRENT], font: song, size: 16, color: mute }),
                run(" 页", { font: kai, size: 16, color: mute }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
})

const outProject = "C:\\Users\\ytt\\Desktop\\chinese-workbench\\《现代汉语》课程速课讲稿.docx"
const outDesktop = "C:\\Users\\ytt\\Desktop\\《现代汉语》课程速课讲稿.docx"
const buf = await Packer.toBuffer(doc)
fs.writeFileSync(outProject, buf)
fs.writeFileSync(outDesktop, buf)
console.log("wrote", outProject)
console.log("wrote", outDesktop)
