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

export function zhizhuOrigin(version = 'a') {
  return version === 'c' ? { x: 40, y: 38 } : { x: 40, y: 40 }
}

/** 朱砂落点：见微在圆心（看这里），知著在飞白尽头（想到这里）。 */
export function vermillionPoint(role, version = 'a') {
  if (role === 'jianwei') return { x: 48, y: 48 }
  const origin = zhizhuOrigin(version)
  const reach = version === 'c' ? 56 : 50
  return polar(origin.x, origin.y, reach, IP_AXIS_DEG)
}

/** 见微飞白：沿 42° 轴向圆心收，表示聚焦。 */
export function jianweiInwardFly(version = 'a') {
  const startR = version === 'c' ? 24 : 22
  const endR = version === 'c' ? 13 : 12
  return {
    start: polar(48, 48, startR, IP_AXIS_DEG),
    end: polar(48, 48, endR, IP_AXIS_DEG),
  }
}

export function zhizhuGap(version = 'a') {
  const widen = version === 'c' ? 12 : 0
  return { startDeg: 78 + widen, endDeg: 8 - widen / 2 }
}

export function zhizhuFly(version = 'a') {
  const origin = zhizhuOrigin(version)
  const startR = version === 'c' ? 30 : 26
  const start = polar(origin.x, origin.y, startR, IP_AXIS_DEG)
  const end = vermillionPoint('zhizhu', version)
  const mid = polar(origin.x, origin.y, startR + 14, IP_AXIS_DEG + 7)
  return { start, mid, end }
}

export function zhizhuOpenArc(radius, version = 'a') {
  const origin = zhizhuOrigin(version)
  const { startDeg, endDeg } = zhizhuGap(version)
  return arcPath(origin.x, origin.y, radius, startDeg, endDeg, 1, 1)
}

export function sealRect() {
  return { x: 8, y: 8, size: 80, rx: 9 }
}
