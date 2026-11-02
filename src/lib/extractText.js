import JSZip from 'jszip'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

/** 从教师上传的 PDF、Word、PPT 抽出纯文本。扫描图片没有文字层时返回空字符串。 */
export async function extractTextFromFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return extractPdf(file)
  if (ext === 'docx') return extractDocx(file)
  if (ext === 'pptx') return extractPptx(file)
  if (ext === 'ppt' || ext === 'doc') {
    throw new Error('旧版 Word、PPT 无法自动识别，请另存为新版格式后再上传')
  }
  throw new Error('该格式暂不能自动识别题目')
}

async function extractPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocument({ data }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let line = ''
    let lastY = null
    const lines = []
    for (const item of content.items) {
      if (!item.str) continue
      const y = item.transform?.[5]
      if (lastY != null && Math.abs(y - lastY) > 2) {
        lines.push(line)
        line = item.str
      } else {
        line += item.str
      }
      lastY = y
    }
    if (line) lines.push(line)
    pages.push(lines.join('\n'))
  }
  return pages.join('\n')
}

async function extractDocx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('这份 Word 里没有可读取的正文')
  return xmlToLines(xml, 'w:p')
}

async function extractPptx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNo(a) - slideNo(b))
  const pages = []
  for (const name of names) {
    const xml = await zip.file(name).async('string')
    pages.push(xmlToLines(xml, 'a:p'))
  }
  return pages.join('\n')
}

function slideNo(name) {
  return Number(name.match(/slide(\d+)/)?.[1] ?? 0)
}

function xmlToLines(xml, paragraphTag) {
  const paras = xml.split(new RegExp(`</${paragraphTag}>`))
  return paras
    .map((para) =>
      [...para.matchAll(/<[^:>]*:t[^>]*>([^<]*)<\/[^:>]*:t>/g)]
        .map((m) => decodeXml(m[1]))
        .join(''),
    )
    .filter(Boolean)
    .join('\n')
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}
