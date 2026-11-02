import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useKnowledgeTree } from '../../hooks/useKnowledgeTree.js'
import { countPracticeQuestions, createPracticeSession, drawPracticeQuestions } from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.js'
import {
  CHAPTERS,
  CHAPTER_THEME,
  DIFFICULTIES,
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  QUICK_TEMPLATES,
} from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'

const COUNTS = [5, 10, 20]
const TABS = ['全部', ...CHAPTERS]
const SELECTED_CHIP = {
  语音: 'bg-coral-100 text-coral-600 ring-coral-300',
  汉字: 'bg-cream-100 text-cream-800 ring-cream-400',
  词汇: 'bg-mint-100 text-mint-600 ring-mint-300',
  语法: 'bg-lavender-100 text-lavender-600 ring-lavender-300',
  修辞: 'bg-sky-100 text-sky-700 ring-sky-200',
}

function chapterGroups(chapter, counts) {
  const groups = []
  for (const section of chapter.children ?? []) {
    const children = section.children ?? []
    const chips = []
    if ((counts[section.id] ?? 0) > 0) {
      chips.push({
        id: section.id,
        name: children.length ? '综合' : section.name,
        chapter: chapter.name,
      })
    }
    for (const child of children) {
      chips.push({ id: child.id, name: child.name, chapter: chapter.name })
    }
    if (chips.length) groups.push({ id: section.id, name: section.name, chips })
  }
  return groups
}

