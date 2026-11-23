import jianweiHero from './mascots/jianwei-hero.jpg'
import jianweiMark from './mascots/jianwei-mark.jpg'
import zhizhuHero from './mascots/zhizhu-hero.jpg'
import zhizhuMark from './mascots/zhizhu-mark.jpg'

const ART = {
  jianwei: { hero: jianweiHero, mark: jianweiMark },
  zhizhu: { hero: zhizhuHero, mark: zhizhuMark },
}

export default function AiTutorMascot({
  role = 'jianwei',
  pose = 'mark',
  alive = false,
  busy = false,
  className = '',
}) {
  const key = role === 'zhizhu' ? 'zhizhu' : 'jianwei'
  const hero = pose === 'hero'
  return (
    <span
      className={[
        'ai-tutors-figure',
        `ai-tutors-figure--${key}`,
        hero ? 'is-hero' : 'is-mark',
        alive ? 'is-alive' : '',
        busy ? 'is-busy' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <img src={ART[key][hero ? 'hero' : 'mark']} alt="" draggable="false" />
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
