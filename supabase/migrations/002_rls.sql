-- =====================================================================
-- 行级安全（RLS）
-- 原则：学生只能读公共内容 + 读写自己的练习数据；教师拥有全部权限
-- 可重复执行：先 drop 再 create
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.knowledge_points  enable row level security;
alter table public.questions         enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.answer_details    enable row level security;
alter table public.wrong_book        enable row level security;
alter table public.papers            enable row level security;
alter table public.paper_questions   enable row level security;
alter table public.course_materials  enable row level security;
alter table public.material_views    enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles: read own or teacher reads all" on public.profiles;
create policy "profiles: read own or teacher reads all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_teacher());

drop policy if exists "profiles: update own (role unchanged)" on public.profiles;
create policy "profiles: update own (role unchanged)"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

drop policy if exists "profiles: teacher updates any" on public.profiles;
create policy "profiles: teacher updates any"
  on public.profiles for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ---------- knowledge_points（所有登录用户可读，教师可写） ----------
drop policy if exists "kp: read" on public.knowledge_points;
create policy "kp: read" on public.knowledge_points for select to authenticated using (true);

drop policy if exists "kp: teacher writes" on public.knowledge_points;
create policy "kp: teacher writes" on public.knowledge_points for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ---------- questions ----------
drop policy if exists "q: read" on public.questions;
create policy "q: read" on public.questions for select to authenticated using (true);

drop policy if exists "q: teacher writes" on public.questions;
create policy "q: teacher writes" on public.questions for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ---------- practice_sessions ----------
drop policy if exists "ps: student owns" on public.practice_sessions;
create policy "ps: student owns" on public.practice_sessions for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists "ps: teacher reads all" on public.practice_sessions;
create policy "ps: teacher reads all" on public.practice_sessions for select to authenticated
  using (public.is_teacher());

-- ---------- answer_details ----------
drop policy if exists "ad: student reads own" on public.answer_details;
create policy "ad: student reads own" on public.answer_details for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "ad: student inserts own" on public.answer_details;
create policy "ad: student inserts own" on public.answer_details for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists "ad: teacher reads all" on public.answer_details;
create policy "ad: teacher reads all" on public.answer_details for select to authenticated
  using (public.is_teacher());

-- 教师复核：改 final_score / ai_feedback / reviewed
drop policy if exists "ad: teacher reviews" on public.answer_details;
create policy "ad: teacher reviews" on public.answer_details for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ---------- wrong_book ----------
-- 写入由 security definer 触发器完成；学生只需读与标记"已掌握"
drop policy if exists "wb: student reads own" on public.wrong_book;
create policy "wb: student reads own" on public.wrong_book for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "wb: student updates own" on public.wrong_book;
create policy "wb: student updates own" on public.wrong_book for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists "wb: teacher reads all" on public.wrong_book;
create policy "wb: teacher reads all" on public.wrong_book for select to authenticated
  using (public.is_teacher());

-- ---------- papers / paper_questions（仅教师） ----------
drop policy if exists "papers: teacher" on public.papers;
create policy "papers: teacher" on public.papers for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "pq: teacher" on public.paper_questions;
create policy "pq: teacher" on public.paper_questions for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ---------- course_materials ----------
drop policy if exists "cm: read" on public.course_materials;
create policy "cm: read" on public.course_materials for select to authenticated using (true);

drop policy if exists "cm: teacher writes" on public.course_materials;
create policy "cm: teacher writes" on public.course_materials for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ---------- material_views ----------
drop policy if exists "mv: student logs own" on public.material_views;
create policy "mv: student logs own" on public.material_views for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists "mv: teacher reads all" on public.material_views;
create policy "mv: teacher reads all" on public.material_views for select to authenticated
  using (public.is_teacher());

-- ---------- 视图权限 ----------
grant select on public.v_question_error_stats to authenticated;
grant select on public.v_knowledge_mastery     to authenticated;
grant select on public.v_material_rank         to authenticated;
