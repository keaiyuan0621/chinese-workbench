import {
  jianweiInwardFly,
  sealFramePath,
  sealRect,
  vermillionPoint,
  zhizhuFly,
  zhizhuOpenArc,
  zhizhuOrigin,
} from './geometry.js'
import {
  IP_CINNABAR,
  IP_CINNABAR_R,
  IP_INK,
  IP_MOUNTAIN,
  IP_PAPER,
  IP_PEACH,
  IP_SILHOUETTE_STROKE,
  IP_STROKE_FLY,
  IP_STROKE_INNER,
  IP_STROKE_OUTER,
} from './tokens.js'

function isCutout(mode) {
  return mode === 'silhouette' || mode === 'ink'
}

function palette(mode, role) {
  if (isCutout(mode)) return { wash: IP_INK, gradient: false }
  if (mode === 'gray') return { wash: '#C2C2C2', gradient: false }
  return { wash: role === 'zhizhu' ? IP_MOUNTAIN[1] : IP_PEACH[1], gradient: true }
}

function flyingWhite(d, width = IP_STROKE_FLY) {
  return `<path d="${d}" fill="none" stroke="${IP_INK}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="2.2 3.2" opacity="0.82"/>`
}

function inkTrail(d, width = 2.4, opacity = 0.22) {
  return `<path d="${d}" fill="none" stroke="${IP_INK}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`
}

function jianweiBody({ version, mode, colors, gradientId }) {
  const seal = version === 'c'
  const outer = seal ? 30 : 28
  const mid = seal ? 20 : 18
  const inner = seal ? 11 : 9.5
  const fillR = seal ? 8 : 14
  const wash = colors.gradient ? `url(#${gradientId})` : colors.wash
  const fly = jianweiInwardFly(version)
  const inward = `M ${fly.start.x} ${fly.start.y} L ${fly.end.x} ${fly.end.y}`

  if (isCutout(mode)) {
    const stamp = sealRect()
    const shape = seal
      ? `<rect class="ip-seal" x="${stamp.x}" y="${stamp.y}" width="${stamp.size}" height="${stamp.size}" rx="${stamp.rx}" fill="${IP_INK}"/>`
      : `<circle cx="48" cy="48" r="${outer}" fill="${IP_INK}"/>`
    return `${shape}`
  }

  const frame = seal
    ? `<path class="ip-seal" d="${sealFramePath(false)}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_OUTER}"/>`
    : ''
  const innerRing = seal
    ? `<circle cx="48" cy="48" r="${inner}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_INNER}" opacity="0.55"/>`
    : `<circle cx="48" cy="48" r="${inner}" fill="none" stroke="${IP_INK}" stroke-width="1.05" stroke-dasharray="2.2 3.2" opacity="0.55"/>`

  return `${frame}
    <circle cx="48" cy="48" r="${fillR}" fill="${wash}" opacity="${seal ? 0.5 : 0.92}"/>
    <circle cx="48" cy="48" r="${outer}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_OUTER}"/>
    <circle cx="48" cy="48" r="${mid}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_INNER}" opacity="0.78"/>
    ${innerRing}
    ${flyingWhite(inward, seal ? 1.35 : IP_STROKE_FLY)}`
}

function zhizhuBody({ version, mode, colors, gradientId }) {
  const fly = zhizhuFly(version)
  const seal = version === 'c'
  const outerR = seal ? 28 : 26
  const innerR = seal ? 16 : 15
  const ribbon = `M ${fly.start.x} ${fly.start.y} Q ${fly.mid.x} ${fly.mid.y} ${fly.end.x} ${fly.end.y}`
  const wash = colors.gradient ? `url(#${gradientId})` : colors.wash
  const openSeal = `<path class="ip-seal" d="${sealFramePath(true)}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_OUTER}" opacity="0.92"/>`

  if (isCutout(mode)) {
    const stamp = seal
      ? `<path class="ip-seal" d="${sealFramePath(true)}" fill="none" stroke="${IP_INK}" stroke-width="4"/>`
      : ''
    return `${stamp}
    <path d="${zhizhuOpenArc(outerR, version)}" fill="none" stroke="${IP_INK}" stroke-width="${IP_SILHOUETTE_STROKE}" stroke-linecap="round"/>
    <path d="${ribbon}" fill="none" stroke="${IP_INK}" stroke-width="${IP_SILHOUETTE_STROKE}" stroke-linecap="round"/>`
  }

  return `
    ${seal ? openSeal : ''}
    <path d="${zhizhuOpenArc(outerR, version)}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_OUTER}" stroke-linecap="round"/>
    <path d="${zhizhuOpenArc(innerR, version)}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_INNER}" stroke-linecap="round" opacity="0.72"/>
    <path d="${ribbon}" fill="none" stroke="${wash}" stroke-width="${seal ? 3.4 : 3.8}" stroke-linecap="round" opacity="0.88"/>
    ${inkTrail(ribbon, seal ? 2.2 : 2.4, 0.22)}
    ${flyingWhite(ribbon)}`
}

