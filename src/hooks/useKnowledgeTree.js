import { useEffect, useState } from 'react'
import { fetchKnowledgeTree, fetchQuestionCounts } from '../lib/api.js'
import { zhError } from '../lib/errors.js'

let pendingMap = null

function loadKnowledgeMap() {
  if (!pendingMap) {
    pendingMap = Promise.all([fetchKnowledgeTree(), fetchQuestionCounts()]).finally(() => {
      pendingMap = null
    })
  }
  return pendingMap
}

/** 知识点树和直属题量一起返回。题量没到之前 tree 保持为空，页面继续显示骨架屏。 */
export function useKnowledgeTree() {
  const [tree, setTree] = useState(null)
  const [counts, setCounts] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [t, c] = await loadKnowledgeMap()
        if (cancelled) return
        setTree(t)
        setCounts(c)
      } catch (err) {
        if (!cancelled) setError(zhError(err, '知识点加载失败，请刷新重试'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { tree, counts, error, loading: tree === null && !error }
}
