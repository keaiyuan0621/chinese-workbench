export function randomPairOrder(random = Math.random) {
  return random() < 0.5 ? ['jianwei', 'zhizhu'] : ['zhizhu', 'jianwei']
}

/** inwardSide: 'left' | 'right' — 受测者认为「向内聚焦」在哪一侧。 */
export function pairingCorrect(order, inwardSide) {
  const leftIsJianwei = order[0] === 'jianwei'
  return inwardSide === 'left' ? leftIsJianwei : !leftIsJianwei
}

export const EXPECTATION_CHOICES = [
  { id: 'hint', label: '给一个提示，让我自己往下想', anti: false, unclear: false },
  { id: 'answer', label: '会直接把答案或成品给我', anti: true, unclear: false },
  { id: 'unsure', label: '看不出来会怎样', anti: false, unclear: true },
]

export function expectationResult(choiceId) {
  const choice = EXPECTATION_CHOICES.find((item) => item.id === choiceId)
  if (!choice) return { anti: false, unclear: true }
  return { anti: choice.anti, unclear: choice.unclear }
}

export const TRIAL_MS = 3000
