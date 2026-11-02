import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Loading,
  Notice,
  PageHeader,
  Table,
  formatDate,
  inputClass,
} from '../../components/teacher/ui.jsx'
import { useKnowledgeTree } from '../../hooks/useKnowledgeTree.js'
import QuestionImport from '../../components/teacher/QuestionImport.jsx'
import { deleteMaterial, fetchMaterials, getMaterialUrl, uploadMaterial } from '../../lib/api.js'
import { useAuth } from '../../lib/auth-context.js'
import { MATERIAL_CATEGORIES } from '../../lib/constants.js'
import { zhError } from '../../lib/errors.js'
import { recognizeFile } from '../../lib/recognizeQuestions.js'

const ACCEPT = '.pdf,.ppt,.pptx,.doc,.docx'
const ALLOWED_EXT = ['pdf', 'ppt', 'pptx', 'doc', 'docx']
const MAX_SIZE = 50 * 1024 * 1024

const CATEGORY_BADGE = {
  核心必看: 'bg-red-50 text-red-600',
  拓展阅读: 'bg-emerald-50 text-emerald-700',
  参考教材: 'bg-navy-50 text-navy-700',
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '')
}

function formatSize(bytes) {
  if (!bytes) return '—'
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function TeacherMaterials() {
  const { user } = useAuth()
  const { tree } = useKnowledgeTree()

  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [pending, setPending] = useState([]) // 待上传文件的表单 [{ id, file, title, category, kpId, status, error }]
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef(null)

  const [filterCat, setFilterCat] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [importBatch, setImportBatch] = useState(null)
  const [recognizingId, setRecognizingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchMaterials()
      .then((rows) => !cancelled && setItems(rows))
      .catch((err) => {
        if (cancelled) return
        setItems([])
        setError(zhError(err, '资料列表加载失败'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 3000)
    return () => clearTimeout(t)
  }, [notice])

  // ---------- 选择文件 ----------
  function addFiles(fileList) {
    const next = []
    for (const file of Array.from(fileList)) {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      let err = ''
      if (!ALLOWED_EXT.includes(ext)) err = '仅支持 PDF、PPT、Word 文件'
      else if (file.size > MAX_SIZE) err = '文件超过 50 MB 限制'
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        title: stripExt(file.name),
        category: '核心必看',
        kpId: '',
        status: err ? 'invalid' : 'ready',
        error: err,
      })
    }
    setPending((prev) => [...prev, ...next])
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
  }

  const updatePending = (id, patch) =>
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  // ---------- 上传 ----------
  async function uploadAll() {
    const ready = pending.filter((p) => p.status === 'ready')
    if (!ready.length) return
    for (const p of ready) {
      if (!p.title.trim()) {
        updatePending(p.id, { error: '请填写资料标题' })
        return
      }
    }
    setUploading(true)
    let ok = 0
    const recognized = []
    for (const p of ready) {
      updatePending(p.id, { status: 'uploading', error: '' })
      try {
        const row = await uploadMaterial(p.file, {
          title: p.title.trim(),
          category: p.category,
          knowledgePointId: p.kpId || null,
          uploadedBy: user?.id,
        })
        setItems((prev) => [row, ...(prev ?? [])])
        setPending((prev) => prev.filter((x) => x.id !== p.id))
        ok++
        try {
          const found = await recognizeFile(p.file)
          if (found.drafts.length) {
            recognized.push({ materialId: row.id, title: row.title, source: found.source, drafts: found.drafts })
          }
        } catch (err) {
          setNotice(zhError(err, `「${p.title.trim()}」已上传，但没有识别出题目`))
        }
      } catch (err) {
        updatePending(p.id, { status: 'ready', error: zhError(err, '上传失败，请重试') })
      }
    }
    setUploading(false)
    if (recognized.length) setImportBatch(recognized[0])
    if (ok) {
      const extra = recognized.length ? `，已识别 ${recognized[0].drafts.length} 道题` : '，未识别出题目'
      setNotice(`成功上传 ${ok} 份资料${extra}`)
    }
  }

  async function recognizeExisting(material) {
    setRecognizingId(material.id)
    setError('')
    try {
      const url = await getMaterialUrl(material.file_url)
      const res = await fetch(url)
      if (!res.ok) throw new Error('文件读取失败')
      const blob = await res.blob()
      const ext = material.file_type || 'pdf'
      const file = new File([blob], `${material.title}.${ext}`, { type: blob.type })
      const found = await recognizeFile(file)
      if (!found.drafts.length) {
        setNotice('这份资料里没有识别出带题号的练习题')
        return
      }
      setImportBatch({ materialId: material.id, title: material.title, source: found.source, drafts: found.drafts })
    } catch (err) {
      setError(zhError(err, '识别失败'))
    } finally {
      setRecognizingId(null)
    }
  }

  // ---------- 删除 / 预览 ----------
  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteMaterial(toDelete)
      setItems((prev) => prev.filter((m) => m.id !== toDelete.id))
      setNotice(`已删除「${toDelete.title}」`)
      setToDelete(null)
    } catch (err) {
      setNotice(zhError(err, '删除失败'))
    } finally {
      setDeleting(false)
    }
  }

  async function preview(m) {
    const w = window.open('', '_blank')
    try {
      const url = await getMaterialUrl(m.file_url)
      if (w) w.location.href = url
    } catch (err) {
      w?.close()
      setNotice(zhError(err, '预览失败'))
    }
  }

  const list = (items ?? []).filter((m) => !filterCat || m.category === filterCat)
  const readyCount = pending.filter((p) => p.status === 'ready').length

  return (
    <div className="space-y-5">
      <PageHeader
        title="资料管理"
        desc="上传后自动按黄伯荣、廖序东《现代汉语》增订七版识别练习题，核对后进入题库"
      />

      <Notice>{notice}</Notice>
      {error && <Notice tone="error">{error}</Notice>}

      {importBatch && (
        <QuestionImport
          batch={importBatch}
          tree={tree}
          userId={user?.id}
          onClose={() => setImportBatch(null)}
          onSaved={(saved, skipped) => {
            setImportBatch(null)
            setNotice(skipped ? `已入库 ${saved} 题，跳过 ${skipped} 道重复题` : `已入库 ${saved} 题`)
          }}
        />
      )}

      {/* 拖拽区 */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        className={`rounded-teacher border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-navy-500 bg-navy-50' : 'border-gray-300 bg-white hover:border-navy-300'
        }`}
      >
        <div className="text-3xl">📤</div>
        <p className="mt-2 text-sm text-gray-700">将 PPT、Word、PDF 文件拖到这里，或点击选择文件</p>
        <p className="mt-1 text-xs text-gray-400">单个文件不超过 50 MB，可一次选择多个</p>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* 待上传表单 */}
      {pending.length > 0 && (
        <Card
          title={`待上传（${pending.length}）`}
          extra={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={uploading} onClick={() => setPending([])}>
                清空
              </Button>
              <Button size="sm" disabled={uploading || readyCount === 0} onClick={uploadAll}>
                {uploading ? '上传中…' : `开始上传（${readyCount}）`}
              </Button>
            </div>
          }
        >
          <ul className="divide-y divide-gray-100">
            {pending.map((p) => (
              <li key={p.id} className="p-4 grid gap-3 md:grid-cols-[1fr_1fr_160px_1fr_auto] md:items-start">
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 truncate" title={p.file.name}>
                    {p.file.name} · {formatSize(p.file.size)}
                  </div>
                  <input
                    className={`${inputClass} w-full mt-1`}
                    value={p.title}
                    disabled={p.status !== 'ready'}
                    placeholder="请输入资料标题"
                    onChange={(e) => updatePending(p.id, { title: e.target.value })}
                  />
                </div>

                <label className="block">
                  <span className="text-xs text-gray-400">分类（必选）</span>
                  <select
                    className={`${inputClass} w-full mt-1`}
                    value={p.category}
                    disabled={p.status !== 'ready'}
                    onChange={(e) => updatePending(p.id, { category: e.target.value })}
                  >
                    {MATERIAL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="text-xs text-gray-400 md:pt-6">
                  {p.status === 'uploading' && <span className="text-navy-600">上传中…</span>}
                  {p.status === 'invalid' && <span className="text-red-600">{p.error}</span>}
                  {p.status === 'ready' && p.error && <span className="text-red-600">{p.error}</span>}
                </div>

                <label className="block">
                  <span className="text-xs text-gray-400">关联知识点（可选）</span>
                  <KnowledgeSelect
                    tree={tree}
                    value={p.kpId}
                    disabled={p.status !== 'ready'}
                    onChange={(v) => updatePending(p.id, { kpId: v })}
                  />
                </label>

                <Button
                  variant="ghost"
                  size="sm"
                  className="md:mt-6"
                  disabled={p.status === 'uploading'}
                  onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                >
                  移除
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 已上传列表 */}
      <Card
        title={`已上传资料（${list.length}）`}
        extra={
          <select className={`${inputClass} py-1`} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">全部分类</option>
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        }
      >
        {items === null ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty text={filterCat ? '该分类下暂无资料' : '还没有上传任何资料'} />
        ) : (
          <Table
            head={[
              { label: '标题' },
              { label: '分类', className: 'w-28' },
              { label: '关联知识点', className: 'w-40' },
              { label: '格式', className: 'w-20' },
              { label: '大小', className: 'w-24 text-right' },
              { label: '上传时间', className: 'w-32' },
              { label: '操作', className: 'w-40 text-right' },
            ]}
          >
            {list.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-800 font-medium">{m.title}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded px-2 py-0.5 text-xs ${CATEGORY_BADGE[m.category] ?? ''}`}>{m.category}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{m.knowledge_point?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-500 uppercase">{m.file_type}</td>
                <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{formatSize(m.file_size)}</td>
                <td className="px-4 py-2.5 text-gray-500">{formatDate(m.uploaded_at)}</td>
                <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                  <button
                    type="button"
                    disabled={recognizingId === m.id}
                    onClick={() => recognizeExisting(m)}
                    className="text-navy-600 hover:underline disabled:opacity-50"
                  >
                    {recognizingId === m.id ? '识别中…' : '识别题目'}
                  </button>
                  <button type="button" onClick={() => preview(m)} className="text-navy-600 hover:underline">
                    预览
                  </button>
                  <button type="button" onClick={() => setToDelete(m)} className="text-red-600 hover:underline">
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {toDelete && (
        <ConfirmDialog
          title="确认删除资料"
          desc={`将同时删除文件「${toDelete.title}」，学生端不再可见，此操作无法撤销。`}
          confirmText="确认删除"
          danger
          busy={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}

/** 知识点下拉：章节作为分组，章节本身也可选 */
export function KnowledgeSelect({ tree, value, onChange, disabled, className = '' }) {
  return (
    <select
      className={`${inputClass} w-full mt-1 ${className}`}
      value={value}
      disabled={disabled || !tree}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{tree ? '不关联' : '加载中…'}</option>
      {(tree ?? []).map((ch) => (
        <optgroup key={ch.id} label={ch.name}>
          <option value={ch.id}>{ch.name}（整章）</option>
          {ch.children.map((kp) => (
            <option key={kp.id} value={kp.id}>
              {ch.name} - {kp.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
