import { useEffect, useMemo, useState } from 'react'
import { DIFFICULTY_LABEL, DIFFICULTIES, QUESTION_TYPES, QUESTION_TYPE_LABEL } from '../../lib/constants.js'
import { deleteQuestion, fetchKnowledgeTree, searchQuestions, updateQuestion } from '../../lib/api.js'
import { zhError } from '../../lib/errors.js'
import { formatAnswer } from '../../lib/practice.js'
import KnowledgePointPicker from '../../components/teacher/KnowledgePointPicker.jsx'
import { Button, Card, Empty, Loading, Notice, PageHeader, inputClass } from '../../components/teacher/ui.jsx'
import { findKnowledgeNode, knowledgeSubtreeIds } from '../../lib/knowledgeTree.js'

/** 只放行下划线等行内格式，其余标签保持转义，避免题干里出现可执行代码。 */
function inlineHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?)(u|b|i|em|strong|sup|sub|br)\s*\/?&gt;/gi, (_, slash, tag) => {
      const name = tag.toLowerCase()
      if (name === 'br') return '<br>'
      return slash ? `</${name}>` : `<${name}>`
    })
}

function RichText({ text, className = '' }) {
  return <span className={`[&_u]:underline ${className}`} dangerouslySetInnerHTML={{ __html: inlineHtml(text) }} />
}

function choiceOptions(question) {
  if ((question.type !== '单选' && question.type !== '多选') || !Array.isArray(question.options)) return []
  return question.options.map((opt, index) => {
    if (typeof opt === 'string') return { key: String.fromCharCode(65 + index), text: opt }
    return {
      key: String(opt?.key || String.fromCharCode(65 + index)),
      text: String(opt?.text ?? ''),
    }
  })
}

const PAGE_SIZES = [10, 20]

function draftFrom(question) {
  const answer = question.answer
  const options = Array.isArray(question.options)
    ? question.options.map((opt) => ({ key: String(opt.key ?? ''), text: String(opt.text ?? '') }))
    : []
  return {
    stem: question.stem ?? '',
    explanation: question.explanation ?? '',
    difficulty: question.difficulty ?? 'low',
    options,
    blanks: Array.isArray(answer) ? answer.map((item) => String(item ?? '')) : [String(answer ?? '')],
    single: typeof answer === 'string' ? answer : '',
    multi: Array.isArray(answer) ? answer.join('、') : '',
    judge: Boolean(answer),
    reference: question.reference_answer ?? '',
    left: Array.isArray(question.options?.left) ? question.options.left.map((item) => String(item ?? '')) : [''],
    right: Array.isArray(question.options?.right) ? question.options.right.map((item) => String(item ?? '')) : [''],
    pairs:
      question.answer && typeof question.answer === 'object' && !Array.isArray(question.answer)
        ? Object.fromEntries(Object.entries(question.answer).map(([key, value]) => [key, String(value ?? '')]))
        : {},
    points: Array.isArray(question.scoring_points) ? question.scoring_points.map((item) => String(item ?? '')) : [''],
    pointScores: Array.isArray(question.point_scores)
      ? question.point_scores.map((item) => String(item ?? ''))
      : [''],
  }
}

