import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sealFramePath, vermillionPoint } from '../src/components/ai-tutors/ip-drafts/geometry.js'
import { renderIpMarkSvg } from '../src/components/ai-tutors/ip-drafts/markSvg.js'
import { ACCEPTANCE, PEDAGOGY, VERSION_CLAIMS } from '../src/components/ai-tutors/ip-drafts/reviewCopy.js'
import { IP_AXIS_DEG, IP_CINNABAR, IP_STROKE_OUTER } from '../src/components/ai-tutors/ip-drafts/tokens.js'
import { expectationResult, pairingCorrect, randomPairOrder } from '../src/components/ai-tutors/ip-drafts/trials.js'

test('family rules share axis, stroke and cinnabar logic', () => {
  assert.equal(IP_AXIS_DEG, 42)
  assert.equal(IP_STROKE_OUTER, 2.2)
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
      const ink = renderIpMarkSvg({ version, role, mode: 'ink', uid: `${version}-${role}-ink` })
      assert.doesNotMatch(ink, /gradient/i)
      assert.doesNotMatch(ink, /#F4D0D7|#B2CDD7|#E9A2BB|#7CA8C8|#B54434/i)
    }
  }
})

test('C zhizhu fly breaks the seal while jianwei stays inside', () => {
  const jianwei = vermillionPoint('jianwei', 'c')
  const zhizhu = vermillionPoint('zhizhu', 'c')
  assert.equal(jianwei.x, 48)
  assert.ok(zhizhu.x > 88)
  assert.equal(sealFramePath(false).includes(' Z'), true)
  assert.equal(sealFramePath(true).includes(' Z'), false)
  const cZhizhu = renderIpMarkSvg({ version: 'c', role: 'zhizhu', uid: 'c-open' })
  assert.match(cZhizhu, /ip-seal/)
  assert.match(cZhizhu, /M 17 8/)
})

test('jianwei stays closed while zhizhu keeps an open arc', () => {
  const jianwei = renderIpMarkSvg({ version: 'a', role: 'jianwei', uid: 'j' })
  const zhizhu = renderIpMarkSvg({ version: 'a', role: 'zhizhu', uid: 'z' })
  assert.match(jianwei, /<circle cx="48" cy="48" r="/)
  assert.match(zhizhu, / A [\d.]+ [\d.]+ 0 1 1 /)
  assert.equal(/ A [\d.]+ [\d.]+ 0 1 1 /.test(jianwei), false)
})

test('B keeps A bones and only adds a face above icon size', () => {
  const icon = renderIpMarkSvg({ version: 'b', role: 'jianwei', detail: 'icon', uid: 'b-icon' })
  const avatar = renderIpMarkSvg({ version: 'b', role: 'jianwei', detail: 'avatar', uid: 'b-avatar' })
  assert.equal(icon.includes('ip-face'), false)
  assert.equal(icon.includes('rotate('), false)
  assert.equal(avatar.includes('ip-face'), true)
  assert.equal(avatar.includes('rotate(-7 48 48)'), true)
  assert.equal(avatar.includes('ip-seal'), false)
})

test('C uses a seal frame while A does not', () => {
  const a = renderIpMarkSvg({ version: 'a', role: 'jianwei', uid: 'a-seal' })
  const c = renderIpMarkSvg({ version: 'c', role: 'jianwei', uid: 'c-seal' })
  assert.equal(a.includes('ip-seal'), false)
  assert.equal(c.includes('ip-seal'), true)
})

test('pedagogy samples include an open prompt where zhizhu withholds the answer', () => {
  assert.equal(PEDAGOGY.length, 3)
  for (const item of PEDAGOGY) {
    assert.ok(item.answer)
    assert.ok(item.explanation)
    assert.ok(item.jianwei)
    assert.ok(item.zhizhu)
  }
  const open = PEDAGOGY.find((item) => item.course.includes('开放'))
  assert.ok(open)
  assert.match(open.zhizhu, /不要写「这句话很好」|想到哪一步/)
  assert.equal(open.zhizhu.includes('标准答案'), false)
  assert.equal(open.zhizhu.includes('参考范文'), false)
  assert.match(open.answer, /自行完成/)
})

test('acceptance protocol names testers, 3-second hide, and anti-example', () => {
  assert.match(ACCEPTANCE.testers, /未参与设计/)
  assert.match(ACCEPTANCE.timing, /展示 3 秒后立即撤图/)
  assert.match(ACCEPTANCE.order, /左右随机/)
  assert.match(ACCEPTANCE.sil32, /极限墨色/)
  assert.match(ACCEPTANCE.anti, /直接给答案/)
  assert.ok(VERSION_CLAIMS.a.jianwei)
  assert.ok(VERSION_CLAIMS.c.zhizhu)
})

test('pairing and anti-example helpers record evidence without judging a winner', () => {
  assert.equal(pairingCorrect(['jianwei', 'zhizhu'], 'left'), true)
  assert.equal(pairingCorrect(['zhizhu', 'jianwei'], 'left'), false)
  assert.deepEqual(randomPairOrder(() => 0.1), ['jianwei', 'zhizhu'])
  assert.deepEqual(randomPairOrder(() => 0.9), ['zhizhu', 'jianwei'])
  assert.equal(expectationResult('answer').anti, true)
  assert.equal(expectationResult('hint').anti, false)
})
