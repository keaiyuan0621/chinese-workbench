import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ComposeSheet from '../../components/student/ComposeSheet.jsx'
import { useKnowledgeTree } from '../../hooks/useKnowledgeTree.js'
import { useAuth } from '../../lib/auth-context.js'
import { CHAPTERS, QUICK_TEMPLATES } from '../../lib/constants.js'

const CHAPTER_VERSE = {
  语音: { no: '第一章', epithet: '声韵之美', seal: '大音希声' },
  汉字: { no: '第二章', epithet: '字形之韵', seal: '见微知著' },
  词汇: { no: '第三章', epithet: '词义之丰', seal: '含英咀华' },
  语法: { no: '第四章', epithet: '结构之序', seal: '井然有序' },
  修辞: { no: '第五章', epithet: '表达之妙', seal: '妙笔生花' },
}

const FOCUS = 'chapter-focus'

const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function chipCount(node, counts) {
  return counts[node.id] ?? 0
}

function sectionTotal(section, counts) {
  const own = chipCount(section, counts)
  const children = (section.children ?? []).reduce((sum, child) => sum + chipCount(child, counts), 0)
  return own + children
}

function chapterTotal(chapter, counts) {
  return (chapter.children ?? []).reduce((sum, section) => sum + sectionTotal(section, counts), 0)
}

function bankTotal(tree, counts) {
  return (tree ?? []).reduce((sum, chapter) => sum + chapterTotal(chapter, counts), 0)
}

function verseFor(chapter, index) {
  return (
    CHAPTER_VERSE[chapter.name] ?? {
      no: `第${CN[index] ?? index + 1}章`,
      epithet: '研习之美',
      seal: '温故知新',
    }
  )
}

function orderedChapters(tree) {
  return [...(tree ?? [])].sort((a, b) => {
    const ia = CHAPTERS.indexOf(a.name)
    const ib = CHAPTERS.indexOf(b.name)
    return (ia < 0 ? CHAPTERS.length : ia) - (ib < 0 ? CHAPTERS.length : ib)
  })
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function nestedScrollable(target, scroller) {
  let node = target instanceof Element ? target : null
  while (node && node !== scroller) {
    if (node.matches('input, textarea, select') || node.isContentEditable) return true
    const style = getComputedStyle(node)
    const canScroll = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1
    if (canScroll) return true
    node = node.parentElement
  }
  return false
}

/** 只在指针位于卷轴上、且还能横向移动时，把垂直滚轮换成横向位移。 */
function useHorizontalWheel(scrollerRef, active) {
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!active || !scroller) return undefined

    let target = scroller.scrollLeft
    let frame = 0
    let wheeling = false
    let expected = null

    function writeLeft(value) {
      expected = value
      scroller.scrollLeft = value
    }

    function tick() {
      const diff = target - scroller.scrollLeft
      const step = diff * 0.22
      if (Math.abs(diff) < 1 || Math.abs(step) < 0.5) {
        writeLeft(target)
        wheeling = false
        frame = 0
        return
      }
      writeLeft(scroller.scrollLeft + step)
      frame = requestAnimationFrame(tick)
    }

    function onWheel(event) {
      if (event.ctrlKey || event.defaultPrevented) return
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      if (nestedScrollable(event.target, scroller)) return
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientWidth : 1
      const delta = event.deltaY * unit
      if (!delta) return
      const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
      if (max <= 1) return
      const position = wheeling ? target : scroller.scrollLeft
      if ((position <= 0.5 && delta < 0) || (position >= max - 0.5 && delta > 0)) return
      const next = Math.min(max, Math.max(0, position + delta))
      if (Math.abs(next - position) < 0.5) return
      event.preventDefault()
      target = next
      wheeling = true
      if (!frame) frame = requestAnimationFrame(tick)
    }

    function onScroll() {
      if (expected !== null && Math.abs(scroller.scrollLeft - expected) < 1.5) return
      cancelAnimationFrame(frame)
      frame = 0
      wheeling = false
      expected = null
      target = scroller.scrollLeft
    }

    function release() {
      wheeling = false
      cancelAnimationFrame(frame)
      frame = 0
      expected = null
      target = scroller.scrollLeft
    }

    scroller.addEventListener('wheel', onWheel, { passive: false })
    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('touchstart', release, { passive: true })
    scroller.addEventListener('pointerdown', release)
    scroller.addEventListener('chapter-jump', release)
    return () => {
      scroller.removeEventListener('wheel', onWheel)
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('touchstart', release)
      scroller.removeEventListener('pointerdown', release)
      scroller.removeEventListener('chapter-jump', release)
      cancelAnimationFrame(frame)
    }
  }, [scrollerRef, active])
}

