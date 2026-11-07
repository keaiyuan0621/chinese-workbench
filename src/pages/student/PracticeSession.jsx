import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import QuestionCard from '../../components/student/QuestionCard.jsx'
import ResultPanel from '../../components/student/ResultPanel.jsx'
import SessionReview from '../../components/student/SessionReview.jsx'
import {
  ComboBadge,
  FeedbackToast,
  PetalRain,
  ProgressBar,
} from '../../components/student/RewardEffects.jsx'
import { makePetalRain } from '../../lib/effects.js'
import {
  createPracticeSession,
  fetchPracticeSession,
  fetchQuestionsByIds,
  fetchSessionAnswers,
  finishPracticeSession,
  saveAnswer,
  updatePracticeConfig,
} from '../../lib/api.js'
import { fullScoreOf, gradeShortAnswer } from '../../lib/aiGrading.js'
import { useAuth } from '../../lib/auth-context.js'
import { zhError } from '../../lib/errors.js'
import {
  COMFORT,
  PRAISE,
  checkAnswer,
  isAnswered,
  isObjective,
  pick,
  shuffle,
  summarize,
} from '../../lib/practice.js'

function handedQuestions(state) {
  const list = state?.questions
  if (!Array.isArray(list) || !list.length) return null
  if (!list.every((q) => q?.id && q.stem)) return null
  return list
}

function returnPathOf(session, state) {
  const candidates = [state?.from, session?.config?.return_to]
  for (const path of candidates) {
    if (typeof path === 'string' && path.startsWith('/student') && !path.includes('/session/')) return path
  }
  return '/student/practice'
}

function hasUnsubmitted(question, answerValue, saved) {
  if (!question || saved?.[question.id] || answerValue == null) return false
  if (typeof answerValue === 'string') return answerValue.trim() !== ''
  if (typeof answerValue === 'boolean') return true
  if (Array.isArray(answerValue)) return answerValue.some((item) => String(item ?? '').trim() !== '')
  if (typeof answerValue === 'object') return Object.values(answerValue).some((item) => String(item ?? '').trim() !== '')
  return false
}

function sameQuestionSet(questions, ids) {
  if (!questions?.length || questions.length !== ids.length) return false
  const have = new Set(questions.map((q) => q.id))
  return ids.every((qid) => have.has(qid))
}

