import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL } from '../../lib/constants.js'
import { blankPlaceholder, fillStemHint, formatAnswer, isEssay, matchAnswerMap, matchColumns } from '../../lib/practice.js'

const TYPE_STYLE = {
  单选: 'bg-coral-100 text-coral-600',
  多选: 'bg-lavender-100 text-lavender-600',
  判断: 'bg-mint-100 text-mint-600',
  填空: 'bg-cream-100 text-cream-600',
  简答: 'bg-sky-100 text-sky-600',
  match: 'bg-lavender-100 text-lavender-600',
  correction: 'bg-coral-100 text-coral-600',
}

/**
 * 题目卡片内容（不含外层动画容器）
 * value / onChange：当前作答
 * result：提交后传入 { correct: true|false|null }，用于高亮与解析
 */
export default function QuestionCard({ question, value, onChange, onCommit, pending = false, result }) {
  const submitted = Boolean(result)
  const kp = question.knowledge_point
  const instant = question.type === '单选' || question.type === '判断'

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-2 pr-12 text-sm">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${TYPE_STYLE[question.type] ?? ''}`}>
          {QUESTION_TYPE_LABEL[question.type] ?? question.type}
        </span>
        <span className="rounded-full bg-gray-100 text-gray-500 px-2.5 py-1">
          难度 · {DIFFICULTY_LABEL[question.difficulty] ?? question.difficulty}
        </span>
        {kp && <span className="rounded-full bg-gray-100 text-gray-500 px-2.5 py-1">{kp.name}</span>}
      </header>

      <p className="text-lg leading-relaxed text-gray-800 whitespace-pre-wrap">
        {question.stem}
        {question.type === '填空' && (
          <span className="mt-1.5 block text-sm font-normal text-gray-400">{fillStemHint(question.answer)}</span>
        )}
      </p>

      <Body
        question={question}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        pending={pending}
        submitted={submitted}
      />
      {instant && !submitted && (
        <p className="text-sm text-ink/50">{pending ? '正在提交…' : '点选后立即提交'}</p>
      )}

      {submitted && <Explanation question={question} result={result} />}
    </div>
  )
}

function Body({ question, value, onChange, onCommit, pending, submitted }) {
  switch (question.type) {
    case '单选':
    case '多选':
      return (
        <Options
          question={question}
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          pending={pending}
          submitted={submitted}
        />
      )
    case '判断':
      return (
        <Judge
          question={question}
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          pending={pending}
          submitted={submitted}
        />
      )
    case '填空':
      return <Blanks question={question} value={value} onChange={onChange} submitted={submitted} />
    case '简答':
    case 'correction':
      return (
        <textarea
          rows={6}
          value={value ?? ''}
          disabled={submitted}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.type === 'correction' ? '请指出语病，并写出修改后的句子' : '请在此作答，尽量按要点分条书写'}
          className="w-full rounded-student-sm border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-70 resize-y"
        />
      )
    case 'match':
      return <MatchGrid question={question} value={value} onChange={onChange} submitted={submitted} />
    default:
      return null
  }
}

