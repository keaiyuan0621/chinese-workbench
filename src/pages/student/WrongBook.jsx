import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AiTutorPanel from '../../components/ai-tutors/AiTutorPanel.jsx'
import { createPracticeSession, fetchPracticeHistory, fetchStudentAnswerDetails, fetchWrongBook } from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.js'
import { zhError } from '../../lib/errors.js'
import { formatStudentAnswer, shuffle } from '../../lib/practice.js'

const RETRY_LIMIT = 20

function dayKey(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function formatDay(value) {
  const date = new Date(value)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatClock(value) {
  const date = new Date(value)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export default function WrongBook() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState(null)
  const [wrongItems, setWrongItems] = useState([])
  const [answersByQuestion, setAnswersByQuestion] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [history, wrongs, details] = await Promise.all([
        fetchPracticeHistory(user.id),
        fetchWrongBook(user.id),
        fetchStudentAnswerDetails(user.id).catch(() => []),
      ])
      const latestWrong = {}
      for (const row of details) {
        if (row.is_correct !== false || !row.question_id) continue
        const prev = latestWrong[row.question_id]
        if (!prev || String(row.created_at) > String(prev.created_at)) latestWrong[row.question_id] = row
      }
      setSessions(history)
      setWrongItems(wrongs.filter((item) => item.question?.stem && !item.mastered))
      setAnswersByQuestion(latestWrong)
      setError('')
    } catch (err) {
      setSessions([])
      setError(zhError(err, '做题记录加载失败，请刷新重试'))
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(timer)
  }, [notice])

  const groups = useMemo(() => {
    const next = []
    for (const session of sessions ?? []) {
      const key = dayKey(session.created_at)
      const last = next[next.length - 1]
      if (!last || last.key !== key) next.push({ key, label: formatDay(session.created_at), items: [session] })
      else last.items.push(session)
    }
    return next
  }, [sessions])

  async function retryAll() {
    if (!user || !wrongItems.length) return
    setRetrying(true)
    try {
      const picked = shuffle(wrongItems).slice(0, RETRY_LIMIT)
      const ids = picked.map((item) => item.question_id)
      const session = await createPracticeSession(
        user.id,
        { source: 'wrong_book', return_to: '/student/wrong-book', count: ids.length },
        ids,
      )
      navigate(`/student/practice/session/${session.id}`, {
        state: {
          questions: picked.map((item) => item.question).filter((question) => question?.id && question.stem),
          from: '/student/wrong-book',
        },
      })
    } catch (err) {
      setNotice(zhError(err, '创建练习失败，请稍后再试'))
      setRetrying(false)
    }
  }

  function openReview(session) {
    navigate(`/student/practice/session/${session.id}?review=1`, { state: { from: 'history' } })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl text-ink">我的题集</h1>
          <p className="mt-1 text-sm text-gray-500">按每次练习回顾整套题，也可以把错题再练一遍</p>
        </div>
        <motion.button
          type="button"
          onClick={retryAll}
          disabled={retrying || wrongItems.length === 0}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex h-12 items-center justify-center rounded-full bg-mint-500 px-6 text-base font-semibold text-white shadow-md shadow-mint-100 hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {retrying ? '正在生成…' : '一键重练所有错题'}
        </motion.button>
      </header>

      {notice && (
        <div className="rounded-student-sm bg-mint-50 px-4 py-2.5 text-sm text-mint-600 ring-1 ring-mint-100">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-student bg-coral-50 px-5 py-4 text-sm text-coral-600 ring-1 ring-coral-100">
          {error}
        </div>
      )}

      {sessions === null && !error && (
        <div className="space-y-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-student bg-white/70" />
          ))}
        </div>
      )}

      {sessions !== null && sessions.length === 0 && !error && (
        <div className="rounded-student bg-white px-6 py-12 text-center ring-1 ring-gray-100">
          <p className="text-gray-500">还没有练习记录，先去做一套题吧</p>
        </div>
      )}

      {wrongItems.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-ink/60">错题</h2>
          <ul className="space-y-4">
            {wrongItems.map((item) => {
              const question = item.question
              const row = answersByQuestion[item.question_id]
              const mine = formatStudentAnswer(question, row?.student_answer)
              const explanation = question.explanation?.trim() || ''
              return (
                <li key={item.id} className="rounded-student bg-white px-4 py-5 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-coral-100 px-2.5 py-1 font-medium text-coral-600">答错</span>
                    {question.type && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">{question.type}</span>
                    )}
                    {item.wrong_count > 1 && (
                      <span className="text-gray-500">错过 {item.wrong_count} 次</span>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-gray-800">{question.stem}</p>
                  {mine && (
                    <p className="mt-3 text-sm leading-relaxed text-gray-800">
                      <span className="font-semibold">我的作答：</span>
                      {mine}
                    </p>
                  )}
                  {explanation && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                      <span className="font-semibold text-gray-800">解析：</span>
                      {explanation}
                    </p>
                  )}
                  <AiTutorPanel
                    question={question}
                    studentAnswer={mine}
                    originalExplanation={explanation}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key} className="space-y-4">
            <h2 className="text-sm font-semibold tracking-wide text-ink/60">{group.label}</h2>
            <ul className="space-y-4">
              {group.items.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => openReview(session)}
                    className="flex w-full flex-col gap-3 rounded-student bg-white px-4 py-5 text-left sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div>
                      <p className="text-lg font-semibold text-ink">{formatClock(session.created_at)}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {session.total} 题 · 正确率 {session.pct}%
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {session.wrong > 0 && (
                        <span className="rounded-full bg-coral-100 px-3 py-1 text-sm font-medium text-coral-600">
                          含 {session.wrong} 道错题
                        </span>
                      )}
                      {session.perfect && (
                        <span className="rounded-full bg-mint-100 px-3 py-1 text-sm font-medium text-mint-600">
                          全对
                        </span>
                      )}
                      <span className="text-sm font-medium text-ink/70">回顾整套题</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
