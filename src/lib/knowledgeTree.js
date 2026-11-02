function walk(nodes, visit, trail = []) {
  for (const node of nodes ?? []) {
    const next = [...trail, node]
    if (visit(node, next) === true) return next
    const found = walk(node.children, visit, next)
    if (found) return found
  }
  return null
}

export function findKnowledgeNode(tree, id) {
  if (!id) return null
  const path = walk(tree, (node) => node.id === id)
  return path ? path[path.length - 1] : null
}

export function knowledgeSubtreeIds(node) {
  if (!node) return []
  const ids = []
  walk([node], (item) => {
    ids.push(item.id)
  })
  return ids
}

export function knowledgeAncestorIds(tree, id) {
  const path = walk(tree, (node) => node.id === id) ?? []
  return path.slice(0, -1).map((node) => node.id)
}

export function knowledgeExpandableIds(nodes, ids = []) {
  for (const node of nodes ?? []) {
    if (node.children?.length) {
      ids.push(node.id)
      knowledgeExpandableIds(node.children, ids)
    }
  }
  return ids
}

export function knowledgePathLabel(tree, id) {
  const path = walk(tree, (node) => node.id === id)
  return path ? path.map((node) => node.name).join(' / ') : ''
}
