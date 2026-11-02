import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'

function PetalShape({ color }) {
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" aria-hidden="true">
      <ellipse cx="13" cy="17" rx="9" ry="15" fill={color} stroke="#E7A0B4" strokeWidth="1.2" />
      <ellipse cx="13" cy="16" rx="3.5" ry="11" fill="#fff" opacity="0.45" />
    </svg>
  )
}

/** 答对时铺满视口的花瓣雨，不拦截点击。 */
export function PetalRain({ petals }) {
  if (!petals?.length || typeof document === 'undefined') return null
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90] h-full w-full overflow-hidden" aria-hidden="true">
      {petals.map((petal) => (
        <motion.span
          key={petal.id}
          className="absolute top-0 select-none leading-none drop-shadow-sm"
          style={{ left: `${petal.left}%`, fontSize: petal.size }}
          initial={{ y: petal.startY, x: 0, opacity: 0, rotate: petal.rotate }}
          animate={{
            y: petal.endY,
            x: petal.drift,
            opacity: [0, 1, 1, 0],
            rotate: petal.rotate + petal.spin,
          }}
          transition={{ duration: petal.duration, delay: petal.delay, ease: 'linear' }}
        >
          {petal.drawn ? <PetalShape color={petal.color} /> : petal.glyph}
        </motion.span>
      ))}
    </div>,
    document.body,
  )
}

/** 鼓励 / 安慰文案。答对时浮在视口上层。 */
export function FeedbackToast({ toast }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {toast?.kind === 'good' && (
        <motion.div
          key={toast.id}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed left-1/2 top-[28%] z-[100] -translate-x-1/2"
        >
          <div className="rounded-lg border-[0.5px] border-gold bg-[#F8F4EC]/90 px-12 py-7 text-center shadow-[0_18px_46px_rgba(44,44,44,0.16)] backdrop-blur-sm">
            <p className="book-title text-4xl text-ink">{toast.text}</p>
          </div>
        </motion.div>
      )}
      {toast && toast.kind !== 'good' && (
        <motion.div
          key={toast.id}
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={`pointer-events-none fixed left-1/2 top-24 z-[100] -translate-x-1/2 rounded-full px-5 py-2 text-base font-semibold whitespace-nowrap ${
            toast.kind === 'soft' ? 'bg-[#F8F4EC] text-ink ring-1 ring-gold' : 'bg-ink text-paper'
          }`}
        >
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** 屏幕角落的连击徽章 */
export function ComboBadge({ combo }) {
  return (
    <AnimatePresence>
      {combo >= 3 && (
        <motion.div
          key="combo"
          initial={{ opacity: 0, scale: 0.6, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.6, x: 40 }}
          className="fixed right-5 bottom-6 z-40"
        >
          <motion.div
            key={combo}
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="rounded-full bg-gradient-to-r from-coral-500 to-lavender-500 text-white font-black px-5 py-2.5 shadow-xl text-lg"
          >
            连击 ×{combo} 🔥
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** 顶部进度条 */
export function ProgressBar({ current, total }) {
  const pct = total ? Math.round((current / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-white ring-1 ring-gray-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-mint-400 via-cream-400 to-coral-400"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="text-sm text-gray-500 tabular-nums shrink-0">
        {current} / {total}
      </span>
    </div>
  )
}
