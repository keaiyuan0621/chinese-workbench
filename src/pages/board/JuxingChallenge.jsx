import { useEffect, useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { playCorrect, playTap, playWin, playWrong, unlockAudio } from '../../lib/boardAudio.js'
import {
  GROUPS,
  LEAF_MAP,
  LEAVES,
  LEVELS,
  answerOf,
  deckFor,
} from '../../lib/juxingData.js'

const STORE = 'juxing-cleared'
const SMILES = ['😄', '🌟', '👍', '✨', '🎉']

function loadCleared() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORE) || '[]'))
  } catch {
    return new Set()
  }
}

function burst() {
  confetti({
    particleCount: 90,
    spread: 78,
    startVelocity: 42,
    origin: { y: 0.62 },
    colors: ['#ffd84d', '#ff6f61', '#4cc999', '#ffffff', '#9b7bff'],
    zIndex: 80,
  })
}

function makeSmiles() {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `${Date.now()}-${index}`,
    glyph: SMILES[index % SMILES.length],
    left: 12 + Math.random() * 76,
  }))
}

export default function JuxingChallenge() {
  const [cleared, setCleared] = useState(loadCleared)
  const [board, setBoard] = useState(false)
  const [guide, setGuide] = useState(false)
  const [levelId, setLevelId] = useState(null)
  const [deck, setDeck] = useState([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [smiles, setSmiles] = useState([])
  const [finished, setFinished] = useState(false)

  const level = LEVELS.find((item) => item.id === levelId) ?? null
  const question = deck[index] ?? null
  const waiting = picked != null

  useEffect(() => {
    const previous = document.title
    document.title = '汉语句型大闯关'
    return () => {
      document.title = previous
    }
  }, [])

  useEffect(() => {
    function onFullscreen() {
      if (!document.fullscreenElement) setBoard(false)
    }
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => document.removeEventListener('fullscreenchange', onFullscreen)
  }, [])

  const passed = useMemo(() => {
    if (!level || !finished) return false
    if (level.streak) return bestStreak >= level.streak
    return correctCount >= level.pass
  }, [level, finished, bestStreak, correctCount])

  function openLevel(id) {
    unlockAudio()
    playTap()
    setLevelId(id)
    setDeck(deckFor(id))
    setIndex(0)
    setPicked(null)
    setCorrectCount(0)
    setStreak(0)
    setBestStreak(0)
    setFinished(false)
    setSmiles([])
  }

  function goHome() {
    playTap()
    setLevelId(null)
    setFinished(false)
    setPicked(null)
  }

  async function toggleBoard() {
    unlockAudio()
    playTap()
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setBoard(true)
      } else {
        await document.exitFullscreen()
        setBoard(false)
      }
    } catch {
      setBoard((value) => !value)
    }
  }

  function choose(choice) {
    if (!question || waiting || finished) return
    unlockAudio()
    const expected = answerOf(question, levelId)
    const right = choice === expected
    setPicked(choice)
    if (right) {
      playCorrect()
      burst()
      setSmiles(makeSmiles())
      setCorrectCount((count) => count + 1)
      setStreak((value) => {
        const next = value + 1
        setBestStreak((best) => Math.max(best, next))
        return next
      })
    } else {
      playWrong()
      setStreak(0)
    }
  }

  function next() {
    playTap()
    setSmiles([])
    setPicked(null)
    if (level.streak && bestStreak >= level.streak) {
      finish(true)
      return
    }
    if (index + 1 >= deck.length) {
      finish(false)
      return
    }
    setIndex((value) => value + 1)
  }

  function finish(streakPass) {
    const ok = level.streak ? streakPass || bestStreak >= level.streak : correctCount >= level.pass
    setFinished(true)
    if (ok) {
      playWin()
      burst()
      setSmiles(makeSmiles())
      const nextCleared = new Set(cleared)
      nextCleared.add(level.id)
      setCleared(nextCleared)
      sessionStorage.setItem(STORE, JSON.stringify([...nextCleared]))
    }
  }

  return (
    <div
      className={`juxing-board ${board ? 'is-board' : ''}`}
      style={{ fontFamily: '"Noto Serif SC", "LXGW WenKai", serif' }}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 pt-5 pb-2">
        <button type="button" className="board-chip" onClick={levelId ? goHome : undefined}>
          汉语句型大闯关
        </button>
        <div className="flex gap-3">
          <button type="button" className="board-chip" onClick={() => { unlockAudio(); playTap(); setGuide(true) }}>
            句型知识树宝典
          </button>
          <button type="button" className="board-chip board-chip-strong" onClick={toggleBoard}>
            {board ? '退出白板' : '全屏白板'}
          </button>
        </div>
      </header>

      {!level && (
        <Home cleared={cleared} onStart={openLevel} onGuide={() => { unlockAudio(); playTap(); setGuide(true) }} />
      )}

      {level && !finished && question && (
        <Play
          level={level}
          question={question}
          index={index}
          total={deck.length}
          picked={picked}
          streak={streak}
          correctCount={correctCount}
          onChoose={choose}
          onNext={next}
        />
      )}

      {level && finished && (
        <Result
          level={level}
          passed={passed}
          correctCount={correctCount}
          total={deck.length}
          bestStreak={bestStreak}
          onRetry={() => openLevel(level.id)}
          onHome={goHome}
        />
      )}

      <SmileRain smiles={smiles} />
      <AnimatePresence>
        {guide && <Guide onClose={() => { playTap(); setGuide(false) }} />}
      </AnimatePresence>
    </div>
  )
}