export default function StudentHome() {
  const { profile } = useAuth()
  const { tree, counts, error, loading } = useKnowledgeTree()
  const [composePoint, setComposePoint] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollerRef = useRef(null)
  const chapters = useMemo(() => orderedChapters(tree), [tree])
  const ready = chapters.length > 0
  useHorizontalWheel(scrollerRef, ready)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!ready || !scroller) return undefined
    let frame = 0
    function update() {
      frame = 0
      const panels = scroller.querySelectorAll('[data-chapter]')
      const origin = scroller.getBoundingClientRect().left
      let best = 0
      let bestDist = Infinity
      panels.forEach((panel, index) => {
        const dist = Math.abs(panel.getBoundingClientRect().left - origin)
        if (dist < bestDist) {
          bestDist = dist
          best = index
        }
      })
      setActiveIndex((current) => (current === best ? current : best))
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [ready, chapters])

  function goTo(index) {
    const scroller = scrollerRef.current
    const panel = scroller?.querySelectorAll('[data-chapter]')[index]
    if (!scroller || !panel) return
    scroller.dispatchEvent(new Event('chapter-jump'))
    const left = panel.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft
    scroller.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <div className="flex items-center justify-center gap-4 px-2">
          <span aria-hidden="true" className="h-px w-8 bg-ink/25 sm:w-14" />
          <p
            className="book-title text-balance text-center text-xl text-ink/70 md:text-2xl"
            style={{ letterSpacing: '0.22em', marginRight: '-0.22em' }}
          >
            见微知著，追寻现代汉语之美
          </p>
          <span aria-hidden="true" className="h-px w-8 bg-ink/25 sm:w-14" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 text-base text-ink/70 md:text-lg">
          <p>
            {greeting()}，{profile?.display_name ?? '同学'}
            {profile?.class_name ? ` · ${profile.class_name}` : ''}
            {profile?.student_no ? ` · 学号 ${profile.student_no}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((item) => (
              <Link
                key={item.id}
                to={`/student/practice?template=${item.id}`}
                className="rounded-lg border-[0.5px] border-gold bg-white/80 px-4 py-2 text-base text-ink hover:bg-peach/40"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm tracking-[0.22em] text-ink/55">章节卷轴</p>
          <span className="text-sm text-ink/55">
            {loading ? '正在统计题量…' : tree ? `共 ${bankTotal(tree, counts)} 道题` : ''}
          </span>
        </div>

        {ready && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="章节导航" className="flex flex-wrap gap-2">
              {chapters.map((chapter, index) => {
                const current = index === activeIndex
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    aria-current={current ? 'true' : undefined}
                    onClick={() => goTo(index)}
                    className={`min-h-11 rounded-full border-[0.5px] px-4 text-base ${FOCUS} ${
                      current
                        ? 'border-ink bg-peach text-ink'
                        : 'border-gold bg-white/80 text-ink/70 hover:bg-peach/40'
                    }`}
                  >
                    {chapter.name}
                  </button>
                )
              })}
            </nav>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goTo(activeIndex - 1)}
                disabled={activeIndex <= 0}
                className={`min-h-11 rounded-lg border-[0.5px] border-gold bg-white px-4 text-base text-ink disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-white/50 disabled:text-ink/30 ${FOCUS}`}
              >
                上一章
              </button>
              <span className="min-w-20 text-center text-base text-ink">当前：{chapters[activeIndex]?.name}</span>
              <button
                type="button"
                onClick={() => goTo(activeIndex + 1)}
                disabled={activeIndex >= chapters.length - 1}
                className={`min-h-11 rounded-lg border-[0.5px] border-gold bg-white px-4 text-base text-ink disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-white/50 disabled:text-ink/30 ${FOCUS}`}
              >
                下一章
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 rounded-lg border-[0.5px] border-gold bg-white px-5 py-4 text-sm text-ink sm:mx-10">
            {error}
          </div>
        )}

        {loading && (
          <div className="chapter-reel flex gap-6 overflow-hidden" aria-busy="true">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-80 w-[calc(100%-4rem)] shrink-0 rounded-lg border-[0.5px] border-gold bg-white/70"
              />
            ))}
          </div>
        )}

        {tree && tree.length === 0 && (
          <div className="mx-6 rounded-lg border-[0.5px] border-gold bg-white px-5 py-16 text-center text-sm text-ink/50 sm:mx-10">
            暂无知识点，请联系教师导入
          </div>
        )}

        {ready && (
          <div
            ref={scrollerRef}
            data-scroll="chapters"
            aria-label="章节卷轴"
            className="chapter-reel flex items-start gap-6 overflow-x-auto overscroll-x-contain pb-6"
          >
            {chapters.map((chapter, index) => (
              <ChapterSheet
                key={chapter.id}
                chapter={chapter}
                counts={counts}
                index={index}
                onPick={setComposePoint}
              />
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {composePoint && (
          <ComposeSheet point={composePoint} onClose={() => setComposePoint(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function Wash({ id, warm }) {
  const a = `${id}-a`
  const b = `${id}-b`
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id={`wash-${a}`} cx={warm ? '18%' : '78%'} cy="32%" r="62%">
          <stop offset="0%" stopColor="#F4D0D7" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#F4D0D7" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#F4D0D7" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`wash-${b}`} cx={warm ? '84%' : '16%'} cy="78%" r="58%">
          <stop offset="0%" stopColor="#B2CDD7" stopOpacity="0.9" />
          <stop offset="68%" stopColor="#B2CDD7" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#B2CDD7" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#wash-${a})`} />
      <rect width="100%" height="100%" fill={`url(#wash-${b})`} />
    </svg>
  )
}