export default function StudentPractice() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const { tree, counts, error: treeError } = useKnowledgeTree()

  const [tab, setTab] = useState('语音')
  const [picked, setPicked] = useState(() => new Set())
  const [advanced, setAdvanced] = useState(true)
  const [types, setTypes] = useState(() => new Set())
  const [difficulties, setDifficulties] = useState(() => new Set())
  const [count, setCount] = useState(null)
  const [available, setAvailable] = useState(null)
  const [counting, setCounting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const templateStarted = useRef(false)

  const templateParam = params.get('template')

  const filterKey = JSON.stringify({
    knowledgePointIds: [...picked].sort(),
    types: advanced ? [...types].sort() : [],
    difficulties: advanced ? [...difficulties].sort() : [],
  })

  useEffect(() => {
    const filters = JSON.parse(filterKey)
    let cancelled = false
    setCounting(true)
    countPracticeQuestions(filters)
      .then((total) => {
        if (!cancelled) setAvailable(total)
      })
      .catch((err) => {
        if (!cancelled) setError(zhError(err, '题库加载失败，请刷新重试'))
      })
      .finally(() => {
        if (!cancelled) setCounting(false)
      })
    return () => {
      cancelled = true
    }
  }, [filterKey])

  useEffect(() => {
    if (!templateParam || !user || templateStarted.current) return
    const template = QUICK_TEMPLATES.find((item) => item.id === templateParam)
    if (!template) return
    templateStarted.current = true
    startTemplate(template)
    // 只在带着快捷模板进来时自动开卷
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateParam, user])

  const groups = useMemo(() => {
    if (!tree) return []
    const chapters = tab === '全部' ? tree : tree.filter((item) => item.name === tab)
    return chapters.map((chapter) => ({
      id: chapter.id,
      name: chapter.name,
      sections: chapterGroups(chapter, counts),
    }))
  }, [tree, tab, counts])

  function toggleChip(id) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleValue(setter, value) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  async function launch(filters, n, config) {
    const drawn = await drawPracticeQuestions(filters, n, config.ratio ?? null)
    if (drawn.matched !== n) {
      setStarting(false)
      if (drawn.matched === 0) setDialog({ type: 'empty' })
      else setDialog({ type: 'short', matched: drawn.matched, filters, config })
      return
    }
    const session = await createPracticeSession(
      user.id,
      { ...config, count: drawn.questions.length },
      drawn.questions.map((question) => question.id),
    )
    navigate(`/student/practice/session/${session.id}`, {
      state: { questions: drawn.questions, from: '/student/practice' },
    })
  }

  async function startTemplate(template) {
    if (!user || starting) return
    setError('')
    setStarting(true)
    const filters = { knowledgePointIds: [], types: [], difficulties: [] }
    try {
      await launch(filters, template.count, {
        source: 'template',
        return_to: '/student/practice',
        template: template.id,
        ratio: template.ratio,
      })
    } catch (err) {
      setError(zhError(err, '创建练习失败，请稍后再试'))
      setStarting(false)
    }
  }

  async function generate(nextCount = count) {
    if (!user || starting) return
    setError('')
    if (nextCount == null) {
      setDialog({ type: 'need-count' })
      return
    }
    const filters = JSON.parse(filterKey)
    if (!counting && available === 0) {
      setDialog({ type: 'empty' })
      return
    }
    setStarting(true)
    try {
      if (available != null && available < nextCount) {
        setDialog({ type: 'short', matched: available, filters, config: { source: 'custom', return_to: '/student/practice' } })
        setStarting(false)
        return
      }
      await launch(filters, nextCount, {
        source: 'custom',
        return_to: '/student/practice',
        knowledge_points: filters.knowledgePointIds,
        types: filters.types,
        difficulties: filters.difficulties,
      })
    } catch (err) {
      setError(zhError(err, '创建练习失败，请稍后再试'))
      setStarting(false)
    }
  }

  async function confirmShort() {
    if (!dialog || dialog.type !== 'short' || !user) return
    const { matched, filters, config } = dialog
    setDialog(null)
    setStarting(true)
    try {
      await launch(filters, matched, config)
    } catch (err) {
      setError(zhError(err, '创建练习失败，请稍后再试'))
      setStarting(false)
    }
  }

  const matchedLabel = available == null ? '…' : String(available)

  if (templateParam) {
    return (
      <div className="rounded-student bg-white px-6 py-16 text-center shadow-sm ring-1 ring-lavender-100">
        <p className="text-lg font-semibold text-gray-700">{error || '正在准备试卷…'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-28">
      <header>
        <h1 className="text-3xl text-ink">自由组卷</h1>
      </header>

      {(error || treeError) && (
        <div className="rounded-student bg-coral-50 px-5 py-4 text-sm text-coral-600 ring-1 ring-coral-100">
          {error || treeError}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div
          data-tab-scroller
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((name) => {
            const on = tab === name
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(name)}
                className={`shrink-0 rounded-full px-5 py-2.5 text-lg transition-colors ${
                  on ? 'bg-coral-100 font-semibold text-coral-600' : 'bg-transparent font-medium text-gray-500'
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          aria-expanded={advanced}
          onClick={() => setAdvanced((open) => !open)}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-base font-medium ${
            advanced ? 'bg-lavender-100 text-lavender-600' : 'text-gray-500'
          }`}
        >
          <FunnelIcon />
          {advanced ? '收起筛选' : '高级筛选'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {advanced && (
          <motion.div
            key="advanced"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 rounded-student bg-white px-4 py-4 ring-1 ring-lavender-100">
              <FilterRow title="题型">
                {QUESTION_TYPES.map((type) => (
                  <Choice key={type} on={types.has(type)} onClick={() => toggleValue(setTypes, type)}>
                    {QUESTION_TYPE_LABEL[type] ?? type}
                  </Choice>
                ))}
              </FilterRow>
              <FilterRow title="难度">
                {DIFFICULTIES.map((item) => (
                  <Choice
                    key={item.value}
                    on={difficulties.has(item.value)}
                    onClick={() => toggleValue(setDifficulties, item.value)}
                  >
                    {item.label}
                  </Choice>
                ))}
              </FilterRow>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <ChapterBoard groups={groups} showChapter={tab === '全部'} picked={picked} onPick={toggleChip} />
        </motion.div>
      </AnimatePresence>

      {createPortal(
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-lavender-100 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(155,123,255,0.12)] backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <p className="min-w-0 flex-1 text-base leading-snug text-gray-600">
              {picked.size === 0 ? '全部题库，匹配 ' : `已选 ${picked.size} 个知识点，匹配 `}
              <span className="relative inline-flex h-8 min-w-8 items-center overflow-hidden align-bottom">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={matchedLabel}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                        className="text-2xl font-bold text-lavender-500"
                  >
                    {counting && available == null ? '…' : matchedLabel}
                  </motion.span>
                </AnimatePresence>
              </span>
              {' 道题'}
            </p>
            <motion.button
              type="button"
              onClick={() => generate()}
              disabled={starting}
              whileTap={{ scale: 0.95 }}
              className="inline-flex min-h-16 shrink-0 items-center justify-center rounded-full bg-mint-500 px-6 text-lg font-bold text-white shadow-lg shadow-mint-100 hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-50 sm:px-8 sm:text-xl"
            >
              {starting ? '正在生成…' : '生成专属试卷'}
            </motion.button>
          </div>
        </div>,
        document.body,
      )}

      <AnimatePresence>
        {dialog && (
          <GentleDialog
            dialog={dialog}
            onClose={() => setDialog(null)}
            onConfirm={confirmShort}
            onPickCount={(n) => {
              setCount(n)
              setDialog(null)
              generate(n)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ChapterBoard({ groups, showChapter, picked, onPick }) {
  const sections = groups.flatMap((chapter) => chapter.sections)
  if (!sections.length) {
    return <p className="px-1 py-16 text-center text-lg text-gray-400">这一章还没有可练习的知识点</p>
  }
  return (
    <div className="space-y-8">
      {groups.map((chapter) => (
        <div key={chapter.id} className="space-y-6">
          {showChapter && (
            <h2 className={`text-2xl font-bold ${CHAPTER_THEME[chapter.name]?.title ?? 'text-gray-800'}`}>
              {chapter.name}
            </h2>
          )}
          {chapter.sections.map((section) => (
            <section key={section.id}>
              <h3 className={`mb-3 text-lg font-semibold ${CHAPTER_THEME[chapter.name]?.title ?? 'text-gray-700'}`}>
                {section.name}
              </h3>
              <div className="flex flex-wrap gap-4">
                {section.chips.map((chip) => (
                  <KnowledgeChip key={chip.id} chip={chip} on={picked.has(chip.id)} onPick={onPick} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ))}
    </div>
  )
}

function KnowledgeChip({ chip, on, onPick }) {
  const theme = CHAPTER_THEME[chip.chapter] ?? CHAPTER_THEME['语法']
  return (
    <motion.button
      type="button"
      aria-pressed={on}
      onClick={() => onPick(chip.id)}
      whileTap={{ scale: 0.95 }}
      animate={{ scale: on ? 1.06 : 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-base font-medium ring-1 ${
        on ? SELECTED_CHIP[chip.chapter] ?? SELECTED_CHIP['语法'] : theme.chip
      }`}
    >
      {chip.name}
    </motion.button>
  )
}

function FunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 5h16l-6 7.2V19l-4 2v-8.8L4 5z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function FilterRow({ title, children }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-base font-semibold text-gray-500">{title}</span>
      {children}
    </div>
  )
}

function Choice({ on, onClick, children }) {
  return (
    <motion.button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      animate={{ scale: on ? 1.05 : 1 }}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-base font-medium ring-1 transition-colors ${
        on
          ? 'bg-lavender-100 text-lavender-600 ring-lavender-300'
          : 'bg-white text-gray-600 ring-lavender-100 hover:bg-lavender-50'
      }`}
    >
      {children}
    </motion.button>
  )
}

function GentleDialog({ dialog, onClose, onConfirm, onPickCount }) {
  const title =
    dialog.type === 'need-count'
      ? '还没选题量哦，先选这次想做几题吧。'
      : dialog.type === 'short'
        ? `当前只匹配到 ${dialog.matched} 道题，要不要就用这 ${dialog.matched} 道生成试卷？`
        : '这些条件下面暂时没有题目，换几个知识点再试试。'
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 px-4 pb-28 sm:items-center sm:pb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        className="w-full max-w-sm rounded-student bg-white p-6 shadow-xl ring-1 ring-lavender-100"
      >
        <p className="text-base font-semibold leading-relaxed text-gray-800">{title}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {dialog.type === 'need-count' &&
            COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onPickCount(n)}
                className="min-h-11 rounded-full bg-mint-500 px-4 text-sm font-semibold text-white hover:bg-mint-600"
              >
                {n}题
              </button>
            ))}
          {dialog.type === 'short' && (
            <>
              <button type="button" onClick={onClose} className="min-h-11 rounded-full px-4 text-sm text-gray-500 hover:bg-gray-50">
                再看看
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="min-h-11 rounded-full bg-mint-500 px-4 text-sm font-semibold text-white hover:bg-mint-600"
              >
                就用这些
              </button>
            </>
          )}
          {dialog.type === 'empty' && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-full bg-mint-500 px-4 text-sm font-semibold text-white hover:bg-mint-600"
            >
              知道了
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
