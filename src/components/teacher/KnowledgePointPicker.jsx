import { useEffect, useRef, useState } from 'react'
import {
  knowledgeAncestorIds,
  knowledgeExpandableIds,
  knowledgePathLabel,
} from '../../lib/knowledgeTree.js'

function Branch({ node, depth, expanded, selectedId, onToggle, onSelect }) {
  const children = node.children ?? []
  const open = expanded.has(node.id)
  const selected = node.id === selectedId

  return (
    <div>
      <div className="flex items-stretch" style={{ paddingLeft: `${depth * 14}px` }}>
        {children.length ? (
          <button
            type="button"
            aria-label={open ? `收起${node.name}` : `展开${node.name}`}
            aria-expanded={open}
            onClick={() => onToggle(node.id)}
            className="w-7 shrink-0 text-xs text-gray-400 hover:text-navy-700"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-7 shrink-0" />
        )}
        <button
          type="button"
          data-selected={selected ? 'true' : undefined}
          onClick={() => onSelect(node.id)}
          className={`min-w-0 flex-1 truncate px-1 py-1.5 text-left text-sm ${
            selected ? 'bg-navy-50 font-medium text-navy-800' : 'text-gray-700 hover:bg-gray-50'
          } ${depth === 0 ? 'font-medium' : ''}`}
        >
          {node.name}
        </button>
      </div>
      {open &&
        children.map((child) => (
          <Branch
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            selectedId={selectedId}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </div>
  )
}

/** 教师题库的知识点筛选：默认只显示章节，按层级展开。 */
export default function KnowledgePointPicker({ tree, value, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())
  const rootRef = useRef(null)
  const ready = Array.isArray(tree)
  const label = value && ready ? knowledgePathLabel(tree, value) || '全部知识点' : '全部知识点'

  useEffect(() => {
    if (!open) return undefined
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || !value) return undefined
    const selected = rootRef.current?.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
    return undefined
  }, [open, value, expanded])

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev
      if (next) setExpanded(new Set(value ? knowledgeAncestorIds(tree ?? [], value) : []))
      return next
    })
  }

  function toggleNode(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function choose(id) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="tree"
        aria-expanded={open}
        aria-label="按知识点筛选"
        disabled={!ready}
        onClick={toggleOpen}
        className={`flex w-72 items-center justify-between gap-2 text-left disabled:opacity-60 ${className}`}
      >
        <span className="truncate">{ready ? label : '正在加载知识点…'}</span>
        <span className="shrink-0 text-xs text-gray-400">{open ? '▴' : '▾'}</span>
      </button>

      {open && ready && (
        <div className="absolute left-0 z-30 mt-1 flex max-h-96 w-80 flex-col rounded-teacher border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center gap-1 border-b border-gray-100 px-2 py-2">
            <button
              type="button"
              onClick={() => choose('')}
              className={`rounded-teacher px-2 py-1 text-xs ${
                value ? 'text-gray-600 hover:bg-gray-100' : 'bg-navy-50 font-medium text-navy-800'
              }`}
            >
              全部知识点
            </button>
            <button
              type="button"
              onClick={() => setExpanded(new Set(knowledgeExpandableIds(tree)))}
              className="rounded-teacher px-2 py-1 text-xs text-navy-700 hover:bg-navy-50"
            >
              展开全部
            </button>
            <button
              type="button"
              onClick={() => setExpanded(new Set())}
              className="rounded-teacher px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              收起全部
            </button>
          </div>
          <p className="px-3 py-1.5 text-xs text-gray-400">点箭头展开下级，点名称筛选该层和下级</p>
          <div role="tree" className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
            {tree.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-400">暂无知识点</p>
            ) : (
              tree.map((chapter) => (
                <Branch
                  key={chapter.id}
                  node={chapter}
                  depth={0}
                  expanded={expanded}
                  selectedId={value}
                  onToggle={toggleNode}
                  onSelect={choose}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
