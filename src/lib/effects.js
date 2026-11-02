import confetti from 'canvas-confetti'

/** 完成整卷的庆祝：两侧持续喷射约 1.2 秒 */
export function fireFinale() {
  const end = Date.now() + 1200
  const colors = ['#ff6f61', '#4cc999', '#ffd84d', '#9b7bff']
  ;(function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors, zIndex: 9999 })
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors, zIndex: 9999 })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

const PETAL_COLORS = ['#E7A0B4', '#F4D0D7', '#FFFFFF', '#F7B7C3']

/** 全屏花瓣雨：横向铺满，从视口上方落下。 */
export function makePetalRain(count = 80) {
  const glyphs = ['🌸', '🪷']
  const height = typeof window === 'undefined' ? 900 : window.innerHeight
  return Array.from({ length: count }, (_, i) => ({
    id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    glyph: glyphs[i % glyphs.length],
    color: PETAL_COLORS[i % PETAL_COLORS.length],
    drawn: i % 3 !== 0,
    left: Math.random() * 108 - 4,
    delay: Math.random() * 0.35,
    duration: 2.8 + Math.random() * 2,
    size: 22 + Math.random() * 28,
    drift: (Math.random() - 0.5) * 180,
    rotate: Math.random() * 80 - 40,
    spin: (Math.random() - 0.5) * 320,
    startY: -30 - Math.random() * height * 0.25,
    endY: height + 60,
  }))
}
