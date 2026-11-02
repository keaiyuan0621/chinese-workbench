import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Loading,
  Notice,
  PageHeader,
  Table,
  Tabs,
  formatDate,
  inputClass,
} from '../../components/teacher/ui.jsx'
import { useKnowledgeTree } from '../../hooks/useKnowledgeTree.js'
import { usePaperCart } from '../../hooks/usePaperCart.js'
import {
  createPaper,
  deletePaper,
  fetchErrorStats,
  fetchPaperDetail,
  fetchPapers,
  fetchQuestionMeta,
  fetchQuestionsByIds,
} from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.js'
import { CHAPTERS, DIFFICULTIES, DIFFICULTY_LABEL, QUESTION_TYPES, QUESTION_TYPE_LABEL } from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'
import { downloadPaperDocx } from '../../lib/paperDocx.js'
import { formatAnswer, matchColumns, shuffle } from '../../lib/practice.js'

/** 各题型默认分值 */
const DEFAULT_SCORE = { 单选: 2, 多选: 3, 判断: 1, 填空: 2, 简答: 10, match: 5, correction: 10 }

function today() {
  return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function TeacherPapers() {
  const [tab, setTab] = useState('data')
  const [notice, setNotice] = useState('')
  const [papersVersion, setPapersVersion] = useState(0)
  const cart = usePaperCart()

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 3000)
    return () => clearTimeout(t)
  }, [notice])

  function onCreated(msg) {
    setNotice(msg)
    setPapersVersion((v) => v + 1)
    setTab('list')
  }

  return (
    <div className="space-y-5">
      <PageHeader title="组卷" desc="数据驱动：按错误率推荐；手动：按二级知识点、题型、难度和数量配置，可生成 A/B 卷，并可下载 Word" />
      <Notice tone="success">{notice}</Notice>

      {cart.items.length > 0 && (
        <Card
          title={`来自看板的待选题目（${cart.items.length}）`}
          extra={
            <Button variant="ghost" size="sm" onClick={cart.clear}>
              清空
            </Button>
          }
        >
          <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
            {cart.items.map((it) => (
              <li key={it.question_id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="rounded bg-gray-100 text-gray-500 px-1.5 py-0.5 text-xs shrink-0">{it.type}</span>
                <span className="flex-1 text-gray-800 truncate">{it.stem}</span>
                <button type="button" onClick={() => cart.remove(it.question_id)} className="text-xs text-gray-400 hover:text-red-600">
                  移除
                </button>
              </li>
            ))}
          </ul>
          <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
            生成试卷时这些题目会自动排在最前面
          </p>
        </Card>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'data', label: '数据驱动组卷' },
          { value: 'manual', label: '手动组卷' },
          { value: 'list', label: '已生成试卷' },
        ]}
      />

      {tab === 'data' && <DataDriven cart={cart} onCreated={onCreated} />}
      {tab === 'manual' && <Manual cart={cart} onCreated={onCreated} />}
      {tab === 'list' && <PaperList version={papersVersion} onNotice={setNotice} />}
    </div>
  )
}

// =====================================================================
// 数据驱动
// =====================================================================

