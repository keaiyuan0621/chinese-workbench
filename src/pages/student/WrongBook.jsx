import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createPracticeSession,
  fetchChapterByKnowledgePoint,
  fetchMaterialsForKnowledgePoints,
  fetchWrongBook,
  getMaterialUrl,
  logMaterialView,
  setWrongMastered,
} from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.js'
import { CHAPTERS, DIFFICULTY_LABEL, QUESTION_TYPE_LABEL } from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'
import { formatAnswer, isObjective, shuffle } from '../../lib/practice.js'

const RETRY_LIMIT = 20

const TIME_RANGES = [
  { id: 'all', label: '全部时间', days: null },
  { id: 'week', label: '近一周', days: 7 },
  { id: 'month', label: '近一个月', days: 30 },
  { id: 'quarter', label: '近三个月', days: 90 },
]

function sinceForRange(id) {
  const range = TIME_RANGES.find((item) => item.id === id)
  if (!range?.days) return null
  return new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString()
}

export default function WrongBook() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [items, setItems] = useState(null)
  const [chapterOf, setChapterOf] = useState({})
  const [materialsByKp, setMaterialsByKp] = useState({})
  const [error, setError] = useState('')
  const [tab, setTab] = useState('open') // open | mastered
  const [chapter, setChapter] = useState('全部')
  const [timeRange, setTimeRange] = useState('all')
  const [chapterOpen, setChapterOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [newestFirst, setNewestFirst] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [retrying, setRetrying] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [rows, chapters] = await Promise.all([
        fetchWrongBook(user.id, { since: sinceForRange(timeRange) }),
        fetchChapterByKnowledgePoint(),
      ])
      const valid = rows.filter((r) => r.question)
      setItems(valid)
      setChapterOf(chapters)

      const kpIds = valid.flatMap((r) => [
        r.question.knowledge_point_id,
        r.question.knowledge_point?.parent_id,
      ])
      const mats = await fetchMaterialsForKnowledgePoints(kpIds)
      const map = {}
      for (const m of mats) (map[m.knowledge_point_id] ??= []).push(m)
      setMaterialsByKp(map)
    } catch (err) {
      setItems([])
      setError(zhError(err, '错题集加载失败，请刷新重试'))
    }
  }, [user, timeRange])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(t)
  }, [notice])

  const open = useMemo(() => (items ?? []).filter((r) => !r.mastered), [items])
  const mastered = useMemo(() => (items ?? []).filter((r) => r.mastered), [items])
  const inChapter = useCallback(
    (item) => chapter === '全部' || chapterOf[item.question.knowledge_point_id] === chapter,
    [chapter, chapterOf],
  )
  const statusItems = tab === 'open' ? open : mastered
  const list = useMemo(() => {
    const filtered = statusItems.filter(inChapter)
    return [...filtered].sort((a, b) => {
      const diff = new Date(a.last_wrong_at ?? 0).getTime() - new Date(b.last_wrong_at ?? 0).getTime()
      return newestFirst ? -diff : diff
    })
  }, [statusItems, inChapter, newestFirst])
  const chapterCounts = useMemo(() => {
    const counts = { 全部: statusItems.length }
    for (const name of CHAPTERS) counts[name] = 0
    for (const item of statusItems) {
      const name = chapterOf[item.question.knowledge_point_id]
      if (name && counts[name] != null) counts[name] += 1
    }
    return counts
  }, [statusItems, chapterOf])

  async function toggleMastered(item) {
    setBusyId(item.id)
    try {
      await setWrongMastered(item.id, !item.mastered)
      setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, mastered: !r.mastered } : r)))
      setNotice(item.mastered ? '已移回待巩固' : '已标记为掌握 🎉')
    } catch (err) {
      setNotice(zhError(err, '操作失败，请重试'))
    } finally {
      setBusyId(null)
    }
  }

  async function retryAll() {
    if (!user || !open.length) return
    setRetrying(true)
    try {
      const picked = shuffle(open).slice(0, RETRY_LIMIT)
      const ids = picked.map((r) => r.question_id)
      const s = await createPracticeSession(
        user.id,
        { source: 'wrong_book', return_to: '/student/wrong-book', count: ids.length },
        ids,
      )
      navigate(`/student/practice/session/${s.id}`, {
        state: {
          questions: picked.map((r) => r.question).filter((q) => q?.id && q.stem),
          from: '/student/wrong-book',
        },
      })
    } catch (err) {
      setNotice(zhError(err, '创建练习失败，请稍后再试'))
      setRetrying(false)
    }
  }

  async function openMaterial(m) {
    // 先开窗口再填地址，避免被浏览器拦截弹窗
    const w = window.open('', '_blank')
    try {
      const url = await getMaterialUrl(m.file_url)
      if (w) w.location.href = url
      logMaterialView(m.id, user.id)
    } catch (err) {
      w?.close()
      setNotice(zhError(err, '资料打开失败，请稍后再试'))
    }
  }

  function relatedMaterials(q) {
    const own = materialsByKp[q.knowledge_point_id] ?? []
    const chapter = q.knowledge_point?.parent_id ? materialsByKp[q.knowledge_point.parent_id] ?? [] : []
    return [...own, ...chapter]
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-ink">我的错题</h1>
          <p className="mt-1 text-sm text-gray-500">答错的题会自动收进来，弄懂了就标记掌握吧</p>
        </div>
        <motion.button
          type="button"
          onClick={retryAll}
          disabled={retrying || open.length === 0}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex min-h-11 items-center rounded-full bg-mint-500 text-white font-semibold px-6 py-2.5 shadow-md shadow-mint-100 hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retrying
            ? '正在生成…'
            : `一键重练${open.length ? `（${Math.min(open.length, RETRY_LIMIT)} 题）` : ''}`}
        </motion.button>
      </header>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full bg-gray-100 p-1">
            <StatusTab on={tab === 'open'} tone="open" onClick={() => setTab('open')}>
              待巩固 {open.filter(inChapter).length}
            </StatusTab>
            <StatusTab on={tab === 'mastered'} tone="done" onClick={() => setTab('mastered')}>
              已掌握 {mastered.filter(inChapter).length}
            </StatusTab>
          </div>
          <button
            type="button"
            aria-pressed={newestFirst}
            onClick={() => setNewestFirst((prev) => !prev)}
            className="inline-flex min-h-10 items-center rounded-full bg-cream-100 px-4 text-sm font-medium text-cream-800 ring-1 ring-cream-300 hover:bg-cream-300"
          >
            {newestFirst ? '最近错题优先' : '最早错题优先'}
          </button>
        </div>
        <FilterFold
          title="章节"
          summary={`${chapter} ${chapterCounts[chapter] ?? 0}`}
          open={chapterOpen}
          onToggle={() => setChapterOpen((prev) => !prev)}
        >
          {['全部', ...CHAPTERS].map((name) => (
            <FilterChip key={name} on={chapter === name} onClick={() => setChapter(name)}>
              {name} {chapterCounts[name] ?? 0}
            </FilterChip>
          ))}
        </FilterFold>
        <FilterFold
          title="时间范围"
          summary={TIME_RANGES.find((range) => range.id === timeRange)?.label ?? '全部时间'}
          open={timeOpen}
          onToggle={() => setTimeOpen((prev) => !prev)}
        >
          {TIME_RANGES.map((range) => (
            <FilterChip
              key={range.id}
              on={timeRange === range.id}
              onClick={() => {
                setExpanded(null)
                setTimeRange(range.id)
              }}
            >
              {range.label}
            </FilterChip>
          ))}
        </FilterFold>
      </section>

      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-student-sm bg-mint-50 text-mint-600 text-sm px-4 py-2.5 ring-1 ring-mint-100"
        >
          {notice}
        </motion.div>
      )}

      {error && (
        <div className="rounded-student bg-coral-50 text-coral-600 text-sm px-5 py-4 ring-1 ring-coral-100">
          {error}
        </div>
      )}

      {items === null && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-student bg-white/60 animate-pulse" />
          ))}
        </div>
      )}

      {items !== null && list.length === 0 && (
        <div className="rounded-student bg-white px-6 py-12 text-center ring-1 ring-gray-100">
          <div className="text-4xl">{tab === 'open' ? '🎉' : '📭'}</div>
          <p className="mt-3 text-gray-500">
            {chapter === '全部' && timeRange === 'all'
              ? tab === 'open'
                ? '太棒了，目前没有待巩固的错题'
                : '还没有标记为已掌握的题目'
              : '这个筛选条件下没有错题'}
          </p>
        </div>
      )}

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {list.map((item) => {
            const q = item.question
            const isOpen = expanded === item.id
            const mats = relatedMaterials(q)
            const objective = isObjective(q.type)
            const chapterName = chapterOf[q.knowledge_point_id]
            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-student bg-white shadow-sm ring-1 ring-cream-300 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="w-full text-left p-5"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2.5 py-1 font-semibold ${
                        objective ? 'bg-mint-100 text-mint-600' : 'bg-coral-100 text-coral-600'
                      }`}
                    >
                      {objective ? '客观题' : '主观题'}
                    </span>
                    <span className="rounded-full bg-lavender-100 px-2.5 py-1 font-medium text-lavender-600">
                      {QUESTION_TYPE_LABEL[q.type] ?? q.type}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">
                      难度 · {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}
                    </span>
                    {chapterName && <span className="text-gray-400">{chapterName}</span>}
                    {q.knowledge_point && <span className="text-gray-400">{q.knowledge_point.name}</span>}
                    <span className="ml-auto text-gray-400">
                      {formatWrongTime(item.last_wrong_at)} · 错了 {item.wrong_count} 次
                    </span>
                  </div>
                  <p className={isOpen ? 'whitespace-pre-wrap text-gray-800' : 'line-clamp-3 text-gray-800'}>{q.stem}</p>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border-t border-gray-100"
                    >
                      <div className="p-5 space-y-3 text-sm bg-cream-50/50">
                        {Array.isArray(q.options) && q.options.length > 0 && (
                          <ul className="space-y-1 text-gray-700">
                            {q.options.map((o) => (
                              <li key={o.key}>
                                <span className="font-semibold mr-1.5">{o.key}.</span>
                                {o.text}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-gray-800">
                          <span className="font-semibold">参考答案：</span>
                          {formatAnswer(q)}
                        </p>
                        {q.explanation && (
                          <div>
                            <div className="font-semibold text-gray-700 mb-1">解析</div>
                            <p className="text-gray-700 whitespace-pre-wrap">{q.explanation}</p>
                          </div>
                        )}

                        {mats.length > 0 && (
                          <div>
                            <div className="font-semibold text-gray-700 mb-1.5">相关资料</div>
                            <div className="flex flex-wrap gap-2">
                              {mats.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => openMaterial(m)}
                                  className="rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-100 px-3 py-1.5 text-xs hover:bg-sky-100"
                                >
                                  📎 查看相关资料：{m.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => toggleMastered(item)}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                              item.mastered
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-mint-400 text-white hover:bg-mint-500'
                            }`}
                          >
                            {item.mastered ? '移回待巩固' : '我已掌握 ✓'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}

function formatWrongTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hours}:${minutes}`
}

function FilterFold({ title, summary, open, onToggle, children }) {
  return (
    <div className="rounded-lg border-[0.5px] border-gold bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left"
      >
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-lavender-500">
          {summary}
          <motion.span aria-hidden="true" animate={{ rotate: open ? 180 : 0 }} className="text-lavender-400">
            ▾
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 px-4 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FilterChip({ on, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm transition-colors ${
        on ? 'bg-lavender-500 font-semibold text-white' : 'bg-lavender-50 text-gray-600 hover:bg-lavender-100'
      }`}
    >
      {children}
    </button>
  )
}

function StatusTab({ on, tone, onClick, children }) {
  const active = tone === 'done' ? 'bg-mint-500 text-white' : 'bg-coral-500 text-white'
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
        on ? active : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}
