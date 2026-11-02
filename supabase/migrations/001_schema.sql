-- =====================================================================
-- 现代汉语课程工作台 · 数据库结构
-- 在 Supabase Dashboard → SQL Editor 中整体粘贴执行（可重复执行）
-- =====================================================================

-- ---------- 枚举 ----------
do $$ begin
  create type public.user_role as enum ('student', 'teacher');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_type as enum ('单选', '多选', '判断', '填空', '简答', 'match', 'correction');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty_level as enum ('low', 'mid', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.material_category as enum ('核心必看', '拓展阅读', '参考教材');
exception when duplicate_object then null; end $$;

-- ---------- 用户资料（角色） ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role not null default 'student',
  display_name text,
  student_no   text,                       -- 学号，可选
  created_at   timestamptz not null default now()
);

-- 注册时自动建 profile，默认学生
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS 里反复用到的判定函数
create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- ---------- 知识点树 ----------
create table if not exists public.knowledge_points (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  parent_id  uuid references public.knowledge_points (id) on delete cascade,
  level      smallint not null default 1,   -- 1 = 章节，2 = 知识点，3 = 子知识点
  sort_order int not null default 0,        -- 一级章节固定：语音1 汉字2 词汇3 语法4 修辞5
  unique (parent_id, name)
);
create index if not exists kp_parent_idx on public.knowledge_points (parent_id, sort_order);

-- ---------- 题目 ----------
create table if not exists public.questions (
  id                 uuid primary key default gen_random_uuid(),
  knowledge_point_id uuid not null references public.knowledge_points (id) on delete restrict,
  type               public.question_type not null,
  difficulty         public.difficulty_level not null,
  difficulty_reason  text,                  -- 为什么是这个难度（材料复杂度角度）
  stem               text not null,
  options            jsonb,                 -- 单选/多选：[{"key":"A","text":"..."}]
  answer             jsonb,                 -- 单选 "B" / 多选 ["A","C"] / 判断 true / 填空 ["答案1","答案2"]
  explanation        text,
  reference_answer   text,                  -- 简答参考答案
  scoring_points     jsonb,                 -- 简答得分点 ["点1","点2"]
  point_scores       jsonb,                 -- 与得分点一一对应的分值 [3,3,4]
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now()
);
create index if not exists q_kp_idx   on public.questions (knowledge_point_id);
create index if not exists q_type_idx on public.questions (type, difficulty);

-- ---------- 练习记录 ----------
create table if not exists public.practice_sessions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  config       jsonb not null default '{}'::jsonb,  -- 筛选条件/模板
  question_ids jsonb not null default '[]'::jsonb,  -- 题目顺序
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists ps_student_idx on public.practice_sessions (student_id, created_at desc);

-- ---------- 作答明细 ----------
create table if not exists public.answer_details (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.practice_sessions (id) on delete cascade,
  student_id     uuid not null references public.profiles (id) on delete cascade,
  question_id    uuid not null references public.questions (id) on delete cascade,
  student_answer jsonb,
  is_correct     boolean,                   -- 简答题由批改结果决定，可为 null
  ai_score       numeric(5,2),
  ai_feedback    text,
  point_hits     jsonb,                     -- 简答逐点判定 [{"point":"...","hit":true,"score":3}]
  final_score    numeric(5,2),              -- 教师复核后的最终分
  reviewed       boolean not null default false,
  needs_review   boolean not null default false,   -- AI 分与满分差距大时置 true
  created_at     timestamptz not null default now()
);
create index if not exists ad_student_idx  on public.answer_details (student_id, created_at desc);
create index if not exists ad_question_idx on public.answer_details (question_id);
create index if not exists ad_review_idx   on public.answer_details (needs_review) where needs_review and not reviewed;

-- ---------- 错题集 ----------
create table if not exists public.wrong_book (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles (id) on delete cascade,
  question_id   uuid not null references public.questions (id) on delete cascade,
  wrong_count   int not null default 1,
  last_wrong_at timestamptz not null default now(),
  mastered      boolean not null default false,
  unique (student_id, question_id)
);
create index if not exists wb_student_idx on public.wrong_book (student_id, mastered);