export default function PracticeSession() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const reviewing = searchParams.get('review') === '1'
  const { user } = useAuth()

  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState(null)
  const [answers, setAnswers] = useState({}) // { [qid]: answerRow }
  const [loadError, setLoadError] = useState('')

  const [index, setIndex] = useState(0)
  const [value, setValue] = useState(null)
  const [result, setResult] = useState(null) // { correct } 当前题提交后的结果
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [finished, setFinished] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retaking, setRetaking] = useState(false)
  const [retakeError, setRetakeError] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')

  const [combo, setCombo] = useState(0)
  const [petals, setPetals] = useState(null)
  const [toast, setToast] = useState(null)
  const cardControls = useAnimationControls()
  const toastTimer = useRef(null)
  const petalTimer = useRef(null)
  const busyRef = useRef(false)
  const retakeRef = useRef(false)
  const submitTask = useRef(null)
  const answersRef = useRef({})
  const valueRef = useRef(null)
  const leaveRef = useRef(null)

  // ---------- 加载 ----------
  // 从组题弹窗进来时，题目已经放在路由 state 里，这里直接按这个顺序渲染。
  // 只有刷新、或从错题集等没有带题目进来时，才按本次练习保存的题目编号回读。
  useEffect(() => {
    let cancelled = false
    const handed = handedQuestions(location.state)
    ;(async () => {
      try {
        const s = await fetchPracticeSession(id)
        if (!s) throw new Error('not found')
        const sessionIds = s.question_ids ?? []
        const as = await fetchSessionAnswers(s.id)
        let qs
        if (sameQuestionSet(handed, sessionIds)) {
          const byId = new Map(handed.map((q) => [q.id, q]))
          qs = sessionIds.map((qid) => byId.get(qid)).filter(Boolean)
        } else {
          const loaded = await fetchQuestionsByIds(sessionIds)
          qs = sessionIds.map((qid) => loaded.find((q) => q?.id === qid)).filter(Boolean)
        }
        if (cancelled) return
        const map = {}
        for (const a of as) map[a.question_id] = a
        const firstUnanswered = qs.findIndex((q) => !map[q.id])
        const start = Math.max(0, firstUnanswered)
        const draft = s.config?.draft
        setSession(s)
        setQuestions(qs)
        setAnswers(map)
        if (firstUnanswered === -1 && qs.length) {
          setFinished(true)
        } else {
          setIndex(start)
          if (draft && qs[start]?.id === draft.questionId && !map[draft.questionId]) {
            setValue(draft.value ?? null)
          }
        }
      } catch (err) {
        if (cancelled) return
        setLoadError(
          /not found/.test(err?.message)
            ? '找不到这次练习，可能已被删除'
            : zhError(err, '练习加载失败，请刷新重试'),
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, location.key])

  useEffect(() => () => {
    clearTimeout(toastTimer.current)
    clearTimeout(petalTimer.current)
  }, [])

  useEffect(() => {
    if (!leaveOpen) return undefined
    leaveRef.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape' && !leaving) setLeaveOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leaveOpen, leaving])

  const current = questions?.[index] ?? null
  const total = questions?.length ?? 0
  const answeredCount = Object.keys(answers).length
  answersRef.current = answers
  valueRef.current = value
  const instant = current?.type === '单选' || current?.type === '判断'

  const summary = useMemo(
    () => (questions ? summarize(questions, answers) : null),
    [questions, answers],
  )

  function showToast(kind, text) {
    clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), kind, text })
    const stay = kind === 'good' ? 1500 : 1600
    toastTimer.current = setTimeout(() => setToast(null), stay)
  }

  // ---------- 提交 ----------
  async function handleSubmit(nextValue) {
    const answer = nextValue === undefined ? valueRef.current : nextValue
    if (!current || !user || busyRef.current || result || answersRef.current[current.id]) return
    if (!isAnswered(current.type, answer, current)) {
      setSubmitError('请先完成作答再提交')
      return
    }
    const question = current
    busyRef.current = true
    setSubmitError('')
    setSubmitting(true)
    if (nextValue !== undefined) setValue(nextValue)

    const correct = checkAnswer(question, answer) // true / false / null
    const objective = isObjective(question.type)

    const task = (async () => {
      const ai = objective ? null : await gradeShortAnswer(question, answer)
      const full = objective ? null : fullScoreOf(question)
      const graded = Boolean(ai?.reviewed) && ai?.final_score != null
      const row = await saveAnswer({
        session_id: session.id,
        student_id: user.id,
        question_id: question.id,
        student_answer: answer,
        is_correct: objective ? correct : graded ? Number(ai.final_score) >= full : null,
        ai_score: ai?.ai_score ?? null,
        ai_feedback: ai?.ai_feedback ?? null,
        point_hits: ai?.point_hits ?? null,
        final_score: graded ? ai.final_score : null,
        reviewed: objective ? false : Boolean(ai?.reviewed),
        needs_review: objective ? false : !graded,
      })
      setAnswers((prev) => {
        const next = { ...prev, [question.id]: row }
        answersRef.current = next
        return next
      })
      setResult({
        correct: objective ? correct : graded ? Number(ai.final_score) >= full : null,
        score: graded ? Number(ai.final_score) : null,
        full,
        feedback: ai?.ai_feedback ?? '',
        hits: ai?.point_hits ?? null,
      })
      return { correct, objective, graded, ai, full }
    })()
    submitTask.current = task

    try {
      const saved = await task

      if (!saved.objective) {
        showToast('info', saved.graded ? `已批改：${Number(saved.ai.final_score)} 分 📝` : '已提交，等老师来批改 📝')
      } else if (saved.correct) {
        const next = combo + 1
        setCombo(next)
        showToast('good', pick(PRAISE))
        if (
          (question.type === '单选' || question.type === '判断') &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
          clearTimeout(petalTimer.current)
          setPetals(makePetalRain(80))
          petalTimer.current = setTimeout(() => setPetals(null), 4800)
        }
        cardControls.start({
          scale: [1, 1.04, 0.98, 1.01, 1],
          y: [0, -10, 4, -2, 0],
          transition: { duration: 0.55, ease: 'easeOut' },
        })
      } else {
        setCombo(0)
        showToast('soft', pick(COMFORT))
        cardControls.start({
          x: [0, -8, 8, -6, 6, -3, 3, 0],
          transition: { duration: 0.45 },
        })
      }
    } catch (err) {
      setSubmitError(zhError(err, '提交失败，请重试'))
      throw err
    } finally {
      busyRef.current = false
      setSubmitting(false)
      submitTask.current = null
    }
  }

  async function handleNext() {
    setResult(null)
    setValue(null)
    setPetals(null)
    if (index + 1 >= total) {
      try {
        await finishPracticeSession(session.id)
      } catch {
        // 结束标记失败不阻塞结算
      }
      setFinished(true)
      return
    }
    setIndex(index + 1)
  }

  function requestLeave() {
    if (answeredCount >= total) {
      handleNext()
      return
    }
    setLeaveError('')
    setLeaveOpen(true)
  }

  async function confirmLeave() {
    if (leaving) return
    setLeaving(true)
    setLeaveError('')
    const pending = submitTask.current
    try {
      if (pending) await pending
    } catch {
      setLeaveError('当前题目没有提交成功，请重试')
      setLeaving(false)
      return
    }
    try {
      const saved = answersRef.current
      const draftValue = valueRef.current
      const draft = hasUnsubmitted(current, draftValue, saved)
        ? { questionId: current.id, value: draftValue }
        : null
      const destination = returnPathOf(session, location.state)
      await updatePracticeConfig(session.id, {
        ...(session.config ?? {}),
        return_to: destination,
        draft,
        paused_at: new Date().toISOString(),
      })
      navigate(destination)
    } catch (err) {
      setLeaveError(zhError(err, '进度没有保存，请重试'))
      setLeaving(false)
    }
  }

  async function handleRetake() {
    if (!user || !session || retakeRef.current) return
    retakeRef.current = true
    const ids = Array.isArray(session.question_ids) ? session.question_ids.filter(Boolean) : []
    if (!ids.length) {
      retakeRef.current = false
      setRetakeError('这套卷子没有题目，无法重做')
      return
    }
    setRetaking(true)
    setRetakeError('')
    try {
      const byId = new Map((questions ?? []).map((question) => [question.id, question]))
      const ordered = ids.map((qid) => byId.get(qid)).filter((question) => question?.id && question.stem)
      const config = { ...(session.config ?? {}), retake_of: session.id }
      delete config.draft
      delete config.paused_at
      const created = await createPracticeSession(user.id, config, ids)
      setSession(null)
      setQuestions(null)
      setAnswers({})
      setValue(null)
      setResult(null)
      setFinished(false)
      setCombo(0)
      setIndex(0)
      setSubmitError('')
      navigate(`/student/practice/session/${created.id}`, {
        state: { questions: ordered.length === ids.length ? ordered : undefined },
      })
    } catch (err) {
      setRetakeError(zhError(err, '没能开始重做，请稍后再试'))
    } finally {
      retakeRef.current = false
      setRetaking(false)
    }
  }

  function openReview() {
    setSearchParams({ review: '1' })
  }

  function closeReview() {
    if (location.state?.from === 'history') {
      navigate('/student/wrong-book')
      return
    }
    setSearchParams({}, { replace: true })
  }

  async function handleRetry() {
    if (!user || !questions) return
    setRetrying(true)
    try {
      const ids = shuffle(questions.map((q) => q.id))
      const byId = new Map(questions.map((q) => [q.id, q]))
      const ordered = ids.map((qid) => byId.get(qid)).filter(Boolean)
      const s = await createPracticeSession(user.id, { ...session.config, retry_of: session.id }, ids)
      navigate(`/student/practice/session/${s.id}`, { replace: true, state: { questions: ordered } })
      // 路由参数变化会触发重新加载，重置本地状态
      setSession(null)
      setQuestions(null)
      setAnswers({})
      setFinished(false)
      setCombo(0)
      setIndex(0)
    } catch (err) {
      setSubmitError(zhError(err, '创建练习失败，请稍后再试'))
    } finally {
      setRetrying(false)
    }
  }

  // ---------- 渲染 ----------
  if (loadError) {
    return (
      <div className="rounded-student bg-coral-50 text-coral-600 px-6 py-8 text-center ring-1 ring-coral-100 space-y-4">
        <p>{loadError}</p>
        <Link to="/student/practice" className="inline-block rounded-full bg-white px-5 py-2 text-sm text-gray-700 ring-1 ring-gray-200">
          返回自由组卷
        </Link>
      </div>
    )
  }

  if (!questions) {
    return (
      <div className="space-y-4">
        <div className="h-3 rounded-full bg-white/60 animate-pulse" />
        <div className="h-72 rounded-student bg-white/60 animate-pulse" />
      </div>
    )
  }

  if (reviewing && questions.length) {
    return (
      <SessionReview
        questions={questions}
        answers={answers}
        onBack={closeReview}
        onRetake={handleRetake}
        retaking={retaking}
        retakeError={retakeError}
      />
    )
  }

  if (questions.length === 0 || !current) {
    return (
      <div className="rounded-student bg-white px-6 py-10 text-center text-gray-400 ring-1 ring-gray-100">
        {questions.length === 0 ? '这次练习没有题目' : '题目加载不完整，请返回重新抽题'}
      </div>
    )
  }

  if (finished && summary) {
    return <ResultPanel summary={summary} onRetry={handleRetry} onReview={openReview} retrying={retrying} />
  }

  const showAction = Boolean(result) || !instant

  return (
    <div className={showAction ? 'space-y-6 pb-28' : 'space-y-6'}>
      <PetalRain petals={petals} />
      <FeedbackToast toast={toast} />
      <ProgressBar current={answeredCount} total={total} />

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              animate={cardControls}
              className="relative rounded-student bg-white px-6 py-8 shadow-sm ring-1 ring-lavender-100 sm:p-8"
            >
              <button
                type="button"
                aria-label="退出练习"
                title="退出练习"
                onClick={requestLeave}
                className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none text-ink hover:bg-peach/60"
              >
                <span aria-hidden="true">×</span>
              </button>
              <div className="mb-3 pr-12 text-sm text-ink/50">
                第 {index + 1} 题 / 共 {total} 题
              </div>
              <QuestionCard
                question={current}
                value={value}
                onChange={setValue}
                onCommit={instant ? (next) => { handleSubmit(next).catch(() => {}) } : undefined}
                pending={submitting}
                result={result}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

      {submitError && (
        <div className="rounded-student-sm bg-coral-50 text-coral-600 text-sm px-4 py-2.5 ring-1 ring-coral-100">
          {submitError}
        </div>
      )}

      {showAction && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/50 bg-paper/95 px-4 pt-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {result ? (
            <motion.button
              type="button"
              onClick={handleNext}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              className="mx-auto flex h-12 w-full max-w-3xl items-center justify-center rounded-full bg-lavender-500 px-8 text-base font-semibold text-white shadow-md shadow-lavender-100 hover:bg-lavender-600"
            >
              {index + 1 >= total ? '查看结果' : '下一题'}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={() => { handleSubmit().catch(() => {}) }}
              disabled={submitting}
              whileTap={{ scale: 0.98 }}
              className="mx-auto flex h-12 w-full max-w-3xl items-center justify-center rounded-full bg-coral-500 px-8 text-base font-semibold text-white shadow-md shadow-coral-100 hover:bg-coral-600 disabled:opacity-60"
            >
              {submitting ? '提交中…' : '提交答案'}
            </motion.button>
          )}
        </div>
      )}

      <ComboBadge combo={combo} />

      {leaveOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-center sm:py-6">
          <div
            ref={leaveRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-lg border-[0.5px] border-gold bg-paper p-6 text-ink shadow-[0_16px_40px_rgba(44,44,44,0.12)] outline-none"
          >
            <h2 id="leave-title" className="book-title text-xl">暂时离开练习？</h2>
            <p className="mt-3 text-base leading-relaxed text-ink/80">
              本次已完成 {answeredCount} / {total} 题。是否保存进度并退出？
            </p>
            {leaveError && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {leaveError}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setLeaveOpen(false)}
                disabled={leaving}
                className="min-h-11 rounded-lg border-[0.5px] border-gold bg-white px-4 text-base text-ink disabled:opacity-60"
              >
                继续作答
              </button>
              <button
                type="button"
                onClick={confirmLeave}
                disabled={leaving}
                className="min-h-11 rounded-lg bg-ink px-4 text-base text-paper disabled:opacity-60"
              >
                {leaving ? '正在保存…' : '保存并退出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
