import { IP_AXIS_DEG } from './tokens.js'

export function polar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180
  return {
    x: round(cx + r * Math.cos(a)),
    y: round(cy + r * Math.sin(a)),
  }
}

export function round(n) {
  return Math.round(n * 100) / 100
}

export function arcPath(cx, cy, r, startDeg, endDeg, large = 1, sweep = 1) {
  const start = polar(cx, cy, r, startDeg)
  const end = polar(cx, cy, r, endDeg)
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y}`
}

/** 朱砂落点：见微在圆心（看这里），知著在飞白尽头（想到这里）。 */
export function vermillionPoint(role, version = 'a') {
  if (role === 'jianwei') return { x: 48, y: 48 }
  if (version === 'c') return polar(38, 38, 54, IP_AXIS_DEG + 2)
  return polar(38, 38, 52, IP_AXIS_DEG + 2)
}

export function jianweiGatherArc(version) {
  const radius = version === 'c' ? 26 : 24
  return arcPath(48, 48, radius, IP_AXIS_DEG - 26, IP_AXIS_DEG + 26, 0, 1)
}

export function zhizhuFly(version) {
  const origin = { x: 38, y: 38 }
  const startR = version === 'c' ? 28 : 25
  const end = vermillionPoint('zhizhu', version)
  const start = polar(origin.x, origin.y, startR, zhizhuGap(version).endDeg)
  const mid = polar(origin.x, origin.y, startR + 12, IP_AXIS_DEG + 8)
  return { start, mid, end }
}

export function zhizhuGap(version) {
  const widen = version === 'c' ? 10 : 0
  return { startDeg: 78 + widen, endDeg: 6 - widen / 2 }
}

export function zhizhuOpenArc(radius, version) {
  const { startDeg, endDeg } = zhizhuGap(version)
  return arcPath(38, 38, radius, startDeg, endDeg, 1, 1)
}
