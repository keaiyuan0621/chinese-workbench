import { useCallback, useEffect, useState } from 'react'

const KEY = 'paper-cart'
const EVENT = 'paper-cart-change'

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(items) {
  localStorage.setItem(KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(EVENT))
}

/**
 * 「加入试卷」待选题篮，存于 localStorage，看板与组卷页共享。
 * items: [{ question_id, stem, type, difficulty }]
 */
export function usePaperCart() {
  const [items, setItems] = useState(read)

  useEffect(() => {
    const sync = () => setItems(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const has = useCallback((qid) => items.some((it) => it.question_id === qid), [items])

  const add = useCallback((q) => {
    const cur = read()
    if (cur.some((it) => it.question_id === q.question_id)) return false
    write([...cur, q])
    return true
  }, [])

  const remove = useCallback((qid) => write(read().filter((it) => it.question_id !== qid)), [])
  const clear = useCallback(() => write([]), [])

  return { items, has, add, remove, clear }
}
