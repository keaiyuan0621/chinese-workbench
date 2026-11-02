import { MATERIALS_BUCKET, supabase } from './supabase.js'
import { CHAPTERS } from './constants.js'
import { sampleQuestions } from './practice.js'

/** 抛出 Supabase 返回的 error，方便页面统一 try/catch */
function unwrap({ data, error }) {
  if (error) throw error
  return data
}

// ---------------- 班级 ----------------

export async function fetchClasses() {
  return unwrap(
    await supabase
      .from('classes')
      .select('id, name, sort_order, created_at')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  )
}

export async function createClass(name, createdBy) {
  return unwrap(
    await supabase
      .from('classes')
      .insert({ name: name.trim(), created_by: createdBy ?? null })
      .select('id, name, sort_order, created_at')
      .single(),
  )
}

export async function deleteClass(id) {
  // 外键会把 profiles.class_id 置空，但 class_name 是冗余文本，需手动清空
  unwrap(await supabase.from('profiles').update({ class_name: null }).eq('class_id', id))
  unwrap(await supabase.from('classes').delete().eq('id', id))
}

/** 各班级学生人数 { [classId]: count } */
export async function fetchStudentCountsByClass() {
  const rows = unwrap(
    await supabase.from('profiles').select('class_id').eq('role', 'student'),
  )
  const counts = {}
  for (const r of rows) {
    if (!r.class_id) continue
    counts[r.class_id] = (counts[r.class_id] ?? 0) + 1
  }
  return counts
}

// ---------------- 知识点 ----------------

/**
 * 返回按固定章节顺序排列的树：
 * [{ id, name, sort_order, children: [{ id, name, sort_order, children: [...] }] }]
 */
export async function fetchKnowledgeTree() {
  const rows = unwrap(
    await supabase
      .from('knowledge_points')
      .select('id, name, parent_id, level, sort_order')
      .order('level', { ascending: true })
      .order('sort_order', { ascending: true }),
  )

  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]))
  const roots = []
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  }

  // 一级章节严格按 CHAPTERS 顺序，未知章节排在末尾
  const rank = (name) => {
    const i = CHAPTERS.indexOf(name)
    return i === -1 ? CHAPTERS.length : i
  }
  roots.sort((a, b) => rank(a.name) - rank(b.name) || a.sort_order - b.sort_order)
  return roots
}

/** 每个知识点所属的一级章节名，例如「层次分析」→「语法」。 */
export async function fetchChapterByKnowledgePoint() {
  const rows = unwrap(await supabase.from('knowledge_points').select('id, name, parent_id'))
  const byId = new Map(rows.map((row) => [row.id, row]))
  const chapterOf = {}
  for (const row of rows) {
    let current = row
    const seen = new Set()
    while (current && !CHAPTERS.includes(current.name) && current.parent_id && !seen.has(current.id)) {
      seen.add(current.id)
      current = byId.get(current.parent_id)
    }
    chapterOf[row.id] = CHAPTERS.includes(current?.name) ? current.name : ''
  }
  return chapterOf
}

/** 分页取出全部行。默认上限是 1000，题库超过后会漏掉后面的题。 */
async function fetchAllRows(build) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const batch = unwrap(await build().order('id').range(from, from + pageSize - 1))
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

/**
 * 每个知识点自己名下的题目数量。
 * 只分页拉取 knowledge_point_id，在前端按编号分组。没有题的知识点不出现在结果里，调用方按 0 处理。
 */
export async function fetchQuestionCounts() {
  const rows = await fetchAllRows(() => supabase.from('questions').select('knowledge_point_id'))
  const counts = {}
  for (const row of rows) {
    if (!row.knowledge_point_id) continue
    counts[row.knowledge_point_id] = (counts[row.knowledge_point_id] ?? 0) + 1
  }
  return counts
}

function applyExactList(query, column, values) {
  if (!values?.length) return query
  if (values.length === 1) return query.eq(column, values[0])
  return query.in(column, values)
}

