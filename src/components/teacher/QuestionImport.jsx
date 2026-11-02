import { useMemo, useState } from 'react'
import { insertImportedQuestions } from '../../lib/api.js'
import { DIFFICULTIES, QUESTION_TYPES, QUESTION_TYPE_LABEL } from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'
import { TEXTBOOK_LABEL } from '../../lib/textbook.js'
import { Button, Notice, inputClass } from './ui.jsx'

const DIFF_LABEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.value, d.label]))

/**
 * 上传后的识别结果。教师核对后写入题库。
 * drafts 每项已带教材节次名称，这里用当前知识点树换成 id。
 */
export default function QuestionImport({ batch, tree, userId, onClose, onSaved }) {
  const [rows, setRows] = useState(() => batch.drafts.map((d, i) => ({ ...d, key: i, checked: true })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const pointId = useMemo(() => {
    const map = new Map()
    for (const ch of tree ?? []) {
      for (const kp of ch.children) map.set(`${ch.name}/${kp.name}`, kp.id)
    }
    return map
  }, [tree])

  function patch(key, partial) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...partial } : r)))
  }

  function setPoint(key, value) {
    const [chapter, name] = value.split('/')
    patch(key, { chapter: chapter || '', knowledge_point_name: name || '', missing_point: !name })
  }

  async function save() {
    const chosen = rows.filter((r) => r.checked)
    if (!chosen.length) return setError('请至少勾选一道题')
    const payload = []
    for (const r of chosen) {
      const id = pointId.get(`${r.chapter}/${r.knowledge_point_name}`)
      if (!id) return setError(`「${r.stem.slice(0, 18)}」还没有对应的教材节次，请先执行教材知识点脚本或改选节次`)
      if (!r.stem.trim()) return setError('题干不能为空')
      if (r.type !== '简答' && (r.answer == null || r.answer === '' || (Array.isArray(r.answer) && !r.answer.length))) {
        return setError(`「${r.stem.slice(0, 18)}」还缺少答案`)
      }
      payload.push({
        knowledge_point_id: id,
        type: r.type,
        difficulty: r.difficulty,
        difficulty_reason: r.difficulty_reason,
        stem: r.stem.trim(),
        options: r.options,
        answer: r.type === '简答' ? null : r.answer,
        explanation: r.explanation,
        reference_answer: r.type === '简答' ? r.reference_answer : null,
        scoring_points: r.type === '简答' ? r.scoring_points : null,
        point_scores: r.type === '简答' ? r.point_scores : null,
        source_material_id: batch.materialId,
        created_by: userId ?? null,
      })
    }
    setSaving(true)
    setError('')
    try {
      const saved = await insertImportedQuestions(payload)
      onSaved(saved.length, payload.length - saved.length)
    } catch (err) {
      setError(zhError(err, '写入题库失败'))
      setSaving(false)
    }
  }

  return (
    <section className="rounded-teacher bg-white border border-navy-200 p-4 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy-800">已识别题目 · {batch.title}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {batch.source}，共 {rows.length} 题。知识点只使用{TEXTBOOK_LABEL}的节次，请核对后入库。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={saving} onClick={onClose}>
            暂不入库
          </Button>
          <Button size="sm" disabled={saving} onClick={save}>
            {saving ? '写入中…' : '确认入库'}
          </Button>
        </div>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {!tree && <Notice tone="error">知识点还在加载，请稍候再入库。</Notice>}

      <ul className="space-y-3 max-h-[70vh] overflow-y-auto">
        {rows.map((r, index) => (
          <li key={r.key} className="rounded-teacher border border-gray-200 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={r.checked}
                onChange={(e) => patch(r.key, { checked: e.target.checked })}
                className="accent-navy-600"
              />
              <span>第 {index + 1} 题</span>
              {r.missing_answer && <span className="text-red-600">缺少答案</span>}
              {r.missing_point && <span className="text-amber-700">请核对节次</span>}
            </div>
            <textarea
              rows={2}
              value={r.stem}
              onChange={(e) => patch(r.key, { stem: e.target.value })}
              className={`${inputClass} w-full`}
              placeholder="请输入题干"
            />
            <div className="grid gap-2 md:grid-cols-4">
              <select className={inputClass} value={r.type} onChange={(e) => patch(r.key, { type: e.target.value })}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>{QUESTION_TYPE_LABEL[t] ?? t}</option>
                ))}
              </select>
              <select className={inputClass} value={r.difficulty} onChange={(e) => patch(r.key, { difficulty: e.target.value })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>{DIFF_LABEL[d.value]}</option>
                ))}
              </select>
              <select
                className={`${inputClass} md:col-span-2`}
                value={r.knowledge_point_name ? `${r.chapter}/${r.knowledge_point_name}` : ''}
                onChange={(e) => setPoint(r.key, e.target.value)}
              >
                <option value="">请选择教材节次</option>
                {(tree ?? []).map((ch) => (
                  <optgroup key={ch.id} label={ch.name}>
                    {ch.children.map((kp) => (
                      <option key={kp.id} value={`${ch.name}/${kp.name}`}>
                        {ch.name} · {kp.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {Array.isArray(r.options) && r.options.length > 0 && (
              <p className="text-xs text-gray-600">
                {r.options.map((o) => `${o.key}. ${o.text}`).join('　')}
              </p>
            )}
            <p className="text-xs text-gray-600">
              答案：{formatPreview(r)}
            </p>
            <p className="text-xs text-gray-400 whitespace-pre-wrap">{r.explanation}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatPreview(r) {
  if (r.type === '判断') return r.answer === true ? '对' : r.answer === false ? '错' : '未识别'
  if (Array.isArray(r.answer)) return r.answer.join('、')
  if (r.type === '简答') return r.reference_answer || '见解析'
  return r.answer || '未识别'
}
