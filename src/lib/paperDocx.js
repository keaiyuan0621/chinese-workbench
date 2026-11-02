import JSZip from 'jszip'
import { QUESTION_TYPE_LABEL } from './constants.js'
import { formatAnswer, matchColumns } from './practice.js'
import { downloadBlob } from './tableExport.js'

const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function run(text, { size = 21, bold = false, color = '' } = {}) {
  const colorXml = color ? `<w:color w:val="${color}"/>` : ''
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${bold ? '<w:b/>' : ''}${colorXml}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`
}

function paragraph(text, opts = {}) {
  const align = opts.align ? `<w:jc w:val="${opts.align}"/>` : ''
  const lines = String(text ?? '').split('\n')
  return lines
    .map(
      (line, index) =>
        `<w:p><w:pPr>${align}<w:spacing w:before="${index === 0 ? opts.before ?? 0 : 0}" w:after="${opts.after ?? 60}"/></w:pPr>${run(line || ' ', opts)}</w:p>`,
    )
    .join('')
}

function groupQuestions(paper) {
  const groups = []
  const ordered = [...(paper.paper_questions ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  for (const item of ordered) {
    const question = item.question
    if (!question) continue
    let group = groups.find((entry) => entry.type === question.type)
    if (!group) {
      group = { type: question.type, items: [] }
      groups.push(group)
    }
    group.items.push({ ...question, score: item.score })
  }
  return groups
}

function questionBody(question, showAnswers) {
  const parts = [paragraph(question.stem, { after: 40 })]
  if (Array.isArray(question.options) && question.options.length) {
    for (const option of question.options) {
      parts.push(paragraph(`${option.key}. ${option.text ?? ''}`, { after: 20 }))
    }
  }
  if (question.type === 'match') {
    const { left, right } = matchColumns(question)
    if (left.length) parts.push(paragraph(`左列：${left.join('    ')}`, { after: 20 }))
    if (right.length) parts.push(paragraph(`右列：${right.join('    ')}`, { after: 20 }))
  }
  if (question.type === '填空') {
    const blanks = Array.isArray(question.answer) ? question.answer.length : 1
    parts.push(paragraph(`（共 ${blanks} 空）`, { size: 18, color: '666666', after: 20 }))
  }
  if (question.type === '简答' || question.type === 'correction') {
    parts.push(paragraph('答：', { after: 200 }))
  }
  if (showAnswers) {
    parts.push(paragraph(`答案：${formatAnswer(question)}`, { size: 18, color: '1B2C50', before: 40, after: 20 }))
    if (
      (question.type === '简答' || question.type === 'correction') &&
      Array.isArray(question.scoring_points) &&
      question.scoring_points.length
    ) {
      const points = question.scoring_points
        .map((point, index) => `${point}（${question.point_scores?.[index] ?? ''}分）`)
        .join('；')
      parts.push(paragraph(`得分点：${points}`, { size: 18, color: '666666', after: 40 }))
    }
  }
  return parts.join('')
}

export function paperDocumentXml(paper, { showAnswers = false } = {}) {
  const groups = groupQuestions(paper)
  const total = Number(paper.total_score)
  const count = paper.paper_questions?.length ?? 0
  const body = [
    paragraph(paper.title || '试卷', { bold: true, size: 32, align: 'center', after: 120 }),
    paragraph(`满分 ${total} 分 · 共 ${count} 题`, { align: 'center', size: 21, after: 80 }),
    paragraph('班级：__________    姓名：__________    学号：__________', { align: 'center', after: 200 }),
  ]
  let number = 0
  groups.forEach((group, index) => {
    const subtotal = group.items.reduce((sum, question) => sum + Number(question.score || 0), 0)
    const typeName = QUESTION_TYPE_LABEL[group.type] ?? group.type
    body.push(
      paragraph(
        `${CN[index] ?? index + 1}、${typeName}题（每题 ${group.items[0]?.score ?? 0} 分，共 ${subtotal} 分）`,
        { bold: true, size: 24, before: 200, after: 80 },
      ),
    )
    for (const question of group.items) {
      number += 1
      body.push(paragraph(`${number}. （${question.score} 分）`, { bold: true, before: 80, after: 40 }))
      body.push(questionBody(question, showAnswers))
    }
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join('')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

export async function paperToDocxBlob(paper, options) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  )
  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )
  const word = zip.folder('word')
  word.file('document.xml', paperDocumentXml(paper, options))
  word.folder('_rels').file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  )
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function safeFilename(title) {
  const name = String(title || '试卷')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .trim()
  return (name || '试卷').slice(0, 80)
}

export async function downloadPaperDocx(paper, { showAnswers = false } = {}) {
  const blob = await paperToDocxBlob(paper, { showAnswers })
  const suffix = showAnswers ? '-含答案' : ''
  downloadBlob(blob, `${safeFilename(paper.title)}${suffix}.docx`)
}
