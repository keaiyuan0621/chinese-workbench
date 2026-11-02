/** 教师端通用小组件：克制、紧凑、小圆角 */

export function PageHeader({ title, desc, children }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl text-ink">{title}</h1>
        {desc && <p className="mt-1 text-sm text-gray-500">{desc}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  )
}

export function Card({ title, extra, children, className = '' }) {
  return (
    <section className={`rounded-lg border-[0.5px] border-gold bg-white ${className}`}>
      {(title || extra) && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }) {
  const v = {
    primary: 'bg-navy-700 text-white hover:bg-navy-800',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-navy-600 hover:bg-navy-50',
  }[variant]
  const s = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'
  return (
    <button
      type="button"
      className={`rounded-teacher font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${v} ${s} ${className}`}
      {...rest}
    />
  )
}

export const inputClass =
  'rounded-teacher border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-500 disabled:opacity-60'

export function Notice({ tone = 'info', children }) {
  if (!children) return null
  const cls = {
    info: 'bg-navy-50 border-navy-100 text-navy-700',
    error: 'bg-red-50 border-red-100 text-red-600',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  }[tone]
  return (
    <div role="status" className={`rounded-teacher border text-sm px-4 py-2 ${cls}`}>
      {children}
    </div>
  )
}

export function Empty({ text }) {
  return <div className="p-10 text-center text-sm text-gray-400">{text}</div>
}

export function Loading() {
  return <div className="p-6 text-sm text-gray-400">加载中…</div>
}

export function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-left">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={`px-4 py-2.5 font-medium whitespace-nowrap ${h.className ?? ''}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  )
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
            value === it.value
              ? 'border-navy-600 text-navy-700 font-medium'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {it.label}
          {it.count != null && <span className="ml-1.5 text-xs text-gray-400">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function ConfirmDialog({ title, desc, confirmText = '确认', danger, busy, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={() => !busy && onCancel()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-teacher bg-white shadow-xl border border-gray-200 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {desc && <p className="mt-2 text-sm text-gray-600">{desc}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            取消
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>
            {busy ? '处理中…' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function formatDate(iso, withTime = false) {
  if (!iso) return '—'
  const d = new Date(iso)
  return withTime
    ? d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