function buildPatch(question, draft) {
  const stem = draft.stem.trim()
  if (!stem) throw new Error('题干不能为空')
  const explanation = draft.explanation.trim()
  const difficulty = draft.difficulty
  if (!DIFFICULTIES.some((item) => item.value === difficulty)) throw new Error('请选择难度')
  const base = { stem, explanation, difficulty }

  if (question.type === '填空') {
    const blanks = draft.blanks.map((item) => item.trim())
    if (!blanks.length || blanks.some((item) => !item)) throw new Error('每一空的答案都不能为空')
    return { ...base, answer: blanks, reference_answer: blanks.join('，') }
  }
  if (question.type === '简答' || question.type === 'correction') {
    const points = draft.points.map((item) => item.trim()).filter(Boolean)
    const scores = draft.pointScores.map((item) => item.trim()).filter((item) => item !== '')
    if (points.length !== scores.length) throw new Error('得分点和分值需要一一对应')
    const pointScores = scores.map((item) => Number(item))
    if (pointScores.some((item) => !Number.isFinite(item) || item < 0)) throw new Error('得分点分值请填写数字')
    return {
      ...base,
      reference_answer: draft.reference.trim(),
      scoring_points: points.length ? points : null,
      point_scores: points.length ? pointScores : null,
    }
  }
  if (question.type === 'match') {
    const left = draft.left.map((item) => item.trim()).filter(Boolean)
    const right = draft.right.map((item) => item.trim()).filter(Boolean)
    if (!left.length || !right.length) throw new Error('请填写左右两列')
    if (left.some((item) => !String(draft.pairs[item] ?? '').trim())) throw new Error('请为左列每一项选择匹配答案')
    const answer = Object.fromEntries(left.map((item) => [item, draft.pairs[item].trim()]))
    return { ...base, options: { left, right }, answer }
  }
  if (question.type === '判断') return { ...base, answer: draft.judge, options: null }
  if (question.type === '单选' || question.type === '多选') {
    const options = draft.options.map((opt, index) => ({
      key: String.fromCharCode(65 + index),
      text: opt.text.trim(),
    }))
    if (!options.length || options.some((opt) => !opt.text)) throw new Error('请填写全部选项')
    if (question.type === '单选') {
      const answer = draft.single.trim().toUpperCase()
      if (!options.some((opt) => opt.key === answer)) throw new Error('单选答案请填写已有选项字母')
      return { ...base, options, answer }
    }
    const answer = [...new Set(draft.multi.toUpperCase().split(/[^A-H]+/).filter(Boolean))].sort()
    if (!answer.length || answer.some((key) => !options.some((opt) => opt.key === key))) {
      throw new Error('多选答案请填写已有选项字母，例如 A、C')
    }
    return { ...base, options, answer }
  }
  return base
}