function MatchGrid({ question, value, onChange, submitted }) {
  const { left, right } = matchColumns(question)
  const expected = matchAnswerMap(question.answer, left)
  const chosen = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const used = new Set(Object.values(chosen).filter(Boolean))

  function choose(item, next) {
    if (submitted) return
    onChange({ ...chosen, [item]: next })
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[1fr_1fr] gap-3 text-xs text-gray-400 px-1">
        <span>左列</span>
        <span>请选择对应项</span>
      </div>
      {left.map((item) => {
        const picked = chosen[item] ?? ''
        const rightAnswer = expected[item]
        let ring = 'ring-gray-200 bg-white'
        if (submitted && rightAnswer) {
          ring = picked === rightAnswer ? 'ring-mint-400 bg-mint-50' : 'ring-coral-300 bg-cream-50'
        }
        return (
          <div key={item} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2 items-center">
            <div className={`rounded-student-sm px-3 py-2.5 text-gray-800 ring-1 ${submitted ? ring : 'bg-white ring-gray-200'}`}>
              {item}
            </div>
            <select
              value={picked}
              disabled={submitted}
              onChange={(e) => choose(item, e.target.value)}
              aria-label={`为${item}选择匹配项`}
              className={`rounded-student-sm border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-lavender-300 disabled:opacity-80 ${submitted ? ring : ''}`}
            >
              <option value="">请选择</option>
              {right.map((option) => (
                <option key={option} value={option} disabled={used.has(option) && picked !== option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

function Options({ question, value, onChange, onCommit, pending, submitted }) {
  const multi = question.type === '多选'
  const selected = multi ? new Set(Array.isArray(value) ? value : []) : value
  const correctKeys = new Set(
    multi ? (Array.isArray(question.answer) ? question.answer : []) : [question.answer],
  )
  const locked = submitted || pending

  function pickKey(key) {
    if (locked) return
    if (!multi) {
      onChange(key)
      onCommit?.(key)
      return
    }
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange([...next].sort())
  }

  return (
    <ul className="space-y-2.5">
      {(question.options ?? []).map((opt) => {
        const isSel = multi ? selected.has(opt.key) : selected === opt.key
        const isRight = correctKeys.has(opt.key)
        let cls = 'bg-white ring-gray-200 hover:bg-gray-50'
        if (isSel && !submitted) cls = 'bg-lavender-50 ring-lavender-400'
        if (submitted) {
          if (isRight) cls = 'bg-emerald-50 ring-emerald-500'
          else if (isSel) cls = 'bg-red-50 ring-red-400'
          else cls = 'bg-white ring-gray-100 opacity-60'
        }
        return (
          <li key={opt.key}>
            <button
              type="button"
              onClick={() => pickKey(opt.key)}
              disabled={locked}
              aria-busy={pending && isSel ? true : undefined}
              className={`flex w-full items-start gap-3 rounded-student-sm px-4 py-3 text-left ring-1 transition-colors disabled:cursor-default ${cls}`}
            >
              <span
                className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                  isSel || (submitted && isRight)
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {opt.key}
              </span>
              <span className="pt-0.5 text-gray-800">{opt.text}</span>
              {pending && isSel && <span className="ml-auto pt-0.5 text-sm text-ink/60">提交中</span>}
              {submitted && isRight && (
                <span className="ml-auto pt-0.5 text-sm font-semibold text-emerald-700">
                  {isSel ? '✓ 正确' : '正确答案'}
                </span>
              )}
              {submitted && isSel && !isRight && (
                <span className="ml-auto pt-0.5 text-sm font-semibold text-red-600">未选对</span>
              )}
            </button>
          </li>
        )
      })}
      {multi && !submitted && <li className="text-xs text-gray-400 pl-1">可以选择多个答案</li>}
    </ul>
  )
}

function Judge({ question, value, onChange, onCommit, pending, submitted }) {
  const items = [
    { v: true, label: '对', icon: '○' },
    { v: false, label: '错', icon: '×' },
  ]
  const locked = submitted || pending
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ v, label, icon }) => {
        const isSel = value === v
        const isRight = Boolean(question.answer) === v
        let cls = 'bg-white ring-gray-200 hover:bg-gray-50'
        if (isSel && !submitted) cls = 'bg-lavender-50 ring-lavender-400'
        if (submitted) {
          if (isRight) cls = 'bg-emerald-50 ring-emerald-500'
          else if (isSel) cls = 'bg-red-50 ring-red-400'
          else cls = 'bg-white ring-gray-100 opacity-60'
        }
        return (
          <button
            key={label}
            type="button"
            disabled={locked}
            aria-busy={pending && isSel ? true : undefined}
            onClick={() => {
              if (locked) return
              onChange(v)
              onCommit?.(v)
            }}
            className={`rounded-student-sm py-4 ring-1 text-lg font-semibold text-gray-800 transition-colors disabled:cursor-default ${cls}`}
          >
            <span className="mr-2 text-gray-400">{icon}</span>
            {label}
            {pending && isSel && <span className="mt-1 block text-sm font-normal text-ink/60">提交中</span>}
            {submitted && isRight && (
              <span className="mt-1 block text-sm font-semibold text-emerald-700">{isSel ? '✓ 正确' : '正确答案'}</span>
            )}
            {submitted && isSel && !isRight && (
              <span className="mt-1 block text-sm font-semibold text-red-600">未选对</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Blanks({ question, value, onChange, submitted }) {
  const expected = Array.isArray(question.answer) ? question.answer : [question.answer]
  const vals = Array.isArray(value) ? value : expected.map(() => '')

  function setAt(i, v) {
    const next = [...vals]
    next[i] = v
    onChange(next)
  }

  return (
    <div className="space-y-2.5">
      {expected.map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="shrink-0 text-sm text-gray-400 w-12">第 {i + 1} 空</span>
          <input
            type="text"
            value={vals[i] ?? ''}
            disabled={submitted}
            onChange={(e) => setAt(i, e.target.value)}
            placeholder={blankPlaceholder(expected[i])}
            className="flex-1 rounded-student-sm border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cream-400 disabled:opacity-70"
          />
        </div>
      ))}
    </div>
  )
}

function Explanation({ question, result }) {
  const pending = result.correct === null
  return (
    <div
      className={`rounded-student-sm p-4 space-y-3 text-sm ring-1 ${
        pending
          ? 'bg-sky-50 ring-sky-100'
          : result.correct
            ? 'bg-emerald-50 ring-emerald-100'
            : 'bg-red-50 ring-red-100'
      }`}
    >
      {isEssay(question.type) && result.score != null && (
        <p className="text-gray-800">
          <span className="font-semibold">得分：</span>
          {result.score} / {result.full} 分。{result.feedback}
        </p>
      )}

      {result.correct === true && <p className="font-semibold text-emerald-700">回答正确</p>}
      {result.correct === false && (
        <p className="font-semibold text-red-600">这题没有选对，正确答案已用绿色标出</p>
      )}

      {pending ? (
        <p className="text-sky-700">已提交，老师批改后会在成绩中更新。先对照参考答案自查一下吧：</p>
      ) : !isEssay(question.type) ? (
        <p className="text-gray-700">
          <span className="font-semibold">参考答案：</span>
          {formatAnswer(question)}
        </p>
      ) : null}

      {isEssay(question.type) && question.reference_answer && (
        <div>
          <div className="font-semibold text-gray-700 mb-1">参考答案</div>
          <p className="text-gray-700 whitespace-pre-wrap">{question.reference_answer}</p>
        </div>
      )}

      {isEssay(question.type) && Array.isArray(question.scoring_points) && (
        <div>
          <div className="font-semibold text-gray-700 mb-1">得分点</div>
          <ul className="list-disc pl-5 space-y-0.5 text-gray-700">
            {question.scoring_points.map((p, i) => {
              const hit = result.hits?.[i]?.hit
              return (
                <li key={i}>
                  {hit != null && <span className={hit ? 'text-mint-600' : 'text-gray-400'}>{hit ? '命中 ' : '未命中 '}</span>}
                  {p}
                  {Array.isArray(question.point_scores) && question.point_scores[i] != null && (
                    <span className="text-gray-400">（{question.point_scores[i]} 分）</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {question.explanation && (
        <div>
          <div className="font-semibold text-gray-700 mb-1">解析</div>
          <p className="text-gray-700 whitespace-pre-wrap">{question.explanation}</p>
        </div>
      )}

      {question.difficulty_reason && (
        <p className="text-xs text-gray-400">难度说明：{question.difficulty_reason}</p>
      )}
    </div>
  )
}