function applyPracticeFilters(query, { knowledgePointIds, types, difficulties } = {}) {
  query = applyExactList(query, 'knowledge_point_id', knowledgePointIds)
  query = applyExactList(query, 'type', types)
  query = applyExactList(query, 'difficulty', difficulties)
  return query
}

function questionsMatchFilters(questions, { knowledgePointIds, types, difficulties } = {}) {
  const ids = new Set(knowledgePointIds ?? [])
  const typeSet = new Set(types ?? [])
  const diffSet = new Set(difficulties ?? [])
  return questions.every((q) => {
    const kp = q.knowledge_point_id ?? q.knowledge_point?.id
    if (ids.size && !ids.has(kp)) return false
    if (typeSet.size && !typeSet.has(q.type)) return false
    if (diffSet.size && !diffSet.has(q.difficulty)) return false
    return true
  })
}

/** 只查符合筛选条件的题目总数，不把题目内容拉下来。 */
export async function countPracticeQuestions(filters = {}) {
  const query = applyPracticeFilters(
    supabase.from('questions').select('id', { count: 'exact', head: true }),
    filters,
  )
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

/** 按同样的筛选条件取出抽题所需的题目编号。单个知识点用 .eq，多个用 .in。 */
export async function fetchPracticePool(filters = {}) {
  return fetchAllRows(() =>
    applyPracticeFilters(
      supabase.from('questions').select('id, knowledge_point_id, type, difficulty'),
      filters,
    ),
  )
}

/**
 * 按筛选条件抽出完整题目。数量不够时只返回 matched，不补题。
 * 抽到的每一道都会再核对知识点、题型和难度，对不上就中止。
 */
export async function drawPracticeQuestions(filters = {}, count, ratio = null) {
  const pool = await fetchPracticePool(filters)
  const picked = sampleQuestions(pool, count, ratio)
  if (picked.length !== count) return { questions: [], matched: picked.length }
  const full = await fetchQuestionsByIds(picked.map((q) => q.id))
  const map = new Map(full.map((q) => [q.id, q]))
  const questions = picked.map((q) => map.get(q.id)).filter(Boolean)
  if (questions.length !== picked.length || !questionsMatchFilters(questions, filters)) {
    throw new Error('mismatch')
  }
  return { questions, matched: questions.length }
}

/** 只取某一个知识点上的题目，不包含它的父节点或兄弟节点。 */
export async function fetchQuestionMetaByKnowledgePoint(knowledgePointId) {
  if (!knowledgePointId) return []
  return fetchAllRows(() =>
    supabase
      .from('questions')
      .select('id, knowledge_point_id, type, difficulty')
      .eq('knowledge_point_id', knowledgePointId),
  )
}

// ---------------- 题目 ----------------

/** 题库元数据（用于筛选统计与抽题），不含题干 */
export async function fetchQuestionMeta() {
  return fetchAllRows(() =>
    supabase.from('questions').select('id, knowledge_point_id, type, difficulty'),
  )
}

const QUESTION_FIELDS =
  'id, knowledge_point_id, type, difficulty, difficulty_reason, stem, options, answer, ' +
  'explanation, reference_answer, scoring_points, point_scores, ' +
  'knowledge_point:knowledge_points(id, name, parent_id)'

const QUESTION_LIST_FIELDS =
  'id, type, difficulty, stem, answer, explanation, reference_answer, options, scoring_points, point_scores, ' +
  'knowledge_point:knowledge_points(id, name)'

/** 题库检索。keyword 同时匹配题干和参考答案。 */
export async function searchQuestions({
  type,
  keyword,
  difficulty,
  knowledgePointId,
  knowledgePointIds,
  page = 0,
  pageSize = 20,
} = {}) {
  const from = page * pageSize
  let query = supabase.from('questions').select(QUESTION_LIST_FIELDS, { count: 'exact' })
  if (type) query = query.eq('type', type)
  if (difficulty) query = query.eq('difficulty', difficulty)
  const pointIds = knowledgePointIds ?? (knowledgePointId ? [knowledgePointId] : [])
  query = applyExactList(query, 'knowledge_point_id', pointIds)
  const kw = String(keyword ?? '').trim()
  if (kw) {
    const pattern = `%${kw.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    query = query.or(`stem.ilike.${pattern},reference_answer.ilike.${pattern}`)
  }
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

/** 教师删除题目。已被试卷引用时数据库会拒绝。 */
export async function deleteQuestion(id) {
  unwrap(await supabase.from('questions').delete().eq('id', id))
}

/** 教师修改题干、答案和解析 */
export async function updateQuestion(id, patch) {
  return unwrap(
    await supabase
      .from('questions')
      .update(patch)
      .eq('id', id)
      .select(QUESTION_FIELDS)
      .single(),
  )
}

/** 按 id 列表取完整题目，并保持传入顺序 */
export async function fetchQuestionsByIds(ids) {
  if (!ids?.length) return []
  const rows = unwrap(await supabase.from('questions').select(QUESTION_FIELDS).in('id', ids))
  const map = new Map(rows.map((q) => [q.id, q]))
  return ids.map((id) => map.get(id)).filter(Boolean)
}

// ---------------- 练习 ----------------

export async function createPracticeSession(studentId, config, questionIds) {
  return unwrap(
    await supabase
      .from('practice_sessions')
      .insert({ student_id: studentId, config, question_ids: questionIds })
      .select('id')
      .single(),
  )
}

export async function fetchPracticeSession(id) {
  return unwrap(
    await supabase
      .from('practice_sessions')
      .select('id, student_id, config, question_ids, finished_at, created_at')
      .eq('id', id)
      .maybeSingle(),
  )
}

export async function fetchSessionAnswers(sessionId) {
  return unwrap(
    await supabase
      .from('answer_details')
      .select('id, question_id, student_answer, is_correct, needs_review, ai_score, final_score, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
  )
}

const ANSWER_ROW =
  'id, question_id, student_answer, is_correct, needs_review, ai_score, ai_feedback, point_hits, final_score, reviewed'

export async function saveAnswer(row) {
  const existing = unwrap(
    await supabase
      .from('answer_details')
      .select(ANSWER_ROW)
      .eq('session_id', row.session_id)
      .eq('question_id', row.question_id)
      .maybeSingle(),
  )
  if (existing) return existing
  return unwrap(await supabase.from('answer_details').insert(row).select(ANSWER_ROW).single())
}

/** 把暂停草稿和来源写回本次练习的 config，不标记整卷完成。 */
export async function updatePracticeConfig(id, config) {
  return unwrap(
    await supabase.from('practice_sessions').update({ config }).eq('id', id).select('id, config').single(),
  )
}

export async function finishPracticeSession(id) {
  unwrap(
    await supabase
      .from('practice_sessions')
      .update({ finished_at: new Date().toISOString() })
      .eq('id', id),
  )
}

// ---------------- 错题集 ----------------

export async function fetchWrongBook(studentId, { since } = {}) {
  let query = supabase
    .from('wrong_book')
    .select(`id, question_id, wrong_count, last_wrong_at, mastered, question:questions(${QUESTION_FIELDS})`)
    .eq('student_id', studentId)
  if (since) query = query.gte('last_wrong_at', since)
  return unwrap(await query.order('last_wrong_at', { ascending: false }))
}

export async function setWrongMastered(id, mastered) {
  unwrap(await supabase.from('wrong_book').update({ mastered }).eq('id', id))
}

// ---------------- 课程资料 ----------------

const MATERIAL_FIELDS =
  'id, title, category, knowledge_point_id, file_url, file_type, file_size, uploaded_at, ' +
  'knowledge_point:knowledge_points(id, name, parent_id)'

export async function fetchMaterials() {
  return unwrap(
    await supabase
      .from('course_materials')
      .select(MATERIAL_FIELDS)
      .order('uploaded_at', { ascending: false }),
  )
}

/** 与给定知识点（含所属章节）相关的资料 */
export async function fetchMaterialsForKnowledgePoints(kpIds) {
  const ids = [...new Set(kpIds.filter(Boolean))]
  if (!ids.length) return []
  return unwrap(
    await supabase
      .from('course_materials')
      .select(MATERIAL_FIELDS)
      .in('knowledge_point_id', ids)
      .order('category', { ascending: true }),
  )
}

/** 生成临时访问链接；download 为文件名时触发下载 */
export async function getMaterialUrl(path, { download } = {}) {
  const opts = download ? { download } : undefined
  const data = unwrap(
    await supabase.storage.from(MATERIALS_BUCKET).createSignedUrl(path, 60 * 60, opts),
  )
  return data.signedUrl
}

export async function logMaterialView(materialId, studentId) {
  // 日志失败不影响主流程
  await supabase.from('material_views').insert({ material_id: materialId, student_id: studentId })
}

// ================= 教师端 =================

// ---------------- 资料管理 ----------------

const CATEGORY_SLUG = { 核心必看: 'core', 拓展阅读: 'extended', 参考教材: 'textbook' }

/** 上传文件到私有桶并写入 course_materials；对象路径只用 ASCII，标题单独存 */
export async function uploadMaterial(file, { title, category, knowledgePointId, uploadedBy }) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const path = `${CATEGORY_SLUG[category] ?? 'misc'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  unwrap(
    await supabase.storage.from(MATERIALS_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    }),
  )

  try {
    return unwrap(
      await supabase
        .from('course_materials')
        .insert({
          title,
          category,
          knowledge_point_id: knowledgePointId || null,
          file_url: path,
          file_type: ext,
          file_size: file.size,
          uploaded_by: uploadedBy ?? null,
        })
        .select(MATERIAL_FIELDS)
        .single(),
    )
  } catch (err) {
    // 元数据写入失败则回滚已上传的文件
    await supabase.storage.from(MATERIALS_BUCKET).remove([path])
    throw err
  }
}

/** 把识别出的题目写入题库。已有相同题干的跳过。 */
export async function insertImportedQuestions(rows) {
  const stems = rows.map((r) => r.stem)
  const existing = unwrap(
    await supabase.from('questions').select('stem').in('stem', stems),
  )
  const seen = new Set(existing.map((r) => r.stem))
  const fresh = rows.filter((r) => !seen.has(r.stem))
  if (!fresh.length) return []
  return unwrap(await supabase.from('questions').insert(fresh).select('id'))
}

export async function deleteMaterial(material) {
  unwrap(await supabase.from('course_materials').delete().eq('id', material.id))
  await supabase.storage.from(MATERIALS_BUCKET).remove([material.file_url])
}

// ---------------- 数据看板 ----------------

const GRADED_ANSWER_FIELDS =
  'id, session_id, student_id, question_id, student_answer, is_correct, ai_score, final_score, created_at, ' +
  'student:profiles(display_name, student_no, class_name), ' +
  'question:questions(type, difficulty, stem, knowledge_point_id, knowledge_point:knowledge_points(name))'

/** 看板上的作答总数只统计已经判出对错的作答。这里按同样条件取出全部记录。 */
export async function fetchGradedAnswerDetails() {
  return fetchAllRows(() =>
    supabase.from('answer_details').select(GRADED_ANSWER_FIELDS).not('is_correct', 'is', null),
  )
}

/** 一名学生的全部作答，包含尚未判分的记录。 */
export async function fetchStudentAnswerDetails(studentId) {
  return fetchAllRows(() =>
    supabase.from('answer_details').select(GRADED_ANSWER_FIELDS).eq('student_id', studentId),
  )
}

/** 教师查看各班学生。 */
export async function fetchStudentRoster() {
  return unwrap(
    await supabase
      .from('profiles')
      .select('id, display_name, student_no, class_name')
      .eq('role', 'student')
      .order('class_name', { ascending: true })
      .order('student_no', { ascending: true }),
  )
}

export async function fetchDashboard() {
  const [errorStats, mastery, materialRank, students, sessions, answers] = await Promise.all([
    supabase.from('v_question_error_stats').select('*').gt('attempts', 0).order('wrong_count', { ascending: false }),
    supabase.from('v_knowledge_mastery').select('*'),
    supabase.from('v_material_rank').select('*').order('view_count', { ascending: false }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('practice_sessions').select('id', { count: 'exact', head: true }),
    supabase.from('answer_details').select('is_correct').not('is_correct', 'is', null),
  ])
  for (const r of [errorStats, mastery, materialRank, students, sessions, answers]) {
    if (r.error) throw r.error
  }
  const total = answers.data.length
  const correct = answers.data.filter((a) => a.is_correct).length
  return {
    errorStats: errorStats.data,
    mastery: mastery.data,
    materialRank: materialRank.data,
    studentCount: students.count ?? 0,
    sessionCount: sessions.count ?? 0,
    answerCount: total,
    accuracy: total ? Math.round((correct / total) * 100) : null,
  }
}

// ---------------- 组卷 ----------------

/** 有作答记录的题目，按错误率、错误次数降序 */
export async function fetchErrorStats() {
  return unwrap(
    await supabase
      .from('v_question_error_stats')
      .select('*')
      .gt('attempts', 0)
      .order('error_rate', { ascending: false })
      .order('wrong_count', { ascending: false }),
  )
}

export async function fetchPapers() {
  return unwrap(
    await supabase
      .from('papers')
      .select('id, title, total_score, config, created_at, paper_questions(count)')
      .order('created_at', { ascending: false }),
  )
}

export async function fetchPaperDetail(id) {
  return unwrap(
    await supabase
      .from('papers')
      .select(`id, title, total_score, config, created_at, paper_questions(id, score, sort_order, question:questions(${QUESTION_FIELDS}))`)
      .eq('id', id)
      .maybeSingle(),
  )
}

/** items: [{ question_id, score }]，按顺序写入 */
export async function createPaper({ title, config, createdBy }, items) {
  const totalScore = items.reduce((s, it) => s + Number(it.score || 0), 0)
  const paper = unwrap(
    await supabase
      .from('papers')
      .insert({ title, total_score: totalScore, config, created_by: createdBy ?? null })
      .select('id')
      .single(),
  )
  try {
    unwrap(
      await supabase.from('paper_questions').insert(
        items.map((it, i) => ({
          paper_id: paper.id,
          question_id: it.question_id,
          score: it.score,
          sort_order: i + 1,
        })),
      ),
    )
  } catch (err) {
    await supabase.from('papers').delete().eq('id', paper.id)
    throw err
  }
  return paper
}

export async function deletePaper(id) {
  unwrap(await supabase.from('papers').delete().eq('id', id))
}

// ---------------- 简答复核 ----------------

const REVIEW_FIELDS =
  'id, session_id, student_id, question_id, student_answer, ai_score, ai_feedback, point_hits, ' +
  'final_score, reviewed, needs_review, created_at, ' +
  `question:questions(${QUESTION_FIELDS}), student:profiles(id, display_name, student_no, class_name)`

export async function fetchReviewQueue({ reviewed }) {
  return unwrap(
    await supabase
      .from('answer_details')
      .select(REVIEW_FIELDS)
      .eq('needs_review', true)
      .eq('reviewed', reviewed)
      .order('created_at', { ascending: reviewed ? false : true }),
  )
}

export async function submitReview(id, { final_score, ai_feedback, point_hits }) {
  return unwrap(
    await supabase
      .from('answer_details')
      .update({ final_score, ai_feedback, point_hits, reviewed: true })
      .eq('id', id)
      .select(REVIEW_FIELDS)
      .single(),
  )
}
