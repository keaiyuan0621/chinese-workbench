import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, Loading, Notice, PageHeader, Tabs, formatDate, inputClass } from '../../components/teacher/ui.jsx'
import { fullScoreOf } from '../../lib/aiGrading.js'
import { fetchReviewQueue, submitReview } from '../../lib/api.js'
import { DIFFICULTY_LABEL } from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'

export default function TeacherReview() {
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState(null)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchReviewQueue({ reviewed: false }), fetchReviewQueue({ reviewed: true })])
      .then(([p, d]) => {
        if (cancelled) return
        setPending(p)
        setDone(d)
      })
      .catch((err) => !cancelled && setError(zhError(err, '复核队列加载失败')))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(t)
  }, [notice])

  const list = tab === 'pending' ? pending : done
  const active = useMemo(() => (list ?? []).find((r) => r.id === activeId) ?? null, [list, activeId])

  function handleSubmitted(row) {
    setPending((prev) => prev.filter((r) => r.id !== row.id))
    setDone((prev) => [row, ...(prev ?? []).filter((r) => r.id !== row.id)])
    setActiveId(null)
    setNotice(`已完成复核：${row.student?.display_name ?? '学生'} · ${Number(row.final_score)} 分`)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="简答复核" desc="按得分点自动批改。只有网络失败或批改结果无法解析时，才会出现在待复核列表" />
      <Notice tone="success">{notice}</Notice>
      {error && <Notice tone="error">{error}</Notice>}

      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v)
          setActiveId(null)
        }}
        items={[
          { value: 'pending', label: '待复核', count: pending?.length },
          { value: 'done', label: '已复核', count: done?.length },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card title={tab === 'pending' ? '待复核列表' : '已复核列表'}>
          {!list ? (
            <Loading />
          ) : list.length === 0 ? (
            <Empty text={tab === 'pending' ? '暂无待复核的简答题' : '还没有复核记录'} />
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(r.id)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      activeId === r.id ? 'bg-navy-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800 truncate">
                        {r.student?.display_name ?? '未知学生'}
                        <span className="ml-1.5 text-xs text-gray-400 font-normal">{r.student?.class_name ?? ''}</span>
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{formatDate(r.created_at)}</span>
                    </div>
                    <div className="mt-1 text-gray-600 line-clamp-2">{r.question?.stem}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {r.ai_score != null ? `AI 评分 ${Number(r.ai_score)}` : '未经 AI 评分'}
                      {r.reviewed && r.final_score != null && ` · 终评 ${Number(r.final_score)}`}
                      {` / 满分 ${fullScoreOf(r.question ?? {})}`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {active ? (
          <ReviewPanel key={active.id} row={active} readOnly={tab === 'done'} onSubmitted={handleSubmitted} onError={setError} />
        ) : (
          <Card>
            <Empty text="从左侧选择一条记录开始复核" />
          </Card>
        )}
      </div>
    </div>
  )
}

function ReviewPanel({ row, readOnly, onSubmitted, onError }) {
  const q = row.question
  const points = Array.isArray(q?.scoring_points) ? q.scoring_points : []
  const pointScores = Array.isArray(q?.point_scores) ? q.point_scores : []
  const full = fullScoreOf(q ?? {})

  // 初始：已复核用保存的 point_hits；否则用 AI 判定；再否则全部未命中
  const [hits, setHits] = useState(() =>
    points.map((p, i) => {
      const saved = row.point_hits?.[i]
      return {
        point: p,
        max: Number(pointScores[i] ?? 0),
        hit: saved?.hit ?? false,
        score: saved?.score != null ? Number(saved.score) : saved?.hit ? Number(pointScores[i] ?? 0) : 0,
      }
    }),
  )
  const [feedback, setFeedback] = useState(row.ai_feedback ?? '')
  const [manualTotal, setManualTotal] = useState(row.final_score != null ? String(Number(row.final_score)) : '')
  const [saving, setSaving] = useState(false)

  const pointTotal = hits.reduce((s, h) => s + Number(h.score || 0), 0)
  const finalScore = manualTotal !== '' ? Number(manualTotal) : pointTotal

  function toggleHit(i) {
    setHits((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, hit: !h.hit, score: !h.hit ? h.max : 0 } : h)),
    )
    setManualTotal('')
  }

  function setPointScore(i, v) {
    const n = Math.max(0, Math.min(hits[i].max, Number(v) || 0))
    setHits((prev) => prev.map((h, idx) => (idx === i ? { ...h, score: n, hit: n > 0 } : h)))
    setManualTotal('')
  }

  async function submit() {
    if (finalScore < 0 || finalScore > full) return onError(`总分需在 0 到 ${full} 之间`)
    setSaving(true)
    try {
      const saved = await submitReview(row.id, {
        final_score: finalScore,
        ai_feedback: feedback.trim() || null,
        point_hits: hits.map((h) => ({ point: h.point, hit: h.hit, score: h.score })),
      })
      onSubmitted(saved)
    } catch (err) {
      onError(zhError(err, '提交复核失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title={`${row.student?.display_name ?? '学生'}${row.student?.student_no ? ` · ${row.student.student_no}` : ''}${
        row.student?.class_name ? ` · ${row.student.class_name}` : ''
      }`}
      extra={<span className="text-xs text-gray-500">提交于 {formatDate(row.created_at, true)}</span>}
    >
      <div className="p-4 space-y-5 text-sm">
        <section>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1.5">
            <span className="rounded bg-gray-100 px-1.5 py-0.5">简答</span>
            <span>难度 · {DIFFICULTY_LABEL[q?.difficulty] ?? ''}</span>
            {q?.knowledge_point && <span>{q.knowledge_point.name}</span>}
            <span className="ml-auto">满分 {full} 分</span>
          </div>
          <p className="text-gray-800 whitespace-pre-wrap">{q?.stem}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-teacher bg-gray-50 border border-gray-100 p-3">
            <div className="text-xs font-medium text-gray-500 mb-1">学生作答</div>
            <p className="text-gray-800 whitespace-pre-wrap">{String(row.student_answer ?? '')}</p>
          </div>
          <div className="rounded-teacher bg-navy-50/50 border border-navy-100 p-3">
            <div className="text-xs font-medium text-gray-500 mb-1">参考答案</div>
            <p className="text-gray-800 whitespace-pre-wrap">{q?.reference_answer ?? '—'}</p>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-800">逐点判定</h3>
            {row.ai_score != null && (
              <span className="text-xs text-gray-500">
                AI 评分 {Number(row.ai_score)} 分
                {row.ai_feedback && !readOnly && '（AI 评语已填入下方，可修改）'}
              </span>
            )}
          </div>
          {points.length === 0 ? (
            <p className="text-xs text-gray-400">该题未设置得分点，请直接填写总分。</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-teacher">
              {hits.map((h, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={h.hit}
                    disabled={readOnly}
                    onChange={() => toggleHit(i)}
                    className="accent-navy-600"
                  />
                  <span className={`flex-1 ${h.hit ? 'text-gray-800' : 'text-gray-500'}`}>{h.point}</span>
                  <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={h.max}
                      step={0.5}
                      disabled={readOnly}
                      value={h.score}
                      onChange={(e) => setPointScore(i, e.target.value)}
                      className={`${inputClass} w-16 py-1 text-right`}
                    />
                    / {h.max} 分
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-[1fr_200px]">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">评语（学生可见）</span>
            <textarea
              rows={3}
              disabled={readOnly}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="请输入评语，例如：引申路径分析准确，但未指出④为引申义"
              className={`${inputClass} w-full mt-1 resize-y`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">最终得分</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={full}
                step={0.5}
                disabled={readOnly}
                value={manualTotal !== '' ? manualTotal : pointTotal}
                onChange={(e) => setManualTotal(e.target.value)}
                className={`${inputClass} w-24 text-right text-lg font-semibold`}
              />
              <span className="text-gray-500">/ {full} 分</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">默认为各得分点之和，可直接修改</p>
          </label>
        </section>

        {!readOnly && (
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button disabled={saving} onClick={submit}>
              {saving ? '提交中…' : '提交复核'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
