import assert from 'node:assert/strict'
import { test } from 'node:test'
import { vermillionPoint } from '../src/components/ai-tutors/ip-drafts/geometry.js'
import { renderIpMarkSvg } from '../src/components/ai-tutors/ip-drafts/markSvg.js'
import { IP_AXIS_DEG, IP_CINNABAR, IP_STROKE_OUTER } from '../src/components/ai-tutors/ip-drafts/tokens.js'
import { PEDAGOGY } from '../src/components/ai-tutors/ip-drafts/reviewCopy.js'

test('family rules share axis, stroke and cinnabar logic', () => {
  assert.equal(IP_AXIS_DEG, 42)
  assert.equal(IP_STROKE_OUTER, 6)
  const jianwei = vermillionPoint('jianwei', 'a')
  const zhizhu = vermillionPoint('zhizhu', 'a')
  assert.equal(jianwei.x, 48)
  assert.equal(jianwei.y, 48)
  assert.ok(zhizhu.x > jianwei.x)
  assert.ok(zhizhu.y > jianwei.y)
})

test('each version renders a 96 viewBox pair without peach/blue in gray mode', () => {
  for (const version of ['a', 'b', 'c']) {
    for (const role of ['jianwei', 'zhizhu']) {
      const color = renderIpMarkSvg({ version, role, mode: 'color', uid: `${version}-${role}-color` })
      const gray = renderIpMarkSvg({ version, role, mode: 'gray', uid: `${version}-${role}-gray` })
      const silhouette = renderIpMarkSvg({
        version,
        role,
        mode: 'silhouette',
        uid: `${version}-${role}-sil`,
      })
      assert.match(color, /viewBox="0 0 96 96"/)
      assert.match(color, new RegExp(IP_CINNABAR, 'i'))
      assert.doesNotMatch(gray, /#F4D0D7|#B2CDD7|#E9A2BB|#7CA8C8/i)
      assert.doesNotMatch(gray, /gradient/i)
      assert.doesNotMatch(silhouette, /gradient/i)
      assert.match(gray, new RegExp(IP_CINNABAR, 'i'))
      assert.match(silhouette, new RegExp(IP_CINNABAR, 'i'))
    }
  }
})

test('jianwei stays closed while zhizhu keeps an open arc', () => {
  const jianwei = renderIpMarkSvg({ version: 'a', role: 'jianwei', uid: 'j' })
  const zhizhu = renderIpMarkSvg({ version: 'a', role: 'zhizhu', uid: 'z' })
  assert.match(jianwei, /<circle cx="48" cy="48" r="29"/)
  assert.match(zhizhu, / A 25 25 0 1 1 /)
  assert.equal(jianwei.includes(' A 25 25 0 1 1 '), false)
})

test('B keeps A bones and only adds a face above icon size', () => {
  const icon = renderIpMarkSvg({ version: 'b', role: 'jianwei', detail: 'icon', uid: 'b-icon' })
  const avatar = renderIpMarkSvg({ version: 'b', role: 'jianwei', detail: 'avatar', uid: 'b-avatar' })
  assert.equal(icon.includes('rotate(-8 48 48)'), false)
  assert.equal(icon.includes('cx="41.4"'), false)
  assert.equal(avatar.includes('rotate(-8 48 48)'), true)
  assert.equal(avatar.includes('cx="41.4"'), true)
})

test('pedagogy samples include an open prompt where zhizhu withholds the answer', () => {
  assert.equal(PEDAGOGY.length, 3)
  const open = PEDAGOGY.find((item) => item.course.includes('开放'))
  assert.ok(open)
  assert.match(open.zhizhu, /不要写「这句话很好」|想到哪一步/)
  assert.equal(open.zhizhu.includes('标准答案'), false)
  assert.equal(open.zhizhu.includes('参考范文'), false)
})