export default function TeacherQuestions() {
  const [type, setType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [knowledgePointId, setKnowledgePointId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState({ type: '', difficulty: '', knowledgePointIds: [], keyword: '' })
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [jump, setJump] = useState('')
  const [rows, setRows] = useState(null)
  const [total, setTotal] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tree, setTree] = useState(null)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchKnowledgeTree()
      .then((next) => !cancelled && setTree(next))
      .catch((err) => !cancelled && setError(zhError(err, '知识点加载失败')))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setError('')
    searchQuestions({ ...query, page, pageSize })
      .then(({ rows: next, total: count }) => {
        if (cancelled) return
        setRows(next)
        setTotal(count)
      })
      .catch((err) => {
        if (cancelled) return
        setRows([])
        setError(zhError(err, '题库加载失败'))
      })
    return () => {
      cancelled = true
    }
  }, [query, page, pageSize, reloadKey])

  useEffect(() => {
    if (!editing) return undefined
    function onKey(event) {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const rangeText = useMemo(() => {
    if (!total) return '共 0 题'
    const start = page * pageSize + 1
    const end = Math.min(total, page * pageSize + (rows?.length ?? 0))
    return `第 ${start}–${end} 题，共 ${total} 题`
  }, [page, pageSize, rows, total])

  function applyFilters(next) {
    setPage(0)
    setQuery((prev) => ({ ...prev, ...next }))
  }

  function pointIdsFor(id) {
    if (!id) return []
    return knowledgeSubtreeIds(findKnowledgeNode(tree, id))
  }

  function search(event) {
    event?.preventDefault()
    applyFilters({ type, difficulty, knowledgePointIds: pointIdsFor(knowledgePointId), keyword: keyword.trim() })
  }

  function openDrawer(question) {
    setNotice('')
    setDrawerError('')
    setConfirmDelete(false)
    setEditing(question)
    setDraft(draftFrom(question))
  }

  function closeDrawer() {
    setEditing(null)
    setDraft(null)
    setDrawerError('')
    setConfirmDelete(false)
  }

  async function save() {
    if (!editing || !draft) return
    setDrawerError('')
    let patch
    try {
      patch = buildPatch(editing, draft)
    } catch (err) {
      setDrawerError(err.message)
      return
    }
    setSaving(true)
    try {
      await updateQuestion(editing.id, patch)
      closeDrawer()
      setNotice('已保存')
      setReloadKey((value) => value + 1)
    } catch (err) {
      setDrawerError(zhError(err, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing) return
    setSaving(true)
    setDrawerError('')
    try {
      await deleteQuestion(editing.id)
      const emptying = (rows?.length ?? 0) <= 1 && page > 0
      closeDrawer()
      setNotice('已删除')
      if (emptying) setPage((value) => value - 1)
      setReloadKey((value) => value + 1)
    } catch (err) {
      setDrawerError(zhError(err, '删除失败'))
    } finally {
      setSaving(false)
    }
  }

  function jumpTo(event) {
    event.preventDefault()
    const target = Number(jump)
    if (!Number.isInteger(target) || target < 1 || target > pageCount) {
      setError(`请输入 1 到 ${pageCount} 之间的页码`)
      return
    }
    setError('')
    setPage(target - 1)
    setJump('')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="题库" desc="按题型、难度和知识点查找题目，在侧栏中修改后保存。" />

      <Card>
        <form onSubmit={search} className="flex flex-wrap items-center gap-2 p-3">
          <select
            value={type}
            onChange={(e) => {
              const value = e.target.value
              setType(value)
              applyFilters({ type: value })
            }}
            className={inputClass}
            aria-label="题型"
          >
            <option value="">全部题型</option>
            {QUESTION_TYPES.map((item) => (
              <option key={item} value={item}>
                {QUESTION_TYPE_LABEL[item] ?? item}
              </option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(e) => {
              const value = e.target.value
              setDifficulty(value)
              applyFilters({ difficulty: value })
            }}
            className={inputClass}
            aria-label="按难度筛选"
          >
            <option value="">全部难度</option>
            {DIFFICULTIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <KnowledgePointPicker
            tree={tree}
            value={knowledgePointId}
            onChange={(value) => {
              setKnowledgePointId(value)
              applyFilters({ knowledgePointIds: pointIdsFor(value) })
            }}
            className={inputClass}
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索题干或答案"
            className={`${inputClass} min-w-48 flex-1`}
          />
          <Button type="submit">搜索</Button>
        </form>
      </Card>

      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <Card title="题目列表" extra={<span className="text-xs text-gray-400">{rangeText}</span>}>
        {!rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="没有符合条件的题目" />
        ) : (
          <ul>
            {rows.map((question) => {
              const options = choiceOptions(question)
              const answer = formatAnswer(question).trim()
              const explanation = String(question.explanation ?? '').trim()
              return (
                <li key={question.id} className="flex items-start gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="shrink-0 rounded bg-navy-50 px-1.5 py-0.5 font-medium text-navy-700">
                        {QUESTION_TYPE_LABEL[question.type] ?? question.type}
                      </span>
                      <span className="truncate">{question.knowledge_point?.name ?? '未挂知识点'}</span>
                      <span className="shrink-0 text-gray-400">难度 · {DIFFICULTY_LABEL[question.difficulty] ?? question.difficulty}</span>
                    </div>
                    <p className="mt-0.5 text-sm leading-5 text-gray-800 line-clamp-2">
                      <RichText text={question.stem} />
                    </p>
                    {options.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-sm leading-5 text-gray-500">
                        {options.map((opt) => (
                          <li key={opt.key} className="truncate">
                            {opt.key}. <RichText text={opt.text} />
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-sm font-medium leading-5 text-emerald-700 line-clamp-2">
                      正确答案：{answer ? <RichText text={answer} /> : '暂无'}
                    </p>
                    <p className="text-sm leading-5 text-emerald-600 line-clamp-1">
                      解析：{explanation ? <RichText text={explanation} /> : '暂无'}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" className="mt-0.5 shrink-0" onClick={() => openDrawer(question)}>
                    编辑
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 text-sm">
          <label className="flex items-center gap-2 text-gray-500">
            每页
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(0)
                setPageSize(Number(e.target.value))
              }}
              className={inputClass}
              aria-label="每页条数"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} 条
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 0} onClick={() => setPage((value) => value - 1)}>
              上一页
            </Button>
            <span className="text-gray-500 tabular-nums">
              {page + 1} / {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              下一页
            </Button>
            <form onSubmit={jumpTo} className="flex items-center gap-1">
              <input
                value={jump}
                onChange={(e) => setJump(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="页码"
                aria-label="跳转页码"
                className={`${inputClass} w-16`}
              />
              <Button type="submit" variant="secondary" size="sm">
                跳转
              </Button>
            </form>
          </div>
        </div>
      </Card>

      {editing && draft && (
        <div className="fixed inset-0 z-40">
          <button type="button" aria-label="关闭编辑" className="absolute inset-0 bg-gray-900/30" onClick={closeDrawer} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="编辑题目"
            className="absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-navy-800">编辑题目</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {QUESTION_TYPE_LABEL[editing.type] ?? editing.type}
                  {editing.knowledge_point?.name ? ` · ${editing.knowledge_point.name}` : ''}
                </p>
              </div>
              <button type="button" onClick={closeDrawer} className="text-sm text-gray-400 hover:text-gray-700">
                关闭
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <label className="block text-sm">
                <span className="text-gray-600">难度</span>
                <select
                  value={draft.difficulty}
                  onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}
                  className={`${inputClass} mt-1 w-full`}
                >
                  {DIFFICULTIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-gray-600">题干</span>
                <textarea
                  rows={5}
                  value={draft.stem}
                  onChange={(e) => setDraft({ ...draft, stem: e.target.value })}
                  className={`${inputClass} mt-1 w-full resize-y`}
                />
              </label>

              {(editing.type === '单选' || editing.type === '多选') && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">选项</div>
                  {draft.options.map((opt, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-6 text-xs text-gray-400">{String.fromCharCode(65 + index)}</span>
                      <input
                        value={opt.text}
                        onChange={(e) => {
                          const options = [...draft.options]
                          options[index] = { ...opt, text: e.target.value }
                          setDraft({ ...draft, options })
                        }}
                        className={`${inputClass} flex-1`}
                      />
                      {draft.options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDraft({ ...draft, options: draft.options.filter((_, i) => i !== index) })}
                        >
                          移除
                        </Button>
                      )}
                    </div>
                  ))}
                  {draft.options.length < 8 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDraft({ ...draft, options: [...draft.options, { key: '', text: '' }] })}
                    >
                      增加选项
                    </Button>
                  )}
                </div>
              )}

              {editing.type === '填空' && (
                <BlankFields draft={draft} setDraft={setDraft} />
              )}
              {editing.type === '单选' && (
                <label className="block text-sm">
                  <span className="text-gray-600">答案</span>
                  <input
                    value={draft.single}
                    onChange={(e) => setDraft({ ...draft, single: e.target.value })}
                    placeholder="选项字母"
                    className={`${inputClass} mt-1 w-24`}
                  />
                </label>
              )}
              {editing.type === '多选' && (
                <label className="block text-sm">
                  <span className="text-gray-600">答案</span>
                  <input
                    value={draft.multi}
                    onChange={(e) => setDraft({ ...draft, multi: e.target.value })}
                    placeholder="如 A、C、D"
                    className={`${inputClass} mt-1 w-full`}
                  />
                </label>
              )}
              {editing.type === '判断' && (
                <label className="block text-sm">
                  <span className="text-gray-600">答案</span>
                  <select
                    value={draft.judge ? 'true' : 'false'}
                    onChange={(e) => setDraft({ ...draft, judge: e.target.value === 'true' })}
                    className={`${inputClass} mt-1`}
                  >
                    <option value="true">对</option>
                    <option value="false">错</option>
                  </select>
                </label>
              )}
              {(editing.type === '简答' || editing.type === 'correction') && (
                <ShortFields draft={draft} setDraft={setDraft} />
              )}
              {editing.type === 'match' && <MatchFields draft={draft} setDraft={setDraft} />}

              <label className="block text-sm">
                <span className="text-gray-600">解析</span>
                <textarea
                  rows={4}
                  value={draft.explanation}
                  onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                  className={`${inputClass} mt-1 w-full resize-y`}
                />
              </label>
              {drawerError && <Notice tone="error">{drawerError}</Notice>}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
              {confirmDelete ? (
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm text-red-600">确认删除这道题？删除后不能恢复。</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={saving} onClick={() => setConfirmDelete(false)}>
                      取消
                    </Button>
                    <Button variant="danger" size="sm" disabled={saving} onClick={remove}>
                      {saving ? '删除中…' : '确认删除'}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button variant="danger" size="sm" disabled={saving} onClick={() => setConfirmDelete(true)}>
                    删除
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="secondary" disabled={saving} onClick={closeDrawer}>
                      取消
                    </Button>
                    <Button disabled={saving} onClick={save}>
                      {saving ? '保存中…' : '保存'}
                    </Button>
                  </div>
                </>
              )}
            </footer>
          </aside>
        </div>
      )}
    </div>
  )
}

function BlankFields({ draft, setDraft }) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-600">答案</div>
      {draft.blanks.map((blank, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-gray-400">第 {index + 1} 空</span>
          <input
            value={blank}
            onChange={(e) => {
              const blanks = [...draft.blanks]
              blanks[index] = e.target.value
              setDraft({ ...draft, blanks })
            }}
            className={`${inputClass} flex-1`}
          />
          {draft.blanks.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, blanks: draft.blanks.filter((_, i) => i !== index) })}>
              移除
            </Button>
          )}
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => setDraft({ ...draft, blanks: [...draft.blanks, ''] })}>
        增加一空
      </Button>
      <p className="text-xs text-gray-400">多种写法用 / 隔开，例如 冷淡/不热情。</p>
    </div>
  )
}

function ShortFields({ draft, setDraft }) {
  const count = Math.max(draft.points.length, draft.pointScores.length, 1)
  const points = Array.from({ length: count }, (_, index) => draft.points[index] ?? '')
  const scores = Array.from({ length: count }, (_, index) => draft.pointScores[index] ?? '')

  function setAt(index, point, score) {
    const nextPoints = [...points]
    const nextScores = [...scores]
    nextPoints[index] = point
    nextScores[index] = score
    setDraft({ ...draft, points: nextPoints, pointScores: nextScores })
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="text-gray-600">参考答案</span>
        <textarea
          rows={4}
          value={draft.reference}
          onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
          className={`${inputClass} mt-1 w-full resize-y`}
        />
      </label>
      <div className="text-sm text-gray-600">得分点</div>
      {points.map((point, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={point}
            onChange={(e) => setAt(index, e.target.value, scores[index])}
            placeholder="得分点"
            className={`${inputClass} flex-1`}
          />
          <input
            value={scores[index]}
            onChange={(e) => setAt(index, point, e.target.value)}
            placeholder="分值"
            className={`${inputClass} w-16`}
          />
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setDraft({ ...draft, points: [...points, ''], pointScores: [...scores, ''] })}
      >
        增加得分点
      </Button>
    </div>
  )
}

function MatchFields({ draft, setDraft }) {
  function setList(key, index, value) {
    const list = [...draft[key]]
    list[index] = value
    const next = { ...draft, [key]: list }
    if (key === 'left') {
      const pairs = { ...draft.pairs }
      const previous = draft.left[index]
      if (previous && previous !== value) {
        pairs[value] = pairs[previous] ?? ''
        delete pairs[previous]
      }
      next.pairs = pairs
    }
    setDraft(next)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="text-sm text-gray-600">左列</div>
        {draft.left.map((item, index) => (
          <input
            key={`left-${index}`}
            value={item}
            onChange={(e) => setList('left', index, e.target.value)}
            className={`${inputClass} w-full`}
          />
        ))}
        <Button variant="secondary" size="sm" onClick={() => setDraft({ ...draft, left: [...draft.left, ''] })}>
          增加左列
        </Button>
      </div>
      <div className="space-y-2">
        <div className="text-sm text-gray-600">右列选项</div>
        {draft.right.map((item, index) => (
          <input
            key={`right-${index}`}
            value={item}
            onChange={(e) => setList('right', index, e.target.value)}
            className={`${inputClass} w-full`}
          />
        ))}
        <Button variant="secondary" size="sm" onClick={() => setDraft({ ...draft, right: [...draft.right, ''] })}>
          增加右列
        </Button>
      </div>
      <div className="space-y-2">
        <div className="text-sm text-gray-600">答案</div>
        {draft.left.filter((item) => item.trim()).map((item) => (
          <label key={item} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate text-gray-500">{item}</span>
            <select
              value={draft.pairs[item] ?? ''}
              onChange={(e) => setDraft({ ...draft, pairs: { ...draft.pairs, [item]: e.target.value } })}
              className={`${inputClass} flex-1`}
            >
              <option value="">请选择</option>
              {draft.right.filter((option) => option.trim()).map((option) => (
                <option key={option} value={option.trim()}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  )
}