function ChapterSheetView({ chapter, counts, index, onPick }) {
  const reduce = useReducedMotion()
  const sheetRef = useRef(null)
  const inView = useInView(sheetRef, { amount: 0.4, once: false })
  const verse = verseFor(chapter, index)
  const total = chapterTotal(chapter, counts)
  const [openId, setOpenId] = useState(null)
  const anchorRef = useRef(null)
  const holdRef = useRef(0)
  const float = !reduce && inView

  useEffect(() => () => cancelAnimationFrame(holdRef.current), [])

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor?.button?.isConnected) return
    cancelAnimationFrame(holdRef.current)
    function hold() {
      if (!anchor.button.isConnected) return
      const delta = anchor.button.getBoundingClientRect().top - anchor.top
      if (Math.abs(delta) > 0.5) window.scrollBy(0, delta)
      if (performance.now() - anchor.start < 560) holdRef.current = requestAnimationFrame(hold)
    }
    hold()
  }, [openId])

  function toggleSection(sectionId, button) {
    anchorRef.current = { top: button.getBoundingClientRect().top, button, start: performance.now() }
    setOpenId(sectionId === openId ? null : sectionId)
  }

  return (
    <motion.article
      ref={sheetRef}
      data-chapter={chapter.name}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 'some' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-[calc(100%-4rem)] shrink-0 overflow-hidden rounded-lg border-[0.5px] border-gold bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-28px_50px_rgba(201,176,138,0.16)]"
    >
      <motion.div
        data-decor="wash"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        animate={float ? { y: [0, -3, 0] } : { y: 0 }}
        transition={float ? { duration: 7, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        <Wash id={chapter.id} warm={index % 2 === 0} />
      </motion.div>
      <div className="relative z-10 grid grid-cols-1 items-stretch gap-8 px-6 py-8 md:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)] md:gap-10 md:px-10 md:py-10">
        <div className="relative flex h-full flex-col">
          <div>
            <h3
              className="book-title relative text-ink"
              aria-label={`${verse.no} ${chapter.name}——${verse.epithet}`}
            >
              <span className="block text-base tracking-widest text-ink/55">{verse.no}</span>
              <span className="mt-3 block text-[2.5rem] leading-tight lg:text-[3rem] xl:text-[3.5rem]">{chapter.name}</span>
              <span className="mt-3 block text-base tracking-widest text-ink/60 lg:text-lg">——{verse.epithet}</span>
            </h3>
            <p className="mt-4 text-sm tracking-[0.12em] text-ink/55">{total} 题</p>
          </div>
          <p
            data-seal="true"
            className="book-title pointer-events-none mt-auto select-none whitespace-nowrap pt-10 text-[2.5rem] leading-none text-ink opacity-[0.04]"
          >
            {verse.seal}
          </p>
        </div>

        <div className="knowledge-pane min-w-0">
          {chapter.children.length === 0 ? (
            <p className="text-base text-ink/55">本章节暂无知识点</p>
          ) : (
            <ul className="knowledge-grid">
              {chapter.children.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  counts={counts}
                  open={section.id === openId}
                  reduce={reduce}
                  onToggle={(button) => toggleSection(section.id, button)}
                  onPick={onPick}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.article>
  )
}

const ChapterSheet = memo(ChapterSheetView)

function SectionCard({ section, counts, open, reduce, onToggle, onPick }) {
  const total = sectionTotal(section, counts)
  return (
    <li data-level="2" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        aria-expanded={open}
        onClick={(event) => onToggle(event.currentTarget)}
        className={`flex w-full items-center justify-between gap-4 rounded-lg border px-5 py-4 text-left ${FOCUS} ${
          open
            ? 'border-ink bg-peach/80 text-ink'
            : 'border-gold bg-white text-ink hover:bg-peach/30'
        }`}
      >
        <span className="book-title min-w-0 text-lg leading-snug xl:text-xl">{section.name}</span>
        <span className="flex shrink-0 items-center gap-3 text-sm text-ink/60">
          {total} 题
          <Chevron open={open} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-1 pt-3">
              <SectionChips section={section} counts={counts} onPick={onPick} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

function Chevron({ open }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path
        d="M5 7.5 10 12.5 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SectionChips({ section, counts, onPick }) {
  const own = chipCount(section, counts)
  const nested = section.children ?? []
  if (nested.length === 0 && own === 0) {
    return <p className="text-sm text-ink/50">该模块下暂无三级知识点</p>
  }
  return (
    <ul className="flex flex-wrap gap-2.5">
      {own > 0 && (
        <li>
          <KnowledgeChip kp={section} counts={counts} onPick={onPick} label="综合练习" />
        </li>
      )}
      {nested.map((child) => (
        <li key={child.id}>
          <KnowledgeChip kp={child} counts={counts} onPick={onPick} />
        </li>
      ))}
    </ul>
  )
}

function KnowledgeChip({ kp, counts, onPick, label }) {
  const total = chipCount(kp, counts)
  const shown = label ?? kp.name
  const sheetName = label ? `${kp.name} · ${label}` : kp.name
  return (
    <button
      type="button"
      data-level="3"
      onClick={() => onPick({ id: kp.id, name: sheetName, total })}
      title={`组题「${sheetName}」· ${total} 题`}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border-[0.5px] border-gold bg-white/90 px-4 py-2 text-sm text-ink hover:bg-mountain/40 md:text-base ${FOCUS}`}
    >
      {shown}
      <span className="text-sm text-ink/55">{total}</span>
    </button>
  )
}