function Home({ cleared, onStart, onGuide }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-8">
      <div className="mx-auto mt-4 mb-8 rounded-2xl border-4 border-amber-800 bg-yellow-300 px-10 py-4 text-center shadow-lg">
        <h1 className="text-5xl font-bold tracking-wide text-amber-950 md:text-7xl">汉语句型大闯关</h1>
        <p className="mt-2 text-2xl text-amber-900 md:text-3xl">单句四关 · 对着大屏点就行</p>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-5 md:grid-cols-2">
        {LEVELS.map((item) => {
          const locked = item.id > 1 && !cleared.has(item.id - 1)
          return (
            <button
              key={item.id}
              type="button"
              disabled={locked}
              onClick={() => onStart(item.id)}
              className="board-card text-left disabled:opacity-45"
            >
              <div className="text-xl text-emerald-800">第 {item.id} 关 · {item.play}</div>
              <div className="mt-1 text-4xl font-bold text-slate-900">{item.title}</div>
              <p className="mt-3 text-2xl leading-snug text-slate-700">{item.blurb}</p>
              <div className="mt-4 text-xl text-emerald-700">
                {locked ? '先通过上一关' : cleared.has(item.id) ? '已过关 · 可再闯' : '点此开始'}
              </div>
            </button>
          )
        })}
      </div>
      <button type="button" className="board-wide mt-5" onClick={onGuide}>
        随时查看：句型知识树宝典
      </button>
    </main>
  )
}

