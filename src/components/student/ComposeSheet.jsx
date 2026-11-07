import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  countPracticeQuestions,
  createPracticeSession,
  drawPracticeQuestions,
} from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.js'
import { DIFFICULTIES, QUESTION_TYPES, QUESTION_TYPE_LABEL } from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'

const COUNTS = [5, 10, 20]
const DESKTOP = '(min-width: 1024px)'

function defaultCount(total) {
  if (total >= 10) return 10
  return [...COUNTS].reverse().find((n) => n <= total) ?? total
}

function useDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches)
  useEffect(() => {
    const media = window.matchMedia(DESKTOP)
    const update = () => setDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return desktop
}

export default function ComposeSheet({ point, onClose }) {
  const desktop = useDesktop()
  const drag = useDragControls()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [types, setTypes] = useState(() => new Set())
  const [difficulties, setDifficulties] = useState(() => new Set())
  const [advanced, setAdvanced] = useState(false)
  const [count, setCount] = useState(() => defaultCount(point.total))
  const [bankTotal, setBankTotal] = useState(point.total)
  const [available, setAvailable] = useState(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const dialogRef = useRef(null)
  const touched = useRef(false)
  dialogRef.current = dialog

  const filterKey = JSON.stringify({
    knowledgePointIds: [point.id],
    types: advanced ? [...types].sort() : [],
    difficulties: advanced ? [...difficulties].sort() : [],
  })

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event) {
      if (event.key !== 'Escape') return
      if (dialogRef.current) setDialog(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    setAdvanced(false)
    setTypes(new Set())
    setDifficulties(new Set())
    touched.current = false
  }, [point.id])

  useEffect(() => {
    let cancelled = false
    countPracticeQuestions({ knowledgePointIds: [point.id], types: [], difficulties: [] })
      .then((total) => {
        if (cancelled) return
        setBankTotal(total)
        setCount((current) => {
          if (!touched.current || current > total) return defaultCount(total)
          return current
        })
      })
      .catch((err) => {
        if (!cancelled) setError(zhError(err, '题库加载失败，请刷新重试'))
      })
    return () => {
      cancelled = true
    }
  }, [point.id])

  useEffect(() => {
    let cancelled = false
    setAvailable(null)
    countPracticeQuestions(JSON.parse(filterKey))
      .then((total) => {
        if (!cancelled) setAvailable(total)
      })
      .catch((err) => {
        if (!cancelled) setError(zhError(err, '题库加载失败，请刷新重试'))
      })
    return () => {
      cancelled = true
    }
  }, [filterKey])

  function chooseCount(n) {
    if (n > bankTotal) return
    touched.current = true
    setCount(n)
  }

  function toggle(setter, value) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function filters() {
    return JSON.parse(filterKey)
  }

  async function launch(nextFilters, n, config) {
    const drawn = await drawPracticeQuestions(nextFilters, n, null)
    if (drawn.matched !== n) {
      setStarting(false)
      if (drawn.matched === 0) setDialog({ type: 'empty' })
      else setDialog({ type: 'short', matched: drawn.matched, filters: nextFilters, config })
      return
    }
    const session = await createPracticeSession(
      user.id,
      {
        ...config,
        count: drawn.questions.length,
        knowledge_point_id: nextFilters.knowledgePointIds?.[0] ?? null,
      },
      drawn.questions.map((question) => question.id),
    )
    navigate(`/student/practice/session/${session.id}`, {
      state: { questions: drawn.questions, from: '/student' },
    })
  }

  async function start() {
    if (!user || starting || available == null) return
    setError('')
    setDialog(null)
    setStarting(true)
    const nextFilters = filters()
    try {
      const matched = await countPracticeQuestions(nextFilters)
      if (matched <= 0) {
        setDialog({ type: 'empty' })
        setStarting(false)
        return
      }
      if (matched < count) {
        setDialog({ type: 'short', matched, filters: nextFilters, config: { source: 'custom', return_to: '/student' } })
        setStarting(false)
        return
      }
      await launch(nextFilters, count, {
        source: 'custom',
        return_to: '/student',
        knowledge_points: nextFilters.knowledgePointIds,
        types: nextFilters.types,
        difficulties: nextFilters.difficulties,
      })
    } catch (err) {
      setError(zhError(err, err?.message === 'mismatch' ? '抽到的题目与条件不一致，请重试' : '创建练习失败，请稍后再试'))
      setStarting(false)
    }
  }

  async function confirmShort() {
    if (!dialog || dialog.type !== 'short' || !user) return
    const { matched, filters: nextFilters, config } = dialog
    setDialog(null)
    setStarting(true)
    try {
      await launch(nextFilters, matched, {
        ...config,
        knowledge_points: nextFilters.knowledgePointIds,
        types: nextFilters.types,
        difficulties: nextFilters.difficulties,
      })
    } catch (err) {
      setError(zhError(err, err?.message === 'mismatch' ? '抽到的题目与条件不一致，请重试' : '创建练习失败，请稍后再试'))
      setStarting(false)
    }
  }

  return (
    <>
    <motion.div
      className={`fixed inset-0 z-40 ${desktop ? 'flex items-center justify-center p-8' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        aria-label="关闭组题"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-title"
        drag={desktop ? false : 'y'}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.45 }}
        onDragEnd={(_, info) => {
          if (!desktop && (info.offset.y > 90 || info.velocity.y > 700)) onClose()
        }}
        initial={desktop ? { y: 18, scale: 0.96 } : { y: '100%' }}
        animate={desktop ? { y: 0, scale: 1 } : { y: 0 }}
        exit={desktop ? { y: 12, scale: 0.98, opacity: 0 } : { y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className={
          desktop
            ? 'relative z-10 flex max-h-[min(36rem,calc(100vh-4rem))] w-full max-w-md flex-col overflow-hidden rounded-xl bg-gradient-to-b from-cream-50 to-white shadow-lg ring-1 ring-lavender-100'
            : 'absolute inset-x-0 bottom-0 z-10 flex max-h-[88vh] flex-col overflow-hidden rounded-t-[1.5rem] bg-gradient-to-b from-cream-50 to-white shadow-lg ring-1 ring-lavender-100'
        }
      >
        {!desktop && (
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
            onPointerDown={(event) => drag.start(event)}
          >
            <span className="h-1.5 w-12 rounded-full bg-lavender-300" />
          </div>
        )}

        <header className="flex items-start justify-between gap-3 px-5 pb-1 pt-2 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <h2 id="compose-title" className="truncate text-lg font-bold text-gray-800">
              {point.name}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              共 <span className="text-2xl font-bold text-coral-500">{bankTotal}</span> 题
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-sm text-gray-400 hover:bg-white hover:text-coral-500"
          >
            关闭
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4 sm:px-6">
          <div className="grid grid-cols-3 gap-3">
            {COUNTS.map((n) => {
              const disabled = n > bankTotal
              const on = !disabled && count === n
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => chooseCount(n)}
                  className={`min-h-14 rounded-xl text-base font-semibold transition-colors ${
                    disabled
                      ? 'cursor-not-allowed bg-gray-100 text-gray-300 opacity-40'
                      : on
                        ? 'bg-lavender-500 text-white shadow-lg shadow-lavender-100'
                        : 'bg-white text-gray-600 ring-1 ring-lavender-100 hover:bg-lavender-50'
                  }`}
                >
                  {n}题
                </button>
              )
            })}
          </div>

          <div className="rounded-xl bg-white/70 ring-1 ring-lavender-100">
            <button
              type="button"
              aria-expanded={advanced}
              onClick={() => setAdvanced((open) => !open)}
              className="flex min-h-12 w-full items-center justify-between px-4 text-sm font-medium text-gray-600"
            >
              <span>{advanced ? '收起高级设置' : '展开高级设置（可选）'}</span>
              <motion.span aria-hidden="true" animate={{ rotate: advanced ? 180 : 0 }} className="text-lavender-400">
                ▾
              </motion.span>
            </button>
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
                  <div className="space-y-4 px-4 pb-4">
                    <FilterGroup title="题型">
                      {QUESTION_TYPES.map((type) => (
                        <Choice key={type} on={types.has(type)} onClick={() => toggle(setTypes, type)}>
                          {QUESTION_TYPE_LABEL[type] ?? type}
                        </Choice>
                      ))}
                    </FilterGroup>
                    <FilterGroup title="难度">
                      {DIFFICULTIES.map((item) => (
                        <Choice
                          key={item.value}
                          on={difficulties.has(item.value)}
                          onClick={() => toggle(setDifficulties, item.value)}
                        >
                          {item.label}
                        </Choice>
                      ))}
                    </FilterGroup>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <p className="rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-600 ring-1 ring-coral-100">
              {error}
            </p>
          )}
        </div>

        <footer className="shrink-0 bg-white/80 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <motion.button
            type="button"
            disabled={starting || available == null}
            onClick={start}
            whileTap={{ scale: 0.98 }}
            className="flex min-h-14 w-full items-center justify-center rounded-full bg-mint-500 px-6 text-lg font-bold text-white shadow-lg shadow-mint-100 hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? '正在核对…' : '开始做题'}
          </motion.button>
        </footer>
      </motion.div>

    </motion.div>
    {createPortal(
      <AnimatePresence>
        {dialog && (
          <CountNotice
            dialog={dialog}
            onClose={() => setDialog(null)}
            onConfirm={confirmShort}
          />
        )}
      </AnimatePresence>,
      document.body,
    )}
    </>
  )
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-600">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Choice({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm ring-1 transition-colors ${
        on
          ? 'bg-lavender-500 text-white ring-lavender-500'
          : 'bg-white text-gray-600 ring-lavender-100 hover:bg-lavender-50'
      }`}
    >
      {children}
    </button>
  )
}

function CountNotice({ dialog, onClose, onConfirm }) {
  const short = dialog.type === 'short'
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="关闭提示" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ y: 12, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-lg ring-1 ring-lavender-100"
      >
        <p className="text-base font-semibold leading-relaxed text-gray-800">
          {short
            ? `当前知识点仅有 ${dialog.matched} 题，已为您全部抽取，是否继续？`
            : '抱歉，当前筛选条件下暂无题目，请尝试调整条件。'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          {short ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-10 rounded-full px-4 text-sm text-gray-500 hover:bg-gray-50"
              >
                再看看
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="min-h-10 rounded-full bg-coral-500 px-4 text-sm font-semibold text-white hover:bg-coral-600"
              >
                继续
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-full bg-lavender-500 px-4 text-sm font-semibold text-white hover:bg-lavender-600"
            >
              知道了
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
