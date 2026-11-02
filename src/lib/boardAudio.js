/** 课堂白板音效。第一次点击后才会出声，避免自动播放被拦截。 */

let ctx

function context() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, when, duration, type = 'sine', volume = 0.07) {
  const audio = context()
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, when)
  gain.gain.setValueAtTime(volume, when)
  gain.gain.exponentialRampToValueAtTime(0.001, when + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(when)
  osc.stop(when + duration)
}

export function unlockAudio() {
  context()
}

export function playTap() {
  tone(740, context().currentTime, 0.045, 'triangle', 0.03)
}

export function playCorrect() {
  const start = context().currentTime
  tone(523, start, 0.12)
  tone(659, start + 0.09, 0.12)
  tone(784, start + 0.18, 0.22)
}

export function playWrong() {
  const start = context().currentTime
  tone(196, start, 0.16, 'triangle', 0.045)
  tone(165, start + 0.1, 0.2, 'triangle', 0.035)
}

export function playWin() {
  const start = context().currentTime
  ;[523, 659, 784, 1047].forEach((freq, index) => {
    tone(freq, start + index * 0.11, 0.22, 'sine', 0.06)
  })
}