function Play({ level, question, index, total, picked, streak, correctCount, onChoose, onNext }) {
  const expected = answerOf(question, level.id)
  const right = picked != null && picked === expected
  const leaf = LEAF_MAP[question.leaf]
  const expectedName = level.id === 1 ? GROUPS[expected].name : leaf.name

  return (
    <main className="flex min-h-0 flex-1 flex-col px-6 pb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl text-emerald-800">第 {level.id} 关 · {level.play}</div>
          <h2 className="text-4xl font-bold text-slate-900">{level.title}</h2>
        </div>
        <div className="text-right text-2xl text-slate-800">
          {level.streak ? (
            <div>连对 <b className="text-5xl text-emerald-700">{streak}</b> / {level.streak}</div>
          ) : (
            <div>第 {index + 1} / {total} 题 · 已对 {correctCount}</div>
          )}
        </div>
      </div>

      <section className="board-sentence">{question.text}</section>

      {level.id === 1 && (
        <div className="mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {['pred', 'non'].map((id) => (
            <Choice
              key={id}
              label={GROUPS[id].name}
              sub={GROUPS[id].brief}
              state={mark(picked, id, expected)}
              onClick={() => onChoose(id)}
            />
          ))}
        </div>
      )}

      {level.id === 2 && (
        <div className="mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {LEAVES.filter((item) => item.group === 'pred').map((item) => (
            <Choice
              key={item.id}
              label={item.name}
              sub={item.brief}
              state={mark(picked, item.id, expected)}
              onClick={() => onChoose(item.id)}
            />
          ))}
        </div>
      )}

      {level.id === 3 && (
        <TreeAnswers expected={expected} picked={picked} onChoose={onChoose} />
      )}

      {level.id === 4 && (
        <div className="mt-4 grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
          {LEAVES.map((item) => (
            <Choice
              key={item.id}
              label={item.name}
              compact
              state={mark(picked, item.id, expected)}
              onClick={() => onChoose(item.id)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {picked && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`mt-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl border-4 px-6 py-4 ${right ? 'border-emerald-600 bg-emerald-50' : 'border-rose-500 bg-rose-50'}`}
          >
            <div>
              <div className="text-4xl font-bold">{right ? '答对了' : `应是「${expectedName}」`}</div>
              <p className="mt-1 text-2xl leading-snug text-slate-800">{question.why}</p>
            </div>
            <button type="button" className="board-wide shrink-0 px-10" onClick={onNext}>
              {level.streak && streak >= level.streak ? '完成本关' : '下一题'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

function mark(picked, id, expected) {
  if (!picked) return 'idle'
  if (id === expected) return 'right'
  if (id === picked) return 'wrong'
  return 'dim'
}

function Choice({ label, sub, state, onClick, compact }) {
  const tone = {
    idle: 'border-slate-800 bg-white',
    right: 'border-emerald-700 bg-emerald-200',
    wrong: 'border-rose-600 bg-rose-200',
    dim: 'border-slate-300 bg-white/70 opacity-70',
  }[state]
  return (
    <button
      type="button"
      disabled={state !== 'idle'}
      onClick={onClick}
      className={`rounded-3xl border-4 px-5 text-left shadow-md active:scale-[0.98] ${compact ? 'min-h-24' : 'min-h-32'} ${tone}`}
    >
      <div className={compact ? 'text-2xl font-bold md:text-3xl' : 'text-4xl font-bold md:text-5xl'}>{label}</div>
      {sub && <div className="mt-2 text-xl text-slate-700">{sub}</div>}
    </button>
  )
}

function TreeAnswers({ expected, picked, onChoose }) {
  return (
    <div className="mt-4 flex min-h-0 flex-1 items-stretch gap-3 overflow-auto rounded-3xl border-4 border-slate-800 bg-white/75 p-4">
      <div className="flex items-center text-3xl font-bold [writing-mode:vertical-rl]">单句</div>
      <div className="w-3 shrink-0 rounded-r-3xl border-y-4 border-r-4 border-slate-800" />
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        {['pred', 'non'].map((groupId) => (
          <section key={groupId} className="flex gap-3">
            <div className="flex items-center text-2xl font-bold [writing-mode:vertical-rl]">{GROUPS[groupId].name}</div>
            <div className="w-3 shrink-0 rounded-r-3xl border-y-4 border-r-4 border-slate-800" />
            <div className="grid flex-1 grid-cols-1 gap-3">
              {LEAVES.filter((item) => item.group === groupId).map((item) => (
                <Choice
                  key={item.id}
                  label={item.name}
                  compact
                  state={mark(picked, item.id, expected)}
                  onClick={() => onChoose(item.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function Result({ level, passed, correctCount, total, bestStreak, onRetry, onHome }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="text-8xl">{passed ? '😄' : '🤔'}</div>
      <h2 className="mt-4 text-6xl font-bold">{passed ? '过关' : '再闯一次'}</h2>
      <p className="mt-4 text-3xl leading-snug text-slate-800">
        {level.streak
          ? `最长连对 ${bestStreak} 题，目标 ${level.streak} 题。`
          : `答对 ${correctCount} / ${total}，过关需要 ${level.pass} 题。`}
      </p>
      <div className="mt-8 flex w-full flex-col gap-4 md:flex-row">
        <button type="button" className="board-wide flex-1" onClick={onRetry}>再闯本关</button>
        <button type="button" className="board-wide flex-1 bg-white" onClick={onHome}>返回关卡</button>
      </div>
    </main>
  )
}

function Guide({ onClose }) {
  const [focus, setFocus] = useState(LEAVES[0].id)
  const leaf = LEAF_MAP[focus]
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-slate-900/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: 80 }}
        animate={{ x: 0 }}
        exit={{ x: 80 }}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[#f3f7ef] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b-4 border-amber-800 bg-yellow-300 px-6 py-4">
          <h2 className="text-4xl font-bold text-amber-950">句型知识树宝典</h2>
          <button type="button" className="board-chip" onClick={onClose}>收起</button>
        </div>
        <p className="px-6 pt-4 text-2xl leading-snug text-slate-800">
          句型看结构，句类看语气。感叹号、问号不改变这棵树上的位置。
        </p>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 py-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {['pred', 'non'].map((groupId) => (
              <section key={groupId}>
                <h3 className="text-3xl font-bold">{GROUPS[groupId].name}</h3>
                <p className="text-xl text-slate-700">{GROUPS[groupId].brief}</p>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {LEAVES.filter((item) => item.group === groupId).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { playTap(); setFocus(item.id) }}
                      className={`min-h-16 rounded-2xl border-4 px-4 text-left text-2xl font-bold ${focus === item.id ? 'border-amber-700 bg-yellow-200' : 'border-slate-700 bg-white'}`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <article className="rounded-3xl border-4 border-slate-800 bg-white p-5">
            <h3 className="text-4xl font-bold">{leaf.name}</h3>
            <p className="mt-3 text-2xl leading-snug">{leaf.brief}</p>
            <ul className="mt-4 space-y-3 text-3xl">
              {leaf.examples.map((example) => (
                <li key={example} className="rounded-2xl bg-emerald-50 px-4 py-3">{example}</li>
              ))}
            </ul>
          </article>
        </div>
      </motion.aside>
    </motion.div>
  )
}

function SmileRain({ smiles }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <AnimatePresence>
        {smiles.map((smile) => (
          <motion.div
            key={smile.id}
            initial={{ y: 80, opacity: 1, scale: 0.7 }}
            animate={{ y: -360, opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.15, ease: 'easeOut' }}
            className="absolute bottom-24 text-7xl"
            style={{ left: `${smile.left}%` }}
          >
            {smile.glyph}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
