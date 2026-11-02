import { useEffect, useMemo, useState } from 'react'
import { useKnowledgeTree } from '../../hooks/useKnowledgeTree.js'
import { fetchMaterials, getMaterialUrl, logMaterialView } from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.js'
import { CHAPTERS, MATERIAL_CATEGORIES } from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'

const TABS = ['全部', ...MATERIAL_CATEGORIES]

const TAB_STYLE = {
  全部: 'bg-coral-100 text-coral-600 ring-coral-100',
  核心必看: 'bg-coral-100 text-coral-600 ring-coral-100',
  拓展阅读: 'bg-mint-100 text-mint-600 ring-mint-100',
  参考教材: 'bg-lavender-100 text-lavender-600 ring-lavender-100',
}

const FILE_ICON = { pdf: '📄', ppt: '📊', pptx: '📊', doc: '📝', docx: '📝' }

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function Materials() {
  const { user } = useAuth()
  const { tree } = useKnowledgeTree()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(null)
  const [category, setCategory] = useState('全部')
  const [chapter, setChapter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchMaterials()
      .then((rows) => !cancelled && setItems(rows))
      .catch((err) => {
        if (cancelled) return
        setItems([])
        setError(zhError(err, '资料加载失败，请刷新重试'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(t)
  }, [notice])

  const chapterOf = useMemo(() => {
    const map = {}
    const walk = (node, name) => {
      map[node.id] = name
      for (const child of node.children ?? []) walk(child, name)
    }
    for (const ch of tree ?? []) walk(ch, ch.name)
    return map
  }, [tree])

  const visible = useMemo(() => {
    return (items ?? []).filter((m) => {
      if (category !== '全部' && m.category !== category) return false
      if (!chapter) return true
      const kpId = m.knowledge_point_id
      return Boolean(kpId) && chapterOf[kpId] === chapter
    })
  }, [items, category, chapter, chapterOf])

  async function open(m, download) {
    setBusy(`${m.id}-${download ? 'd' : 'v'}`)
    const w = download ? null : window.open('', '_blank')
    try {
      const filename = download ? `${m.title}${m.file_type ? `.${m.file_type}` : ''}` : undefined
      const url = await getMaterialUrl(m.file_url, { download: filename })
      if (download) {
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
      } else if (w) {
        w.location.href = url
      }
      if (user) logMaterialView(m.id, user.id)
    } catch (err) {
      w?.close()
      setNotice(zhError(err, '资料打开失败，请稍后再试'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="book-title text-2xl text-ink">资料宝库</h1>
        <p className="mt-1 text-sm text-gray-500">先选分类，再按需要打开。练习为主，资料为辅</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const on = category === tab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setCategory(tab)}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium ring-1 transition-colors ${
                  on ? TAB_STYLE[tab] : 'bg-white text-gray-500 ring-coral-100 hover:bg-coral-50'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-500">
          <span className="shrink-0">章节</span>
          <select
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="min-h-10 w-full rounded-full border-0 bg-mint-50 px-4 text-sm text-mint-600 ring-1 ring-mint-100 focus:outline-none focus:ring-2 focus:ring-mint-300 sm:w-40"
          >
            <option value="">全部章节</option>
            {CHAPTERS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && (
        <div className="rounded-student-sm bg-coral-50 text-coral-600 text-sm px-4 py-2.5 ring-1 ring-coral-100">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-student bg-coral-50 text-coral-600 text-sm px-5 py-4 ring-1 ring-coral-100">
          {error}
        </div>
      )}

      {items === null && !error && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-student-sm bg-white/70 animate-pulse" />
          ))}
        </div>
      )}

      {items !== null && items.length === 0 && !error && (
        <div className="rounded-student bg-white px-6 py-12 text-center ring-1 ring-coral-100">
          <div className="text-4xl">📭</div>
          <p className="mt-3 text-gray-500">老师还没有上传资料</p>
        </div>
      )}

      {items !== null && items.length > 0 && visible.length === 0 && (
        <div className="rounded-student bg-white px-6 py-10 text-center text-sm text-gray-500 ring-1 ring-mint-100">
          这个筛选条件下还没有资料
        </div>
      )}

      {visible.length > 0 && (
        <ul className="overflow-hidden rounded-student bg-white ring-1 ring-coral-100 divide-y divide-coral-50">
          {visible.map((m) => {
            const ext = m.file_type?.toLowerCase()
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <span className="shrink-0 text-xl" aria-hidden>
                  {FILE_ICON[ext] ?? '📎'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800" title={m.title}>
                    {m.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {m.category}
                    {m.knowledge_point ? ` · ${m.knowledge_point.name}` : ''}
                    {m.file_size ? ` · ${formatSize(m.file_size)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy === `${m.id}-v`}
                    onClick={() => open(m, false)}
                    className="inline-flex min-h-10 items-center rounded-full bg-mint-100 px-3 text-sm font-medium text-mint-600 hover:bg-mint-300/60 disabled:opacity-60"
                  >
                    查看
                  </button>
                  <button
                    type="button"
                    disabled={busy === `${m.id}-d`}
                    onClick={() => open(m, true)}
                    className="inline-flex min-h-10 items-center rounded-full bg-coral-100 px-3 text-sm font-medium text-coral-600 hover:bg-coral-300/50 disabled:opacity-60"
                  >
                    下载
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
