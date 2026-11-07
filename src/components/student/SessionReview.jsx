import { formatAnswer, formatStudentAnswer } from '../../lib/practice.js'

function statusOf(row) {
  if (!row) return { label: '未作答', className: 'bg-gray-100 text-gray-500' }
  if (row.is_correct === true) return { label: '答对', className: 'bg-mint-100 text-mint-600' }
  if (row.is_correct === false) return { label: '答错', className: 'bg-coral-100 text-coral-600' }
  return { label: '待批改', className: 'bg-sky-100 text-sky-700' }
}

export default function SessionReview({ questions, answers, onBack }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">试卷回顾</h1>
          <p className="mt-1 text-sm text-gray-500">按出题顺序查看全部题目，包括答对、答错和未作答的题</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-base font-medium text-ink ring-1 ring-gold"
        >
          返回
        </button>
      </div>

      <ol className="space-y-4">
        {questions.map((question, index) => {
          const row = answers[question.id]
          const status = statusOf(row)
          const mine = row ? formatStudentAnswer(question, row.student_answer) : ''
          const correct =
            (question.type === '简答' || question.type === 'correction'
              ? formatAnswer(question)
              : formatStudentAnswer(question, question.answer) || formatAnswer(question)) || '本题暂无标准答案'
          const explanation = question.explanation?.trim()
          return (
            <li key={question.id} className="rounded-student bg-white px-4 py-5 sm:px-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-ink">第 {index + 1} 题</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">{question.type}</span>
                <span className={`rounded-full px-2.5 py-1 font-medium ${status.className}`}>{status.label}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-gray-800">{question.stem}</p>
              {Array.isArray(question.options) && question.options.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  {question.options.map((option) => (
                    <li key={option.key}>
                      <span className="font-semibold text-gray-800">{option.key}.</span> {option.text}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 space-y-3 text-sm leading-relaxed">
                <p className="text-gray-800">
                  <span className="font-semibold">我的作答：</span>
                  {mine || '未作答'}
                </p>
                <p className="text-gray-800">
                  <span className="font-semibold">正确答案：</span>
                  {correct}
                </p>
                <p className="whitespace-pre-wrap text-gray-700">
                  <span className="font-semibold text-gray-800">解析：</span>
                  {explanation || '本题暂无解析'}
                </p>
                {row?.ai_feedback && (
                  <p className="whitespace-pre-wrap text-gray-700">
                    <span className="font-semibold text-gray-800">批改说明：</span>
                    {row.ai_feedback}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
