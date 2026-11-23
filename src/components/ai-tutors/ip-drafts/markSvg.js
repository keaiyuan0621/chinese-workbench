import { jianweiGatherArc, vermillionPoint, zhizhuFly, zhizhuOpenArc } from './geometry.js'
import {
  IP_CINNABAR,
  IP_CINNABAR_R,
  IP_INK,
  IP_MOUNTAIN,
  IP_PEACH,
  IP_STROKE_FLY,
  IP_STROKE_INNER,
  IP_STROKE_OUTER,
} from './tokens.js'

function palette(mode, role) {
  if (mode === 'silhouette') return { wash: IP_INK, gradient: false }
  if (mode === 'gray') return { wash: '#C2C2C2', gradient: false }
  return { wash: role === 'zhizhu' ? IP_MOUNTAIN[1] : IP_PEACH[1], gradient: true }
}

function flyingWhite(d, width = IP_STROKE_FLY) {
  return `<path d="${d}" fill="none" stroke="${IP_INK}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="3.4 4.2" opacity="0.82"/>`
}

function inkTrail(d, width = 4.2, opacity = 0.22) {
  return `<path d="${d}" fill="none" stroke="${IP_INK}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`
}

function jianweiBody({ version, mode, colors, gradientId }) {
  const seal = version === 'c'
  const outer = seal ? 32 : 29
  const mid = seal ? 21 : 19.5
  const inner = seal ? 11.5 : 10.5
  const fillR = seal ? 10 : mid
  const wash = colors.gradient ? `url(#${gradientId})` : colors.wash
  const fill =
    mode === 'silhouette'
      ? `<circle cx="48" cy="48" r="${outer}" fill="${IP_INK}"/>`
      : `<circle cx="48" cy="48" r="${fillR}" fill="${wash}" opacity="${seal ? 0.55 : 0.92}"/>`
  const innerRing = seal
    ? ''
    : `<circle cx="48" cy="48" r="${inner}" fill="none" stroke="${IP_INK}" stroke-width="2.4" stroke-dasharray="3.4 4.2" opacity="0.55"/>`
  const gather = flyingWhite(jianweiGatherArc(version), seal ? 3 : 2.4)
  return `${fill}
    <circle cx="48" cy="48" r="${outer}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_OUTER}"/>
    <circle cx="48" cy="48" r="${mid}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_INNER}" opacity="0.78"/>
    ${innerRing}
    ${gather}`
}

function zhizhuBody({ version, mode, colors, gradientId }) {
  const fly = zhizhuFly(version)
  const seal = version === 'c'
  const outerR = seal ? 28 : 25
  const innerR = seal ? 16 : 14.5
  const ribbon = `M ${fly.start.x} ${fly.start.y} Q ${fly.mid.x} ${fly.mid.y} ${fly.end.x} ${fly.end.y}`
  const wash = colors.gradient ? `url(#${gradientId})` : colors.wash
  const silhouette = mode === 'silhouette'
    ? `<path d="${ribbon}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_OUTER}" stroke-linecap="round"/>`
    : `<path d="${ribbon}" fill="none" stroke="${wash}" stroke-width="${seal ? 5.4 : 6.2}" stroke-linecap="round" opacity="0.88"/>`
  return `
    <path d="${zhizhuOpenArc(outerR, version)}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_OUTER}" stroke-linecap="round"/>
    <path d="${zhizhuOpenArc(innerR, version)}" fill="none" stroke="${IP_INK}" stroke-width="${IP_STROKE_INNER}" stroke-linecap="round" opacity="0.72"/>
    ${silhouette}
    ${inkTrail(ribbon, seal ? 3.6 : 3.2, 0.22)}
    ${flyingWhite(ribbon, seal ? 2.8 : IP_STROKE_FLY)}`
}

function jianweiFace() {
  return `<g fill="${IP_INK}">
    <circle cx="41.4" cy="41.2" r="1.9"/>
    <circle cx="54.6" cy="41.2" r="1.9"/>
    <path d="M40.2 37.6q1.4 1.2 3.4 0.2" fill="none" stroke="${IP_INK}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M55.8 37.6q-1.4 1.2 -3.4 0.2" fill="none" stroke="${IP_INK}" stroke-width="1.5" stroke-linecap="round"/>
  </g>`
}

function zhizhuFace() {
  return `<g fill="${IP_INK}">
    <circle cx="33.2" cy="33.4" r="1.9"/>
    <circle cx="44.8" cy="35.6" r="1.9"/>
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
  const showFace = version === 'b' && detail !== 'icon'
  const label = labeled ? `${version.toUpperCase()} ${role === 'zhizhu' ? '知著' : '见微'}` : ''
  const wrap = (transform, inner) =>
    transform ? `<g transform="${transform}">${inner}</g>` : `<g>${inner}</g>`
  const dot = `<circle cx="${vermillion.x}" cy="${vermillion.y}" r="${version === 'c' ? 4.1 : IP_CINNABAR_R}" fill="${IP_CINNABAR}"/>`
  const body =
    role === 'zhizhu'
      ? wrap(
          showFace ? 'rotate(10 38 38)' : '',
          `${zhizhuBody({
            version: boneVersion,
            mode,
            colors,
            gradientId: uid,
          })}${showFace ? zhizhuFace() : ''}${dot}`,
        )
      : wrap(
          showFace ? 'rotate(-8 48 48)' : '',
          `${jianweiBody({
            version: boneVersion,
            mode,
            colors,
            gradientId: uid,
          })}${showFace ? jianweiFace() : ''}${dot}`,
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