function jianweiFace(mode) {
  const halo =
    mode === 'color' || mode === 'gray'
      ? `<circle cx="48" cy="48" r="5.4" fill="${IP_PAPER}"/>`
      : ''
  return `${halo}<g class="ip-face" fill="${IP_INK}">
    <circle cx="42.2" cy="39.6" r="1.55"/>
    <circle cx="53.8" cy="39.6" r="1.55"/>
    <path d="M40.6 36.2q1.7 1.15 3.5 0.2" fill="none" stroke="${IP_INK}" stroke-width="1.15" stroke-linecap="round"/>
    <path d="M55.4 36.2q-1.7 1.15 -3.5 0.2" fill="none" stroke="${IP_INK}" stroke-width="1.15" stroke-linecap="round"/>
  </g>`
}

function zhizhuFace() {
  return `<g class="ip-face" fill="${IP_INK}">
    <circle cx="36.5" cy="33.2" r="1.55"/>
    <circle cx="46.4" cy="37.6" r="1.55"/>
  </g>`
}

function defs(role, id, vermillion) {
  if (role === 'jianwei') {
    return `<defs><radialGradient id="${id}" cx="42%" cy="38%" r="70%">
      <stop offset="0%" stop-color="${IP_PEACH[0]}"/>
      <stop offset="55%" stop-color="${IP_PEACH[1]}"/>
      <stop offset="100%" stop-color="${IP_PEACH[2]}"/>
    </radialGradient></defs>`
  }
  return `<defs><linearGradient id="${id}" x1="40" y1="40" x2="${vermillion.x}" y2="${vermillion.y}" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="${IP_MOUNTAIN[0]}"/>
    <stop offset="48%" stop-color="${IP_MOUNTAIN[1]}"/>
    <stop offset="100%" stop-color="${IP_MOUNTAIN[2]}"/>
  </linearGradient></defs>`
}

export function renderIpMarkSvg({
  version = 'a',
  role = 'jianwei',
  mode = 'color',
  detail = 'avatar',
  uid = 'ip',
  width,
  height,
  className = '',
  labeled = false,
} = {}) {
  const colors = palette(mode, role)
  const boneVersion = version === 'b' ? 'a' : version
  const vermillion = vermillionPoint(role, version)
  const showFace = version === 'b' && detail !== 'icon' && !isCutout(mode)
  const label = labeled ? `${version.toUpperCase()} ${role === 'zhizhu' ? '知著' : '见微'}` : ''
  const cinR = version === 'c' ? 2.6 : IP_CINNABAR_R
  const wrap = (transform, inner) =>
    transform ? `<g transform="${transform}">${inner}</g>` : `<g>${inner}</g>`
  const dotFill = mode === 'ink' ? IP_INK : IP_CINNABAR
  const dot = `<circle cx="${vermillion.x}" cy="${vermillion.y}" r="${cinR}" fill="${dotFill}"/>`
  const jianweiTilt = showFace ? 'rotate(-7 48 48)' : ''
  const zhizhuTilt = showFace ? `rotate(8 ${zhizhuOrigin('a').x} ${zhizhuOrigin('a').y})` : ''
  const body =
    role === 'zhizhu'
      ? wrap(
          zhizhuTilt,
          `${zhizhuBody({
            version: boneVersion,
            mode,
            colors,
            gradientId: uid,
          })}${showFace ? zhizhuFace() : ''}${dot}`,
        )
      : wrap(
          jianweiTilt,
          `${jianweiBody({
            version: boneVersion,
            mode,
            colors,
            gradientId: uid,
          })}${showFace ? jianweiFace(mode) : ''}${dot}`,
        )
  const sizeAttrs = [width ? `width="${width}"` : '', height ? `height="${height}"` : '']
    .filter(Boolean)
    .join(' ')
  const classAttr = className ? ` class="${className}"` : ''
  const labelAttr = labeled
    ? ` role="img" aria-label="${label}"`
    : ' role="presentation" aria-hidden="true"'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" ${sizeAttrs}${classAttr}${labelAttr} focusable="false">
    ${colors.gradient ? defs(role, uid, vermillion) : ''}
    ${body}
  </svg>`
}

export function markFileStem(version, role, mode = 'color') {
  const roleName = role === 'zhizhu' ? 'zhizhu' : 'jianwei'
  const modePart = mode === 'color' ? '' : `-${mode}`
  return `ip-${version}-${roleName}${modePart}`
}
