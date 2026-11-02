# Supabase 配置指南

项目：`https://lakgwsieztrdtsxasikb.supabase.co`

全部操作在 **Supabase Dashboard → SQL Editor** 中完成，每个文件整体粘贴后点 Run。所有脚本都可重复执行。

## 1. 建表 + 触发器 + 视图

执行 `migrations/001_schema.sql`。

包含：
- 枚举：`user_role` / `question_type` / `difficulty_level` / `material_category`
- 8 张业务表 + `profiles`（角色）+ `material_views`（资料查看日志，支撑看板"检索排行"）
- 触发器 `on_auth_user_created`：注册即自动创建 `profiles` 行，默认角色 `student`
- 触发器 `on_answer_detail_written`：`is_correct = false` 时自动写入/累加 `wrong_book`
- 函数 `is_teacher()`：RLS 判定用
- 看板视图：`v_question_error_stats`（题目错误率）、`v_knowledge_mastery`（知识点掌握度，含章节）、`v_material_rank`（资料检索排行）

## 2. 行级安全（RLS）

执行 `migrations/002_rls.sql`。

| 表 | 学生 | 教师 |
|---|---|---|
| `knowledge_points` `questions` `course_materials` | 只读 | 全部 |
| `practice_sessions` `wrong_book` | 读写自己的 | 读全部 |
| `answer_details` | 读/新增自己的 | 读全部 + 修改（复核） |
| `material_views` | 新增自己的 | 读全部 |
| `papers` `paper_questions` | 无 | 全部 |
| `profiles` | 读/改自己的（不能改 `role`） | 全部 |

## 3. Storage 桶

执行 `migrations/003_storage.sql`。

创建私有桶 `course-materials`（50 MB 上限，仅允许 PDF / PPT / PPTX / DOC / DOCX），并在 `storage.objects` 上设置策略：

- 所有登录用户：`select`（查看/下载）
- 教师：`insert` / `update` / `delete`

> 若 SQL 创建桶失败（个别项目对 `storage.buckets` 的写权限受限），改为在 **Storage → New bucket** 手动创建：名称 `course-materials`，关闭 Public，然后只执行脚本中 `storage.objects` 的四条 policy。

前端读取方式：桶为私有，学生端用 `supabase.storage.from('course-materials').createSignedUrl(path, 3600)` 生成临时链接后打开或下载。

## 4. 种子数据

执行 `seed.sql`。

- 一级章节按固定顺序：语音(1) → 汉字(2) → 词汇(3) → 语法(4) → 修辞(5)
- 每章 6～7 个二级知识点
- 15 道示例题，每章覆盖低/中/高三档，`difficulty_reason` 字段写明"材料复杂度"判定依据，可作为后续出题参照

## 4.6 教材节次（从教材识别题目之前执行）

执行 `migrations/005_textbook.sql`。

- 二级知识点改为黄伯荣、廖序东《现代汉语》增订七版的节次（汉字对应教材「文字」章）
- 已有示例题改挂到新节次，不再被引用的旧节次会删掉
- `questions` 增加 `source_material_id`，记录题目来自哪一份上传资料

## 4.5 班级表（学生注册依赖）

执行 `migrations/004_classes.sql`。

- 兼容已手动创建的 `classes` 表（整数 `id`、`name`、`created_at`），仅补齐 `sort_order`、`created_by` 两列和唯一约束
- `profiles` 新增 `class_id`、`class_name`
- 注册触发器改为从 Auth 元数据读取 姓名 / 学号 / 班级 并写入 `profiles`
- `classes` 开启 RLS：匿名可读（注册页需要），教师可写

## 5. 认证设置（开发期）

**Authentication → Providers → Email**：关闭 **Confirm email**。否则注册后要收邮件确认才能登录，本地调试很麻烦。上线前再打开。

## 6. 指定第一位教师

注册一个账号后，在 SQL Editor 执行（替换邮箱）：

```sql
update public.profiles
set role = 'teacher'
where id = (select id from auth.users where email = 'teacher@example.com');
```

之后教师可在教师端界面把其他账号设为教师。

## 7. 验证

```sql
-- 章节顺序
select name, sort_order from public.knowledge_points where parent_id is null order by sort_order;

-- 题目分布
select p.name as chapter, q.difficulty, count(*)
from public.questions q
join public.knowledge_points k on k.id = q.knowledge_point_id
join public.knowledge_points p on p.id = k.parent_id
group by p.name, p.sort_order, q.difficulty
order by p.sort_order, q.difficulty;

-- RLS 已全部开启
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
```

## 8. Vercel 部署时的环境变量

在 Vercel 项目 Settings → Environment Variables 添加（与本地 `.env` 相同）：

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_MATERIALS_BUCKET
VITE_AI_GRADING_ENDPOINT
```

同时在 **Authentication → URL Configuration** 中把 Vercel 域名加入 Redirect URLs。
