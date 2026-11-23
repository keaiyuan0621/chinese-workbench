import { useState } from 'react'
import {
  C_VS_EXISTING,
  LEDGER_CHOICES,
  LEDGER_KEY,
  REVIEW_ROWS,
} from './reviewCopy.js'

const emptyLedger = () => ({
  rows: Object.fromEntries(REVIEW_ROWS.map((row) => [row.id, { a: '', b: '', c: '', evidence: '' }])),
  cChoice: '',
  signs: { visual: '', interaction: '', pedagogy: '' },
  savedAt: '',
})

function loadLedger() {
  const base = emptyLedger()
  if (typeof window === 'undefined') return base
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw)
    return {
      ...base,
      ...parsed,
      rows: { ...base.rows, ...parsed.rows },
      signs: { ...base.signs, ...parsed.signs },
      savedAt: parsed.savedAt || '',
    }
  } catch {
    return base
  }
}

export default function ReviewLedger() {
  const [ledger, setLedger] = useState(loadLedger)
  const savedAt = ledger.savedAt || ''

  function patch(next) {
    setLedger(next)
  }

  function setCell(id, key, value) {
    patch({
      ...ledger,
      rows: {
        ...ledger.rows,
        [id]: { ...ledger.rows[id], [key]: value },
      },
    })
  }

  function save() {
    const saved = { ...ledger, savedAt: new Date().toISOString() }
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(saved))
    setLedger(saved)
  }

  function exportText() {
    const lines = [
      '见微 / 知著 三版评审记录',
      `保存时间：${savedAt || '未保存'}`,
      `C 版与现有 SVG：${ledger.cChoice || '未选'}`,
      '',
      ...REVIEW_ROWS.map((row) => {
        const cell = ledger.rows[row.id] || {}
        return `${row.label}\n  A:${cell.a || '待签'} B:${cell.b || '待签'} C:${cell.c || '待签'}\n  证据：${cell.evidence || '（空）'}`
      }),
      '',
      `视觉签字：${ledger.signs.visual || '（空）'}`,
      `交互签字：${ledger.signs.interaction || '（空）'}`,
      `教研签字：${ledger.signs.pedagogy || '（空）'}`,
    ]
    return lines.join('\n')
  }

  async function copy() {
    await navigator.clipboard.writeText(exportText())
  }

  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl">评审记录（三方各签一行）</h2>
      <p className="text-sm text-ink/60">
        Cursor 不裁结论。每项需附证据。记录只存在本机，接入 PR 前由三方签署后粘贴。
      </p>
      <table>
        <thead>
          <tr>
            <th>项目</th>
            <th>A</th>
            <th>B</th>
            <th>C</th>
            <th>证据</th>
          </tr>
        </thead>
        <tbody>
          {REVIEW_ROWS.map((row) => {
            const cell = ledger.rows[row.id] || { a: '', b: '', c: '', evidence: '' }
            return (
              <tr key={row.id}>
                <td>{row.label}</td>
                {['a', 'b', 'c'].map((key) => (
                  <td key={key}>
                    <select
                      value={cell[key]}
                      onChange={(event) => setCell(row.id, key, event.target.value)}
                      aria-label={`${row.label} ${key.toUpperCase()}`}
                    >
                      {LEDGER_CHOICES.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
                <td>
                  <input
                    value={cell.evidence}
                    onChange={(event) => setCell(row.id, 'evidence', event.target.value)}
                    placeholder="截图、口述或样例"
                    aria-label={`${row.label} 证据`}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <fieldset className="space-y-2">
        <legend className="text-sm">{C_VS_EXISTING.question}</legend>
        {C_VS_EXISTING.options.map((option) => (
          <label key={option} className="block text-sm">
            <input
              type="radio"
              name="c-vs-existing"
              value={option}
              checked={ledger.cChoice === option}
              onChange={(event) => patch({ ...ledger, cChoice: event.target.value })}
            />{' '}
            {option}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 pt-2 sm:grid-cols-3">
        {[
          ['visual', '视觉'],
          ['interaction', '交互'],
          ['pedagogy', '教研'],
        ].map(([id, label]) => (
          <label key={id} className="text-sm">
            {label}签字
            <input
              className="ip-drafts-sign-input ml-2"
              value={ledger.signs[id]}
              onChange={(event) =>
                patch({ ...ledger, signs: { ...ledger.signs, [id]: event.target.value } })
              }
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ip-drafts-action" onClick={save}>
          保存到本机
        </button>
        <button type="button" className="ip-drafts-action" onClick={copy}>
          复制记录
        </button>
        {savedAt ? <span className="self-center text-xs text-ink/45">{savedAt}</span> : null}
      </div>
    </section>
  )
}
