import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatAnswer, gradeBadge } from '../../lib/practice.js'
import { fireFinale } from '../../lib/effects.js'

export default function ResultPanel({ summary, onRetry, retrying }) {
  const { correct, objective, pending, pct, wrong, gradedShort = 0 } = summary
  const badge = gradeBadge(pct)

  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v))

  useEffect(() => {
    if (pct === null) return
    const controls = animate(mv, pct, { duration: 1.4, ease: 'easeOut' })
    const t = setTimeout(fireFinale, 300)
    return () => {
      controls.stop()
      clearTimeout(t)
    }
  }, [pct, mv])

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-student bg-white px-5 py-8 text-center shadow-sm ring-1 ring-coral-100 sm:p-8"
      >
        <p className="text-sm text-gray-500">本次练习完成</p>

        {pct !== null ? (
          <div className="mt-2 flex items-end justify-center gap-1">
            <motion.span className="text-6xl font-black text-coral-500 tabular-nums">{rounded}</motion.span>
            <span className="text-xl text-gray-400 pb-2">分</span>
          </div>
        ) : (
          <div className="mt-2 text-3xl font-bold text-sky-500">已提交</div>
        )}

        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 14 }}
          className="mt-5 inline-flex flex-col items-center"
        >
          <span className="text-6xl">{badge.emoji}</span>
          <span className="mt-2 text-lg font-bold text-gray-800">{badge.title}</span>
          <span className="text-sm text-gray-500">{badge.text}</span>
        </motion.div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <Stat label="答对" value={correct} tone="text-mint-600" />
          <Stat label={objective > 0 ? '客观题' : '简答'} value={objective > 0 ? objective : gradedShort} tone="text-gray-700" />
          <Stat label="待批改" value={pending} tone="text-sky-600" />
        </div>

        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
          <motion.button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex h-12 items-center justify-center rounded-full bg-coral-500 px-6 text-base font-semibold text-white shadow-md shadow-coral-100 hover:bg-coral-600 disabled:opacity-60"
          >
            {retrying ? '正在生成…' : '再练一次'}
          </motion.button>
          <Link
            to="/student/wrong-book"
            className="inline-flex h-12 items-center justify-center rounded-full bg-cream-100 px-6 text-base font-semibold text-cream-600 transition-colors hover:bg-cream-300"
          >
            我的错题
          </Link>
          <Link
            to="/student"
            className="inline-flex h-12 items-center justify-center rounded-full bg-gray-100 px-6 text-base font-semibold text-gray-600 transition-colors hover:bg-gray-200"
          >
            回到知识闯关
          </Link>
        </div>
      </motion.section>

      {wrong.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800">需要再看看的题目</h2>
          {wrong.map((q, i) => (
            <motion.article
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="rounded-student bg-white p-5 shadow-sm ring-1 ring-cream-300 space-y-2"
            >
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="rounded-full bg-gray-100 px-2 py-0.5">{q.type}</span>
                {q.knowledge_point && <span>{q.knowledge_point.name}</span>}
              </div>
              <p className="text-gray-800 whitespace-pre-wrap">{q.stem}</p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">参考答案：</span>
                {formatAnswer(q)}
              </p>
              {q.explanation && <p className="text-sm text-gray-500 whitespace-pre-wrap">{q.explanation}</p>}
            </motion.article>
          ))}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-student-sm bg-gray-50 py-3">
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  )
}