-- 答错自动进错题集
create or replace function public.sync_wrong_book()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.is_correct is false then
    insert into public.wrong_book (student_id, question_id)
    values (new.student_id, new.question_id)
    on conflict (student_id, question_id) do update
      set wrong_count   = public.wrong_book.wrong_count + 1,
          last_wrong_at = now(),
          mastered      = false;
  end if;
  return new;
end $$;

drop trigger if exists on_answer_detail_written on public.answer_details;
create trigger on_answer_detail_written
  after insert or update of is_correct on public.answer_details
  for each row execute function public.sync_wrong_book();

-- ---------- 试卷 ----------
create table if not exists public.papers (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  total_score numeric(6,2) not null default 100,
  config      jsonb not null default '{}'::jsonb,  -- {"source":"data|manual","variant":"A|B","blueprint":[...]}
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table if not exists public.paper_questions (
  id          uuid primary key default gen_random_uuid(),
  paper_id    uuid not null references public.papers (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  score       numeric(5,2) not null default 0,
  sort_order  int not null default 0,
  unique (paper_id, question_id)
);
create index if not exists pq_paper_idx on public.paper_questions (paper_id, sort_order);

-- ---------- 课程资料 ----------
create table if not exists public.course_materials (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  category           public.material_category not null,
  knowledge_point_id uuid references public.knowledge_points (id) on delete set null,
  file_url           text not null,          -- Storage 内的对象路径，如 "语音/声母总表.pdf"
  file_type          text,                   -- pdf / pptx / docx ...
  file_size          bigint,
  uploaded_by        uuid references public.profiles (id),
  uploaded_at        timestamptz not null default now()
);
create index if not exists cm_cat_idx on public.course_materials (category, uploaded_at desc);
create index if not exists cm_kp_idx  on public.course_materials (knowledge_point_id);

-- 资料查看/下载日志（支撑看板"检索排行"）
create table if not exists public.material_views (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.course_materials (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  viewed_at   timestamptz not null default now()
);
create index if not exists mv_material_idx on public.material_views (material_id);

-- =====================================================================
-- 看板用视图（security_invoker：按调用者的 RLS 过滤）
-- =====================================================================

-- 每道题的错误率
create or replace view public.v_question_error_stats
with (security_invoker = true) as
select
  q.id                                   as question_id,
  q.stem,
  q.type,
  q.difficulty,
  q.knowledge_point_id,
  count(ad.id)                           as attempts,
  count(ad.id) filter (where ad.is_correct is false) as wrong_count,
  case when count(ad.id) = 0 then 0
       else round(count(ad.id) filter (where ad.is_correct is false)::numeric / count(ad.id), 4)
  end                                    as error_rate
from public.questions q
left join public.answer_details ad on ad.question_id = q.id and ad.is_correct is not null
group by q.id;

-- 每个知识点（含所属章节）的掌握度
create or replace view public.v_knowledge_mastery
with (security_invoker = true) as
with recursive tree as (
  select id, name, parent_id, level, sort_order, id as root_id, name as chapter, sort_order as chapter_order
  from public.knowledge_points where parent_id is null
  union all
  select k.id, k.name, k.parent_id, k.level, k.sort_order, t.root_id, t.chapter, t.chapter_order
  from public.knowledge_points k join tree t on k.parent_id = t.id
)
select
  t.id                                   as knowledge_point_id,
  t.name,
  t.level,
  t.chapter,
  t.chapter_order,
  count(ad.id)                           as attempts,
  count(ad.id) filter (where ad.is_correct)         as correct_count,
  case when count(ad.id) = 0 then null
       else round(count(ad.id) filter (where ad.is_correct)::numeric / count(ad.id), 4)
  end                                    as mastery
from tree t
left join public.questions q on q.knowledge_point_id = t.id
left join public.answer_details ad on ad.question_id = q.id and ad.is_correct is not null
group by t.id, t.name, t.level, t.chapter, t.chapter_order;

-- 资料检索排行
create or replace view public.v_material_rank
with (security_invoker = true) as
select
  m.id as material_id, m.title, m.category, m.knowledge_point_id,
  count(v.id)                       as view_count,
  count(distinct v.student_id)      as unique_viewers,
  max(v.viewed_at)                  as last_viewed_at
from public.course_materials m
left join public.material_views v on v.material_id = m.id
group by m.id;
