import { useMemo, useState } from 'react'
import { AI_TUTOR_ROLES, askAiTutor, buildTutorPayload, isAiTutorsUiEnabled } from '../../lib/aiTutors.js'
import AiTutorMascot, { AiTutorMascotPair } from './AiTutorMascot.jsx'
import './ai-tutors.css'

function SafeText({ text }) {
  const blocks = String(text ?? '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
  if (!blocks.length) return null
  return (
    <div className="ai-tutors-prose">
      {blocks.map((block, index) => (
        <p key={index} className="whitespace-pre-wrap">
          {block}
        </p>
      ))}
    </div>
  )
}

function emptyThread() {
  return { messages: [], error: '', last: null }
}

export default function AiTutorPanel({
  question,
  studentAnswer = '',
  originalExplanation = '',
  preview = false,
}) {
  const enabled = isAiTutorsUiEnabled()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('jianwei')
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [threads, setThreads] = useState({
    jianwei: emptyThread(),
    zhizhu: emptyThread(),
  })

  const current = AI_TUTOR_ROLES[role]
  const thread = threads[role] ?? emptyThread()
  const canAsk = Boolean(question?.stem) && !pending

  const payloadBase = useMemo(
    () => ({
      studentAnswer,
      originalExplanation,
    }),
    [studentAnswer, originalExplanation],
  )

  if (!enabled || !question?.stem) return null

  async function send({ message = '', history, retryLast = false } = {}) {
    if (pending) return
    const requestedRole = role
    const fromThread = threads[requestedRole] ?? emptyThread()
    const last = retryLast ? fromThread.last : null
    const nextHistory = last?.history ?? history ?? fromThread.messages
    const nextMessage = last ? last.message : message
    const payload =
      last?.payload ??
      buildTutorPayload(question, {
        ...payloadBase,
        role: requestedRole,
        message: nextMessage,
        history: nextHistory,
      })
    setPending(true)
    setThreads((prev) => ({
      ...prev,
      [requestedRole]: {
        ...prev[requestedRole],
        error: '',
        last: { payload, history: nextHistory, message: nextMessage },
      },
    }))
    const result = await askAiTutor(payload, { preview })
    setPending(false)
    if (!result.ok) {
      setThreads((prev) => ({
        ...prev,
        [requestedRole]: { ...prev[requestedRole], error: result.message },
      }))
      return
    }
    const shownUser = String(nextMessage ?? '').trim()
    setThreads((prev) => ({
      ...prev,
      [requestedRole]: {
        error: '',
        last: { payload, history: nextHistory, message: nextMessage },
        messages: [
          ...nextHistory,
          ...(shownUser ? [{ role: 'user', content: shownUser }] : []),
          { role: 'assistant', content: result.content },
        ],
      },
    }))
    if (shownUser && requestedRole === role) setDraft('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canAsk) return
    const message = draft.trim()
    if (!message && thread.messages.length) return
    send({ message, history: thread.messages })
  }

  return (
    <section className="ai-tutors mt-4" aria-label="AI 讲解">
      {!open ? (
        <button
          type="button"
          className="ai-tutors-entry ai-tutors-card ai-tutors-card--jianwei"
          onClick={() => setOpen(true)}
        >
          <AiTutorMascotPair />
          <span className="ai-tutors-entry-copy">
            <span className="ai-tutors-entry-title">请 AI 讲解</span>
            <span className="ai-tutors-entry-duty block">
              见微讲清细节，知著一步一步带你想。原解析仍保留在上面。
            </span>
          </span>
        </button>
      ) : (
        <div className={`ai-tutors-card ai-tutors-card--${role}`}>
          <header className="ai-tutors-head">
            <div className="ai-tutors-identity">
              <AiTutorMascot role={role} />
              <div>
                <div className="ai-tutors-name">{current.name}</div>
                <p className="ai-tutors-duty">{current.duty}</p>
              </div>
            </div>
            <button type="button" className="ai-tutors-close" onClick={() => setOpen(false)}>
              收起
            </button>
          </header>

          <div className="ai-tutors-roles" role="tablist" aria-label="选择讲解角色">
            {Object.values(AI_TUTOR_ROLES).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={role === item.id}
                disabled={pending}
                className="ai-tutors-role"
                onClick={() => setRole(item.id)}
              >
                <AiTutorMascot role={item.id} className="h-7 w-7" />
                {item.name}
              </button>
            ))}
          </div>

          <div className="ai-tutors-thread">
            {thread.messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`ai-tutors-bubble ai-tutors-bubble--${item.role}`}>
                <SafeText text={item.content} />
              </div>
            ))}
            {pending && <p className="ai-tutors-status">{current.loadingLabel}</p>}
            {thread.error && (
              <div className="ai-tutors-error" role="alert">
                <span>{thread.error}</span>
                <button type="button" onClick={() => send({ retryLast: true })} disabled={pending}>
                  重试
                </button>
              </div>
            )}
            {!thread.messages.length && !pending && !thread.error && (
              <button type="button" className="ai-tutors-start" disabled={!canAsk} onClick={() => send({ history: [] })}>
                {current.startLabel}
              </button>
            )}
          </div>

          <form className="ai-tutors-composer" onSubmit={handleSubmit}>
            <input
              type="text"
              value={draft}
              maxLength={1000}
              disabled={pending}
              placeholder={current.askLabel}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={`${current.name}追问`}
            />
            <button type="submit" disabled={!canAsk || (!draft.trim() && thread.messages.length > 0)}>
              提问
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