function DataDriven({ cart, onCreated }) {
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState({}) // { [qid]: score }
  const [title, setTitle] = useState(`错题巩固卷 ${today()}`)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchErrorStats()
      .then((data) => {
        if (cancelled) return
        setRows(data)
        // 默认勾选错误率最高的前 10 道有错题
        const init = {}
        for (const r of data.filter((x) => x.wrong_count > 0).slice(0, 10)) init[r.question_id] = DEFAULT_SCORE[r.type] ?? 2
        setSelected(init)
      })
      .catch((err) => !cancelled && setError(zhError(err, '推荐数据加载失败')))
    return () => {
      cancelled = true
    }
  }, [])

  const chosen = useMemo(() => (rows ?? []).filter((r) => selected[r.question_id] != null), [rows, selected])
  const cartExtra = cart.items.filter((it) => selected[it.question_id] == null)
  const total =
    chosen.reduce((s, r) => s + Number(selected[r.question_id] || 0), 0) +
    cartExtra.reduce((s, it) => s + (DEFAULT_SCORE[it.type] ?? 2), 0)

  function toggle(r) {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[r.question_id] != null) delete next[r.question_id]
      else next[r.question_id] = DEFAULT_SCORE[r.type] ?? 2
      return next
    })
  }

  async function save() {
    if (!title.trim()) return setError('请填写试卷标题')
    const items = [
      ...cartExtra.map((it) => ({ question_id: it.question_id, score: DEFAULT_SCORE[it.type] ?? 2 })),
      ...chosen.map((r) => ({ question_id: r.question_id, score: Number(selected[r.question_id]) })),
    ]
    if (!items.length) return setError('请至少选择一道题目')
    setError('')
    setSaving(true)
    try {
      await createPaper(
        { title: title.trim(), config: { source: 'data', threshold: null, from_cart: cartExtra.length }, createdBy: user?.id },
        items,
      )
      cart.clear()
      onCreated(`已生成试卷「${title.trim()}」，共 ${items.length} 题 ${total} 分`)
    } catch (err) {
      setError(zhError(err, '生成试卷失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}

      <Card
        title="系统推荐（按错误率排序）"
        extra={
          <span className="text-xs text-gray-500">
            已选 {chosen.length + cartExtra.length} 题 · 共 {total} 分
          </span>
        }
      >
        {!rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="还没有作答数据，无法推荐。可先使用手动组卷。" />
        ) : (
          <Table
            head={[
              { label: '', className: 'w-10' },
              { label: '题目' },
              { label: '题型', className: 'w-16' },
              { label: '难度', className: 'w-16' },
              { label: '错 / 答', className: 'w-20 text-right' },
              { label: '错误率', className: 'w-20 text-right' },
              { label: '分值', className: 'w-24' },
            ]}
          >
            {rows.map((r) => {
              const on = selected[r.question_id] != null
              return (
                <tr key={r.question_id} className={`align-top ${on ? 'bg-navy-50/40' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={on} onChange={() => toggle(r)} className="accent-navy-600" />
                  </td>
                  <td className="px-4 py-2.5 text-gray-800 line-clamp-2">{r.stem}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.type}</td>
                  <td className="px-4 py-2.5 text-gray-600">{DIFFICULTY_LABEL[r.difficulty]}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {r.wrong_count} / {r.attempts}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{Math.round(r.error_rate * 100)}%</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      disabled={!on}
                      value={on ? selected[r.question_id] : ''}
                      onChange={(e) => setSelected((p) => ({ ...p, [r.question_id]: e.target.value }))}
                      className={`${inputClass} w-20 py-1`}
                    />
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inputClass} w-72`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="请输入试卷标题" />
        <Button disabled={saving || !rows} onClick={save}>
          {saving ? '生成中…' : '一键采纳生成卷子'}
        </Button>
      </div>
    </div>
  )
}

// =====================================================================
// 手动组卷
// =====================================================================

function Manual({ cart, onCreated }) {
  const { user } = useAuth()
  const { tree } = useKnowledgeTree()
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')

  const [counts, setCounts] = useState({}) // { [`${sectionId}|${type}`]: n }
  const [scores, setScores] = useState({ ...DEFAULT_SCORE })
  const [difficulties, setDifficulties] = useState(() => new Set(DIFFICULTIES.map((item) => item.value)))
  const [openChapters, setOpenChapters] = useState(() => new Set(CHAPTERS))
  const [title, setTitle] = useState(`现代汉语测验 ${today()}`)
  const [ab, setAb] = useState(false)

  const [preview, setPreview] = useState(null) // { A: [questions], B?: [questions] }
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchQuestionMeta()
      .then((rows) => !cancelled && setMeta(rows))
      .catch((err) => !cancelled && setError(zhError(err, '题库加载失败')))
    return () => {
      cancelled = true
    }
  }, [])

  // 任意知识点 → 所属二级知识点。三级题目计入父级，二级自身的综合练习也计入该行。
  const sectionOf = useMemo(() => {
    const map = {}
    const walk = (node, section) => {
      map[node.id] = section
      for (const child of node.children ?? []) walk(child, section)
    }
    for (const chapter of tree ?? []) {
      for (const section of chapter.children ?? []) {
        walk(section, { id: section.id, name: section.name, chapter: chapter.name })
      }
    }
    return map
  }, [tree])

  const sectionsByChapter = useMemo(() => {
    const map = {}
    for (const chapter of tree ?? []) {
      map[chapter.name] = [...(chapter.children ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    }
    return map
  }, [tree])

  // 可用题量只统计已勾选难度。
  const avail = useMemo(() => {
    const a = {}
    for (const q of meta ?? []) {
      if (!difficulties.has(q.difficulty)) continue
      const section = sectionOf[q.knowledge_point_id]
      if (!section) continue
      const key = `${section.id}|${q.type}`
      a[key] = (a[key] ?? 0) + 1
    }
    return a
  }, [meta, sectionOf, difficulties])

  useEffect(() => {
    setCounts((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [key, value] of Object.entries(prev)) {
        const max = avail[key] ?? 0
        if (Number(value) > max) {
          next[key] = max
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [avail])

  const totalCount = Object.values(counts).reduce((s, v) => s + Number(v || 0), 0)
  const totalScore = Object.entries(counts).reduce((s, [key, n]) => {
    const type = key.split('|')[1]
    return s + Number(n || 0) * Number(scores[type] || 0)
  }, 0)
  const cartScore = cart.items.reduce((s, it) => s + Number(scores[it.type] || 0), 0)

  function toggleChapter(name) {
    setOpenChapters((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleDifficulty(value) {
    if (difficulties.has(value) && difficulties.size === 1) return
    setDifficulties((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
    setPreview(null)
  }

  function setCount(sectionId, type, v) {
    const max = avail[`${sectionId}|${type}`] ?? 0
    const n = Math.max(0, Math.min(max, Number(v) || 0))
    setCounts((prev) => ({ ...prev, [`${sectionId}|${type}`]: n }))
  }

  function pickSet(exclude) {
    const picked = []
    for (const [key, n] of Object.entries(counts)) {
      if (!n) continue
      const splitAt = key.indexOf('|')
      const sectionId = key.slice(0, splitAt)
      const type = key.slice(splitAt + 1)
      const pool = meta.filter(
        (q) => sectionOf[q.knowledge_point_id]?.id === sectionId && q.type === type && difficulties.has(q.difficulty),
      )
      const fresh = pool.filter((q) => !exclude.has(q.id))
      const take = shuffle(fresh).slice(0, n)
      if (take.length < n) take.push(...shuffle(pool.filter((q) => !take.includes(q))).slice(0, n - take.length))
      picked.push(...take.map((q) => ({ ...q, score: Number(scores[type] || 0) })))
    }
    return picked
  }

  async function generate() {
    if (!meta) return
    if (!totalCount && !cart.items.length) return setError('请至少为一个二级知识点填写数量')
    setError('')
    setGenerating(true)
    try {
      const cartIds = new Set(cart.items.map((it) => it.question_id))
      const A = pickSet(cartIds)
      const B = ab ? pickSet(new Set([...cartIds, ...A.map((q) => q.id)])) : null
      const ids = [...new Set([...cartIds, ...A.map((q) => q.id), ...(B ?? []).map((q) => q.id)])]
      const full = await fetchQuestionsByIds(ids)
      const byId = Object.fromEntries(full.map((q) => [q.id, q]))
      const build = (set) => [
        ...cart.items.map((it) => ({ ...byId[it.question_id], score: Number(scores[it.type] || 0) })),
        ...set.map((q) => ({ ...byId[q.id], score: q.score })),
      ]
      setPreview({ A: build(A), B: B ? build(B) : null })
    } catch (err) {
      setError(zhError(err, '生成失败'))
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!preview) return
    if (!title.trim()) return setError('请填写试卷标题')
    setSaving(true)
    try {
      const blueprint = Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([key, n]) => {
          const splitAt = key.indexOf('|')
          const sectionId = key.slice(0, splitAt)
          const type = key.slice(splitAt + 1)
          const section = sectionOf[sectionId]
          return {
            chapter: section?.chapter ?? '',
            section: section?.name ?? '',
            type,
            count: n,
            score: Number(scores[type] || 0),
          }
        })
      const base = {
        source: 'manual',
        blueprint,
        difficulties: DIFFICULTIES.map((item) => item.value).filter((value) => difficulties.has(value)),
        from_cart: cart.items.length,
      }
      const variants = preview.B ? ['A', 'B'] : [null]
      for (const v of variants) {
        const qs = v === 'B' ? preview.B : preview.A
        await createPaper(
          {
            title: v ? `${title.trim()}（${v} 卷）` : title.trim(),
            config: { ...base, variant: v },
            createdBy: user?.id,
          },
          qs.map((q) => ({ question_id: q.id, score: q.score })),
        )
      }
      cart.clear()
      onCreated(preview.B ? `已生成 A、B 两份试卷「${title.trim()}」` : `已生成试卷「${title.trim()}」`)
    } catch (err) {
      setError(zhError(err, '保存试卷失败'))
    } finally {
      setSaving(false)
    }
  }

  const chapters = (tree ?? []).map((c) => c.name).filter((n) => CHAPTERS.includes(n))
  const orderedChapters = CHAPTERS.filter((c) => chapters.includes(c))

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}

      <Card
        title="配置蓝图：二级知识点 × 题型 × 难度 × 数量"
        extra={
          <span className="text-xs text-gray-500">
            共 {totalCount + cart.items.length} 题 · {totalScore + cartScore} 分
          </span>
        }
      >
        {!meta || !tree ? (
          <Loading />
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5">
              <span className="text-sm font-medium text-gray-700">难度</span>
              {DIFFICULTIES.map((item) => {
                const on = difficulties.has(item.value)
                return (
                  <label
                    key={item.value}
                    className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-teacher border px-2.5 text-sm ${
                      on ? 'border-navy-300 bg-navy-50 text-navy-800' : 'border-gray-200 text-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleDifficulty(item.value)}
                      className="accent-navy-600"
                    />
                    {item.label}
                  </label>
                )
              })}
              <span className="text-xs text-gray-400">题库数量和抽题都按已勾选的难度计算，至少保留一个难度</span>
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={() => setOpenChapters(new Set(orderedChapters))} className="text-xs text-navy-600 hover:underline">
                  全部展开
                </button>
                <button type="button" onClick={() => setOpenChapters(new Set())} className="text-xs text-navy-600 hover:underline">
                  全部收起
                </button>
              </span>
            </div>
            <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
              展开章节后按二级知识点填写数量。题库数字包含该知识点自己的题目，以及它下面三级知识点的题目。
            </p>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium min-w-52">知识点</th>
                  {QUESTION_TYPES.map((t) => (
                    <th key={t} className="px-3 py-2 text-center font-medium">
                      <div>{QUESTION_TYPE_LABEL[t] ?? t}</div>
                      <div className="mt-1 flex items-center justify-center gap-1 text-xs font-normal">
                        每题
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={scores[t]}
                          onChange={(e) => setScores((p) => ({ ...p, [t]: e.target.value }))}
                          className={`${inputClass} w-14 py-0.5 px-1.5 text-center`}
                        />
                        分
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orderedChapters.map((ch) => {
                  const sections = sectionsByChapter[ch] ?? []
                  const open = openChapters.has(ch)
                  const filled = sections.reduce(
                    (sum, section) =>
                      sum + QUESTION_TYPES.reduce((inner, type) => inner + Number(counts[`${section.id}|${type}`] || 0), 0),
                    0,
                  )
                  return (
                    <Fragment key={ch}>
                      <tr className="bg-gray-50/80">
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => toggleChapter(ch)}
                            className="flex items-center gap-2 text-left font-medium text-gray-800"
                          >
                            <span className="w-8 text-xs font-normal text-navy-600">{open ? '收起' : '展开'}</span>
                            {ch}
                          </button>
                          <div className="mt-0.5 pl-10 text-xs text-gray-400">
                            {sections.length} 个二级知识点{filled > 0 ? ` · 已填 ${filled} 题` : ''}
                          </div>
                        </td>
                        {QUESTION_TYPES.map((type) => {
                          const bank = sections.reduce((sum, section) => sum + (avail[`${section.id}|${type}`] ?? 0), 0)
                          const chosen = sections.reduce((sum, section) => sum + Number(counts[`${section.id}|${type}`] || 0), 0)
                          return (
                            <td key={type} className="px-3 py-2 text-center text-xs text-gray-400">
                              {chosen > 0 ? <span className="block text-sm tabular-nums text-navy-700">{chosen}</span> : null}
                              题库 {bank}
                            </td>
                          )
                        })}
                      </tr>
                      {open &&
                        sections.map((section) => (
                          <tr key={section.id}>
                            <td className="px-4 py-2 pl-14 text-gray-800">{section.name}</td>
                            {QUESTION_TYPES.map((type) => {
                              const key = `${section.id}|${type}`
                              const max = avail[key] ?? 0
                              return (
                                <td key={type} className="px-3 py-2 text-center">
                                  <input
                                    type="number"
                                    min={0}
                                    max={max}
                                    disabled={max === 0}
                                    value={counts[key] ?? ''}
                                    placeholder="0"
                                    aria-label={`${ch} ${section.name} ${QUESTION_TYPE_LABEL[type] ?? type}`}
                                    onChange={(e) => setCount(section.id, type, e.target.value)}
                                    className={`${inputClass} w-16 py-1 text-center ${max === 0 ? 'bg-gray-50' : ''}`}
                                  />
                                  <div className="mt-0.5 text-xs text-gray-400">题库 {max}</div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inputClass} w-72`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="请输入试卷标题" />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={ab} onChange={(e) => setAb(e.target.checked)} className="accent-navy-600" />
          生成 A / B 两卷（题目尽量不重复）
        </label>
        <Button variant="secondary" disabled={generating || !meta} onClick={generate}>
          {generating ? '抽题中…' : preview ? '重新抽题' : '预览抽题'}
        </Button>
        {preview && (
          <Button disabled={saving} onClick={save}>
            {saving ? '保存中…' : preview.B ? '保存 A / B 卷' : '保存试卷'}
          </Button>
        )}
      </div>

      {preview && (
        <div className={`grid gap-4 ${preview.B ? 'xl:grid-cols-2' : ''}`}>
          <PaperPreview label={preview.B ? 'A 卷' : '预览'} questions={preview.A} />
          {preview.B && <PaperPreview label="B 卷" questions={preview.B} />}
        </div>
      )}
    </div>
  )
}

function PaperPreview({ label, questions }) {
  const total = questions.reduce((s, q) => s + Number(q.score || 0), 0)
  return (
    <Card title={`${label} · ${questions.length} 题 · ${total} 分`}>
      <ol className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
        {questions.map((q, i) => (
          <li key={`${q.id}-${i}`} className="px-4 py-2.5 text-sm flex gap-3">
            <span className="text-gray-400 w-6 shrink-0 tabular-nums">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="text-gray-800 line-clamp-2">{q.stem}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {q.type} · {DIFFICULTY_LABEL[q.difficulty]} · {q.knowledge_point?.name}
              </div>
            </div>
            <span className="text-gray-500 shrink-0 tabular-nums">{q.score} 分</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

// =====================================================================
// 已生成试卷
// =====================================================================

function PaperList({ version, onNotice }) {
  const [papers, setPapers] = useState(null)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchPapers()
      .then((rows) => !cancelled && setPapers(rows))
      .catch((err) => !cancelled && setError(zhError(err, '试卷列表加载失败')))
    return () => {
      cancelled = true
    }
  }, [version])

  async function openDetail(p) {
    setLoadingDetail(true)
    try {
      const d = await fetchPaperDetail(p.id)
      d.paper_questions.sort((a, b) => a.sort_order - b.sort_order)
      setDetail(d)
    } catch (err) {
      setError(zhError(err, '试卷加载失败'))
    } finally {
      setLoadingDetail(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deletePaper(toDelete.id)
      setPapers((prev) => prev.filter((p) => p.id !== toDelete.id))
      onNotice(`已删除试卷「${toDelete.title}」`)
      setToDelete(null)
    } catch (err) {
      setError(zhError(err, '删除失败'))
    } finally {
      setDeleting(false)
    }
  }

  if (detail) return <PaperDetail paper={detail} onBack={() => setDetail(null)} />

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      <Card title="试卷列表">
        {!papers ? (
          <Loading />
        ) : papers.length === 0 ? (
          <Empty text="还没有生成过试卷" />
        ) : (
          <Table
            head={[
              { label: '标题' },
              { label: '来源', className: 'w-24' },
              { label: '题数', className: 'w-16 text-right' },
              { label: '总分', className: 'w-16 text-right' },
              { label: '创建时间', className: 'w-40' },
              { label: '操作', className: 'w-28 text-right' },
            ]}
          >
            {papers.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-800 font-medium">{p.title}</td>
                <td className="px-4 py-2.5 text-gray-500">{p.config?.source === 'data' ? '数据驱动' : '手动'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.paper_questions?.[0]?.count ?? 0}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{Number(p.total_score)}</td>
                <td className="px-4 py-2.5 text-gray-500">{formatDate(p.created_at, true)}</td>
                <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                  <button type="button" disabled={loadingDetail} onClick={() => openDetail(p)} className="text-navy-600 hover:underline">
                    查看
                  </button>
                  <button type="button" onClick={() => setToDelete(p)} className="text-red-600 hover:underline">
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {toDelete && (
        <ConfirmDialog
          title="确认删除试卷"
          desc={`将删除「${toDelete.title}」，此操作无法撤销。`}
          confirmText="确认删除"
          danger
          busy={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}

function PaperDetail({ paper, onBack }) {
  const [showAnswers, setShowAnswers] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const groups = useMemo(() => {
    const g = []
    for (const pq of paper.paper_questions) {
      const q = pq.question
      if (!q) continue
      let grp = g.find((x) => x.type === q.type)
      if (!grp) {
        grp = { type: q.type, items: [] }
        g.push(grp)
      }
      grp.items.push({ ...q, score: pq.score })
    }
    return g
  }, [paper])

  const cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  let no = 0

  async function downloadWord() {
    setExporting(true)
    setExportError('')
    try {
      await downloadPaperDocx(paper, { showAnswers })
    } catch (err) {
      setExportError(zhError(err, 'Word 下载没有完成，请稍后再试'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={onBack}>
          ← 返回列表
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowAnswers((v) => !v)}>
            {showAnswers ? '隐藏答案' : '显示答案'}
          </Button>
          <Button variant="secondary" disabled={exporting} onClick={downloadWord}>
            {exporting ? '正在生成 Word…' : '下载 Word'}
          </Button>
          <Button onClick={() => window.print()}>打印 / 导出 PDF</Button>
        </div>
      </div>

      {exportError && <Notice tone="error">{exportError}</Notice>}

      <article className="rounded-teacher bg-white border border-gray-200 p-8 print:border-0 print:p-0 max-w-3xl mx-auto">
        <h1 className="text-center text-2xl font-bold text-gray-900">{paper.title}</h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          满分 {Number(paper.total_score)} 分 · 共 {paper.paper_questions.length} 题
        </p>
        <div className="mt-4 flex justify-center gap-10 text-sm text-gray-600">
          <span>班级：__________</span>
          <span>姓名：__________</span>
          <span>学号：__________</span>
        </div>

        {groups.map((grp, gi) => {
          const sub = grp.items.reduce((s, q) => s + Number(q.score || 0), 0)
          return (
            <section key={grp.type} className="mt-8">
              <h2 className="font-semibold text-gray-900">
                {cn[gi] ?? gi + 1}、{QUESTION_TYPE_LABEL[grp.type] ?? grp.type}题（每题 {grp.items[0]?.score} 分，共 {sub} 分）
              </h2>
              <ol className="mt-3 space-y-4">
                {grp.items.map((q) => {
                  no++
                  return (
                    <li key={q.id} className="text-sm text-gray-800">
                      <div className="flex gap-2">
                        <span className="shrink-0">{no}.</span>
                        <div className="flex-1">
                          <p className="whitespace-pre-wrap">{q.stem}</p>
                          {Array.isArray(q.options) && q.options.length > 0 && (
                            <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                              {q.options.map((o) => (
                                <li key={o.key}>
                                  {o.key}. {o.text}
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.type === 'match' && (
                            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                              <p>左列：{matchColumns(q).left.join('、')}</p>
                              <p>右列：{matchColumns(q).right.join('、')}</p>
                            </div>
                          )}
                          {q.type === '填空' && (
                            <p className="mt-1 text-gray-400 text-xs">（共 {Array.isArray(q.answer) ? q.answer.length : 1} 空）</p>
                          )}
                          {(q.type === '简答' || q.type === 'correction') && (
                            <div className="mt-2 h-20 border-b border-dashed border-gray-300" />
                          )}
                          {showAnswers && (
                            <p className="mt-1.5 text-xs text-navy-700 bg-navy-50 rounded px-2 py-1 print:bg-transparent">
                              答案：{formatAnswer(q)}
                              {(q.type === '简答' || q.type === 'correction') && Array.isArray(q.scoring_points) && (
                                <span className="block mt-0.5 text-gray-500">
                                  得分点：{q.scoring_points.map((p, i) => `${p}（${q.point_scores?.[i] ?? ''}分）`).join('；')}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      </article>
    </div>
  )
}
