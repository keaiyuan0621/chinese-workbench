import { useEffect, useState } from 'react'
import IpMark from './IpMark.jsx'
import { EXPECTATION_CHOICES, pairingCorrect, randomPairOrder, TRIAL_MS, expectationResult } from './trials.js'
import { IP_ROLES, IP_VERSIONS } from './tokens.js'

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

function PairStage({ order, version, mode, size, hidden }) {
  if (hidden) {
    return <div className={`ip-drafts-stage ip-drafts-stage--${size}`} aria-hidden="true" />
  }
  return (
    <div className={`ip-drafts-stage ip-drafts-stage--${size}`} aria-live="polite">
      {order.map((role, index) => (
        <figure key={role} className="flex flex-col items-center gap-1">
          <div className={`ip-drafts-mark ip-drafts-mark--${size}`}>
            <IpMark
              version={version}
              role={role}
              mode={mode}
              detail={mode === 'color' ? 'avatar' : 'icon'}
            />
          </div>
          <figcaption className="text-xs text-ink/40">{index === 0 ? '左' : '右'}</figcaption>
        </figure>
      ))}
    </div>
  )
}

export function RecognitionTrial() {
  const reduced = useReducedMotion()
  const [version, setVersion] = useState('a')
  const [kind, setKind] = useState('ink32')
  const [phase, setPhase] = useState('idle')
  const [order, setOrder] = useState(['jianwei', 'zhizhu'])
  const [log, setLog] = useState([])

  const mode = kind === 'color96' ? 'color' : kind === 'sil32' ? 'silhouette' : 'ink'
  const size = kind === 'color96' ? '96' : '32'

  useEffect(() => {
    if (phase !== 'showing' || reduced) return undefined
    const timer = window.setTimeout(() => setPhase('answering'), TRIAL_MS)
    return () => window.clearTimeout(timer)
  }, [phase, reduced])

  function start() {
    setOrder(randomPairOrder())
    setPhase('showing')
  }

  function answer(inwardSide) {
    const correct = pairingCorrect(order, inwardSide)
    setLog((prev) => [
      ...prev,
      {
        version,
        kind,
        order: `${order[0]}-${order[1]}`,
        inwardSide,
        correct,
        at: new Date().toLocaleTimeString(),
      },
    ])
    setPhase('idle')
  }

  const showing = phase === 'showing'
  const answering = phase === 'answering'

  return (
    <section className="space-y-3 rounded-lg border-[0.5px] border-gold bg-white/80 p-4">
      <h3 className="font-serif text-lg">轮廓辨识试次（本机记录，不代替 10 人实测）</h3>
      <p className="text-sm text-ink/65">
        无字、无角色名。展示 {TRIAL_MS / 1000} 秒后立即撤图，凭记忆配对。极限墨色稿的朱砂也用同一墨色。
      </p>
      <div className="flex flex-wrap gap-2">
        {IP_VERSIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ip-drafts-pill${version === item.id ? ' is-on' : ''}`}
            onClick={() => setVersion(item.id)}
            disabled={phase !== 'idle'}
          >
            {item.id.toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          className={`ip-drafts-pill${kind === 'ink32' ? ' is-on' : ''}`}
          onClick={() => setKind('ink32')}
          disabled={phase !== 'idle'}
        >
          32px 极限墨色
        </button>
        <button
          type="button"
          className={`ip-drafts-pill${kind === 'sil32' ? ' is-on' : ''}`}
          onClick={() => setKind('sil32')}
          disabled={phase !== 'idle'}
        >
          32px 剪影+朱砂
        </button>
        <button
          type="button"
          className={`ip-drafts-pill${kind === 'color96' ? ' is-on' : ''}`}
          onClick={() => setKind('color96')}
          disabled={phase !== 'idle'}
        >
          96px 彩色
        </button>
      </div>

      {phase === 'idle' ? (
        <button type="button" className="ip-drafts-action" onClick={start}>
          开始一组（3 秒后撤图）
        </button>
      ) : (
        <>
          <PairStage order={order} version={version} mode={mode} size={size} hidden={phase === 'answering'} />
          {showing && reduced ? (
            <button type="button" className="ip-drafts-action" onClick={() => setPhase('answering')}>
              撤图作答
            </button>
          ) : null}
          {answering ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="ip-drafts-action" onClick={() => answer('left')}>
                向内聚焦在左
              </button>
              <button type="button" className="ip-drafts-action" onClick={() => answer('right')}>
                向内聚焦在右
              </button>
            </div>
          ) : showing ? (
            <p className="text-sm text-ink/50">看 3 秒，不要边看边答。</p>
          ) : null}
        </>
      )}

      {log.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>版</th>
              <th>规格</th>
              <th>左右</th>
              <th>作答</th>
              <th>对错</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {log.map((row, index) => (
              <tr key={`${row.at}-${index}`}>
                <td>{row.version.toUpperCase()}</td>
                <td>{row.kind}</td>
                <td>{row.order}</td>
                <td>{row.inwardSide === 'left' ? '左' : '右'}</td>
                <td>{row.correct ? '对' : '错'}</td>
                <td>{row.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}

export function ExpectationTrial() {
  const [version, setVersion] = useState('a')
  const [log, setLog] = useState([])

  function choose(choiceId) {
    const result = expectationResult(choiceId)
    const choice = EXPECTATION_CHOICES.find((item) => item.id === choiceId)
    setLog((prev) => [
      ...prev,
      {
        version,
        choice: choice?.label,
        anti: result.anti,
        unclear: result.unclear,
        at: new Date().toLocaleTimeString(),
      },
    ])
  }

  return (
    <section className="space-y-3 rounded-lg border-[0.5px] border-gold bg-white/80 p-4">
      <h3 className="font-serif text-lg">入口预期 / 反例（本机记录）</h3>
      <p className="text-sm text-ink/65">
        只看知著入口。若有人认为「点了会直接给答案」，该版未通过。Cursor 不代填结论。
      </p>
      <div className="flex flex-wrap gap-2">
        {IP_VERSIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ip-drafts-pill${version === item.id ? ' is-on' : ''}`}
            onClick={() => setVersion(item.id)}
          >
            {item.id.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="ip-drafts-chip max-w-md">
        <IpMark version={version} role="zhizhu" detail="avatar" className="h-11 w-11" />
        <div>
          <strong>{IP_ROLES.zhizhu.entry}</strong>
          <span>点了之后，你预期会发生什么？</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXPECTATION_CHOICES.map((item) => (
          <button key={item.id} type="button" className="ip-drafts-action" onClick={() => choose(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {log.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>版</th>
              <th>口述/选项</th>
              <th>反例</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {log.map((row, index) => (
              <tr key={`${row.at}-${index}`}>
                <td>{row.version.toUpperCase()}</td>
                <td>{row.choice}</td>
                <td>{row.anti ? '失败：预期给答案' : row.unclear ? '不清' : '通过'}</td>
                <td>{row.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}
