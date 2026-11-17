export function trimTutorHistory(history) {
  return (history ?? []).slice(-10).map(turn => ({
    role: turn.role,
    content: String(turn.content ?? '').slice(0, 2000),
  }))
}
