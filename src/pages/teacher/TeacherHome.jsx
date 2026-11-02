import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AnswerDetails from '../../components/teacher/AnswerDetails.jsx'
import { Button, Card, Empty, Loading, Notice, PageHeader, Table } from '../../components/teacher/ui.jsx'
import { useKnowledgeTree } from '../../hooks/useKnowledgeTree.js'
import { usePaperCart } from '../../hooks/usePaperCart.js'
import { fetchDashboard } from '../../lib/api.js'
import { CHAPTERS, DIFFICULTY_LABEL } from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'

const TOP_N = 10

export default function TeacherHome() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const { tree } = useKnowledgeTree()
  const cart = usePaperCart()
  const [flash, setFlash] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchDashboard()
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(zhError(err, '看板数据加载失败')))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(''), 2000)
    return () => clearTimeout(t)
  }, [flash])

  const kpName = useMemo(() => {
    const m = {}
    for (const ch of tree ?? []) {
      m[ch.id] = ch.name
      for (const kp of ch.children) m[kp.id] = `${ch.name} · ${kp.name}`
    }
    return m
  }, [tree])

  const topWrong = useMemo(
    () =>
      (data?.errorStats ?? [])
        .filter((r) => r.wrong_count > 0)
        .sort((a, b) => b.wrong_count - a.wrong_count || b.error_rate - a.error_rate)
        .slice(0, TOP_N),
    [data],
  )

  function addToCart(r) {
    const ok = cart.add({ question_id: r.question_id, stem: r.stem, type: r.type, difficulty: r.difficulty })
    setFlash(ok ? '已加入试卷待选' : '该题已在待选列表中')
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="数据看板" />
        <Notice tone="error">{error}</Notice>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="数据看板" desc="学生练习数据汇总，用于发现薄弱点并指导组卷">
        {cart.items.length > 0 && (
          <Link
            to="/teacher/papers"
            className="rounded-teacher bg-navy-700 text-white text-sm px-4 py-2 hover:bg-navy-800"
          >
            试卷待选 {cart.items.length} 题 →
          </Link>
        )}
      </PageHeader>

      <Notice tone="success">{flash}</Notice>

      {/* KPI */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="学生人数" value={data?.studentCount} />
        <Kpi label="练习次数" value={data?.sessionCount} />
        <Kpi label="作答总数" value={data?.answerCount} />
        <Kpi label="总体正确率" value={data?.accuracy != null ? `${data.accuracy}%` : '—'} />
      </div>

      <AnswerDetails answerCount={data?.answerCount} accuracy={data?.accuracy} sessionCount={data?.sessionCount} />

      {/* 热力图 */}
      <Card title="知识点掌握度热力图" extra={<Legend />}>
        {!data || !tree ? <Loading /> : <Heatmap tree={tree} mastery={data.mastery} />}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        {/* 高频错题榜 */}
        <Card title={`高频错题榜（前 ${TOP_N}）`}>
          {!data ? (
            <Loading />
          ) : topWrong.length === 0 ? (
            <Empty text="暂无作答数据" />
          ) : (
            <Table
              head={[
                { label: '#', className: 'w-10' },
                { label: '题目' },
                { label: '题型', className: 'w-16' },
                { label: '难度', className: 'w-16' },
                { label: '错 / 答', className: 'w-20 text-right' },
                { label: '错误率', className: 'w-20 text-right' },
                { label: '', className: 'w-24' },
              ]}
            >
              {topWrong.map((r, i) => (
                <tr key={r.question_id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-gray-800 line-clamp-2">{r.stem}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{kpName[r.knowledge_point_id] ?? ''}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{r.type}</td>
                  <td className="px-4 py-2.5 text-gray-600">{DIFFICULTY_LABEL[r.difficulty]}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {r.wrong_count} / {r.attempts}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <RateBadge rate={Number(r.error_rate)} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant={cart.has(r.question_id) ? 'secondary' : 'primary'}
                      disabled={cart.has(r.question_id)}
                      onClick={() => addToCart(r)}
                    >
                      {cart.has(r.question_id) ? '已加入' : '加入试卷'}
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {/* 检索排行 */}
        <Card title="资料检索排行">
          {!data ? (
            <Loading />
          ) : data.materialRank.length === 0 ? (
            <Empty text="还没有上传资料" />
          ) : (
            <Table
              head={[
                { label: '#', className: 'w-10' },
                { label: '资料' },
                { label: '查看次数', className: 'w-24 text-right' },
                { label: '人数', className: 'w-16 text-right' },
              ]}
            >
              {data.materialRank.slice(0, TOP_N).map((m, i) => (
                <tr key={m.material_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-gray-800 truncate">{m.title}</div>
                    <div className="text-xs text-gray-400">{m.category}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{m.view_count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{m.unique_viewers}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-teacher bg-white border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-navy-700 tabular-nums">{value ?? '—'}</div>
    </div>
  )
}

function RateBadge({ rate }) {
  const pct = Math.round(rate * 100)
  const cls = pct >= 60 ? 'bg-red-50 text-red-600' : pct >= 30 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{pct}%</span>
}

/** 掌握度 → 颜色：无数据灰；低红、中黄、高绿 */
function masteryColor(m, attempts) {
  if (m == null || !attempts) return 'bg-gray-100 text-gray-400'
  if (m >= 0.8) return 'bg-emerald-500 text-white'
  if (m >= 0.6) return 'bg-emerald-300 text-emerald-900'
  if (m >= 0.4) return 'bg-amber-300 text-amber-900'
  return 'bg-red-400 text-white'
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="h-3 w-3 rounded-sm bg-red-400" /> &lt;40%
      <span className="h-3 w-3 rounded-sm bg-amber-300 ml-1" /> 40–60%
      <span className="h-3 w-3 rounded-sm bg-emerald-300 ml-1" /> 60–80%
      <span className="h-3 w-3 rounded-sm bg-emerald-500 ml-1" /> ≥80%
      <span className="h-3 w-3 rounded-sm bg-gray-100 ml-1" /> 无数据
    </div>
  )
}

function Heatmap({ tree, mastery }) {
  const byId = Object.fromEntries(mastery.map((m) => [m.knowledge_point_id, m]))
  const ordered = [...tree].sort((a, b) => CHAPTERS.indexOf(a.name) - CHAPTERS.indexOf(b.name))
  return (
    <div className="p-4 space-y-3">
      {ordered.map((ch) => {
        const chStat = byId[ch.id]
        return (
          <div key={ch.id} className="grid grid-cols-[88px_1fr] gap-3 items-start">
            <div className="pt-1.5">
              <div className="text-sm font-medium text-gray-800">{ch.name}</div>
              <div className="text-xs text-gray-400">
                {chStat?.mastery != null ? `${Math.round(chStat.mastery * 100)}%` : '—'} · {chStat?.attempts ?? 0} 答
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ch.children.map((kp) => {
                const s = byId[kp.id]
                const pct = s?.mastery != null ? Math.round(s.mastery * 100) : null
                return (
                  <div
                    key={kp.id}
                    title={`${kp.name}：${pct != null ? `${pct}% 掌握，${s.attempts} 次作答` : '暂无作答'}`}
                    className={`rounded px-2.5 py-1.5 text-xs leading-tight min-w-[96px] ${masteryColor(s?.mastery, s?.attempts)}`}
                  >
                    <div className="truncate max-w-[140px]">{kp.name}</div>
                    <div className="opacity-80 tabular-nums">{pct != null ? `${pct}%` : '—'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
