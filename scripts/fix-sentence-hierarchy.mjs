import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
)
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const auth = await supabase.auth.signInWithPassword({
  email: 'teacher01@chinese.local',
  password: 'Test123456',
})
if (auth.error) throw auth.error

const kp = await supabase.from('knowledge_points').select('id,name,parent_id,level')
if (kp.error) throw kp.error
const byId = new Map(kp.data.map((row) => [row.id, row]))
const danju = kp.data.find((row) => row.name === '单句' && row.level === 2)
const childByName = Object.fromEntries(
  kp.data.filter((row) => row.parent_id === danju.id).map((row) => [row.name, row.id]),
)

function targetName(stem) {
  if (stem.includes('把字句') || stem.includes('被字句') || stem.startsWith('请辨析')) return '句式'
  if (stem.includes('既可称为主谓句')) return '单句的类型系统'
  if (stem.includes('句型')) return '句型'
  return null
}

const hanging = await supabase.from('questions').select('id,stem').eq('knowledge_point_id', danju.id)
if (hanging.error) throw hanging.error
for (const row of hanging.data) {
  const name = targetName(row.stem)
  const nextId = name ? childByName[name] : null
  if (!nextId) {
    console.log('KEEP', row.stem.slice(0, 40))
    continue
  }
  const updated = await supabase.from('questions').update({ knowledge_point_id: nextId }).eq('id', row.id)
  if (updated.error) throw updated.error
  console.log('MOVE', name, row.stem.slice(0, 40))
}

const grammar = kp.data.find((row) => row.name === '语法' && row.level === 1)
const shells = kp.data.filter(
  (row) => row.parent_id === grammar.id && row.level === 2 && (row.name === '句型' || row.name === '句类'),
)
for (const shell of shells) {
  const used = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('knowledge_point_id', shell.id)
  const kids = kp.data.filter((row) => row.parent_id === shell.id)
  if ((used.count ?? 0) > 0 || kids.length > 0) {
    console.log('SKIP DELETE', shell.name, used.count, kids.length)
    continue
  }
  const removed = await supabase.from('knowledge_points').delete().eq('id', shell.id)
  if (removed.error) throw removed.error
  console.log('DELETE', shell.name, shell.id)
}

const names = ['单句', '句型', '句式', '句类']
const targets = kp.data.filter((row) => names.includes(row.name) && byId.get(row.parent_id)?.name !== '语法' || (row.name === '单句' && row.level === 2))
const fresh = await supabase.from('knowledge_points').select('id,name,parent_id,level').in('name', names)
const ids = fresh.data.map((row) => row.id)
const counts = {}
for (let from = 0; ; from += 1000) {
  const batch = await supabase.from('questions').select('knowledge_point_id').order('id').range(from, from + 999)
  if (batch.error) throw batch.error
  for (const row of batch.data) {
    if (ids.includes(row.knowledge_point_id)) counts[row.knowledge_point_id] = (counts[row.knowledge_point_id] ?? 0) + 1
  }
  if (batch.data.length < 1000) break
}
const parentName = new Map(fresh.data.map((row) => [row.id, row]))
const all = await supabase.from('knowledge_points').select('id,name')
const nameOf = new Map(all.data.map((row) => [row.id, row.name]))
for (const row of fresh.data) {
  console.log(row.level, row.name, 'parent=' + (nameOf.get(row.parent_id) ?? '-'), 'questions', counts[row.id] ?? 0)
}
void targets
void parentName
