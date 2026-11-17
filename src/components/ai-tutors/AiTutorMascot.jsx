import { useId } from 'react'

function InkTrail({ d, opacity = 0.3 }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="#2C2C2C"
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity={opacity}
    />
  )
}

function FlyingWhite({ d }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="#2C2C2C"
      strokeWidth="0.7"
      strokeLinecap="round"
      strokeDasharray="1.4 2.1"
      opacity="0.82"
    />
  )
}

function JianweiMark({ className = 'h-11 w-11' }) {
  const gradient = 'jianwei-' + useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 64 64" className={`ai-tutors-mascot ${className}`} aria-hidden="true" focusable="false">
      <defs><radialGradient id={gradient} cx="30%" cy="25%" r="85%"><stop offset="0%" stopColor="#FFF1F5" /><stop offset="50%" stopColor="#F4D0D7" /><stop offset="100%" stopColor="#E9A2BB" /></radialGradient></defs>
      <circle cx="22" cy="24" r="18" fill={`url(#${gradient})`} opacity="0.9" />
      <g fill="none" stroke="#2C2C2C" strokeLinecap="round">
        <circle cx="22" cy="24" r="12.5" strokeWidth="1.15" />
        <circle cx="22" cy="24" r="6.6" strokeWidth="0.8" opacity="0.72" />
      </g>
      <circle cx="19" cy="22" r="1" fill="#2C2C2C" /><circle cx="25" cy="22" r="1" fill="#2C2C2C" /><path d="M20 27q2 2 4 0" fill="none" stroke="#2C2C2C" strokeWidth="0.8" strokeLinecap="round" />
      <InkTrail d="M36 31c5.5 2.4 9.5 6.4 12 11.5" />
      <FlyingWhite d="M38 33.5c3.8 2.6 6.8 6 8.2 10" />
      <circle cx="51.5" cy="46.5" r="2.05" fill="#B54434" />
    </svg>
  )
}

function ZhizhuMark({ className = 'h-11 w-11' }) {
  const gradient = 'zhizhu-' + useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 64 64" className={`ai-tutors-mascot ${className}`} aria-hidden="true" focusable="false">
      <defs><radialGradient id={gradient} cx="30%" cy="25%" r="85%"><stop offset="0%" stopColor="#EFF9FF" /><stop offset="50%" stopColor="#B2CDD7" /><stop offset="100%" stopColor="#7CA8C8" /></radialGradient></defs>
      <circle cx="28" cy="26" r="20" fill={`url(#${gradient})`} opacity="0.85" />
      <g fill="none" stroke="#2C2C2C" strokeLinecap="round">
        <circle cx="26" cy="24" r="14.5" strokeWidth="1.15" />
        <circle cx="26" cy="24" r="8.4" strokeWidth="0.8" opacity="0.7" />
        <circle cx="26" cy="24" r="3.4" strokeWidth="0.7" opacity="0.45" />
      </g>
      <circle cx="23" cy="23" r="1" fill="#2C2C2C" /><circle cx="29" cy="23" r="1" fill="#2C2C2C" /><path d="M24 28q2 1.5 4 0" fill="none" stroke="#2C2C2C" strokeWidth="0.8" strokeLinecap="round" />
      <InkTrail d="M42 34c6.5 3.2 11 8.2 13.5 14" opacity="0.26" />
      <FlyingWhite d="M44 36c4.6 3.2 8 7.4 9.6 12.2" />
      <circle cx="55.2" cy="51.2" r="2.05" fill="#B54434" />
    </svg>
  )
}

export default function AiTutorMascot({ role = 'jianwei', className = 'h-11 w-11' }) {
  return role === 'zhizhu' ? <ZhizhuMark className={className} /> : <JianweiMark className={className} />
}

export function AiTutorMascotPair({ className = '' }) {
  return (
    <span className={`ai-tutors-mascots ${className}`.trim()} aria-hidden="true">
      <JianweiMark />
      <ZhizhuMark />
    </span>
  )
}
