/** 两道水墨同心圆，右下飞白收在一点朱砂。 */
export default function InkSeal({ className = 'h-11 w-11' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="#2C2C2C" strokeLinecap="round">
        <circle cx="18" cy="20" r="13" strokeWidth="1.15" />
        <circle cx="18" cy="20" r="7.5" strokeWidth="0.8" opacity="0.72" />
      </g>
      <path
        d="M36 30c6 3 10 7 12 12"
        fill="none"
        stroke="#2C2C2C"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.28"
      />
      <path
        d="M38 33c4 3 7 6 8 10"
        fill="none"
        stroke="#2C2C2C"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeDasharray="1.5 2.2"
        opacity="0.8"
      />
      <circle cx="54" cy="48" r="2.1" fill="#B54434" />
    </svg>
  )
}
