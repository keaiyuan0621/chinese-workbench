import { useEffect, useState } from 'react'
import jianweiClick from './mascots/jianwei-click.webp'
import jianweiIdle from './mascots/jianwei-idle.webp'
import jianweiPose from './mascots/jianwei-pose.png'
import jianweiStatic from './mascots/jianwei-static.png'
import zhizhuClick from './mascots/zhizhu-click.webp'
import zhizhuIdle from './mascots/zhizhu-idle.webp'
import zhizhuPose from './mascots/zhizhu-pose.png'
import zhizhuStatic from './mascots/zhizhu-static.png'

const CLICK_MS = 1200

const ART = {
  jianwei: { idle: jianweiIdle, click: jianweiClick, pose: jianweiPose, static: jianweiStatic },
  zhizhu: { idle: zhizhuIdle, click: zhizhuClick, pose: zhizhuPose, static: zhizhuStatic },
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (!window.matchMedia) return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return reduced
}

export default function AiTutorMascot({
  role = 'jianwei',
  pose = 'mark',
  alive = false,
  busy = false,
  gesture = 0,
  className = '',
}) {
  const key = role === 'zhizhu' ? 'zhizhu' : 'jianwei'
  const art = ART[key]
  const hero = pose === 'hero'
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState(() => (gesture ? 'click' : 'idle'))

  useEffect(() => {
    const click = new Image()
    click.src = art.click
  }, [art.click])

  useEffect(() => {
    if (!hero || reduced || !gesture) {
      setPhase('idle')
      return undefined
    }
    setPhase('click')
    const timer = window.setTimeout(() => setPhase('idle'), CLICK_MS)
    return () => window.clearTimeout(timer)
  }, [gesture, hero, reduced, key])

  const src = !hero || reduced ? art.static : phase === 'click' ? art.click : alive ? art.idle : art.pose

  return (
    <span
      className={[
        'ai-tutors-figure',
        `ai-tutors-figure--${key}`,
        hero ? 'is-hero' : 'is-mark',
        alive ? 'is-alive' : '',
        busy ? 'is-busy' : '',
        phase === 'click' && hero && !reduced ? 'is-click' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <img
        key={phase === 'click' ? `click-${gesture}` : src}
        src={src}
        alt=""
        draggable="false"
      />
    </span>
  )
}

export function AiTutorMascotPair({ className = '' }) {
  return (
    <span className={`ai-tutors-mascots ${className}`.trim()} aria-hidden="true">
      <AiTutorMascot role="jianwei" />
      <AiTutorMascot role="zhizhu" />
    </span>
  )
}
