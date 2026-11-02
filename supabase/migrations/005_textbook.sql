-- =====================================================================
-- 知识点改为黄伯荣、廖序东《现代汉语》增订七版的节次
-- 一级仍是：语音、汉字、词汇、语法、修辞（汉字对应教材「文字」章）
-- 题目增加来源资料字段
-- 可重复执行
-- =====================================================================

alter table public.questions
  add column if not exists source_material_id uuid references public.course_materials (id) on delete set null;

create index if not exists q_material_idx on public.questions (source_material_id);

-- 先补齐教材节次
with chapters as (
  select id, name from public.knowledge_points where parent_id is null
),
kp(chapter, name, sort_order) as (
  values
    ('语音', '语音概说', 1),
    ('语音', '声母', 2),
    ('语音', '韵母', 3),
    ('语音', '声调', 4),
    ('语音', '音节', 5),
    ('语音', '音变', 6),
    ('语音', '音位', 7),
    ('语音', '朗读和语调', 8),
    ('语音', '语音规范化', 9),
    ('汉字', '汉字概说', 1),
    ('汉字', '汉字的形体', 2),
    ('汉字', '汉字的结构', 3),
    ('汉字', '汉字的整理和标准化', 4),
    ('汉字', '使用规范汉字', 5),
    ('词汇', '词汇和词的结构', 1),
    ('词汇', '词义的性质和构成', 2),
    ('词汇', '义素分析', 3),
    ('词汇', '语义场', 4),
    ('词汇', '语境与词义', 5),
    ('词汇', '词汇的构成', 6),
    ('词汇', '熟语', 7),
    ('词汇', '词汇的发展变化和词汇的规范', 8),
    ('语法', '语法概说', 1),
    ('语法', '词类', 2),
    ('语法', '短语', 3),
    ('语法', '句法成分', 4),
    ('语法', '句法分析', 5),
    ('语法', '句类', 6),
    ('语法', '句型', 7),
    ('语法', '复句', 8),
    ('语法', '标点符号', 9),
    ('修辞', '修辞概说', 1),
    ('修辞', '词语的锤炼', 2),
    ('修辞', '句式的选择', 3),
    ('修辞', '辞格', 4),
    ('修辞', '辞格的综合运用', 5),
    ('修辞', '语体', 6)
)
insert into public.knowledge_points (name, parent_id, level, sort_order)
select kp.name, c.id, 2, kp.sort_order
from kp join chapters c on c.name = kp.chapter
on conflict (parent_id, name) do update set sort_order = excluded.sort_order, level = 2;

-- 旧节次上的题目改挂到教材节次
with map(chapter, old_name, new_name) as (
  values
    ('语音', '音节结构', '音节'),
    ('语音', '音变（变调·轻声·儿化）', '音变'),
    ('语音', '拼音正词法', '语音规范化'),
    ('汉字', '汉字的性质与特点', '汉字概说'),
    ('汉字', '笔画与笔顺', '汉字的结构'),
    ('汉字', '偏旁部首与结构', '汉字的结构'),
    ('汉字', '六书与造字法', '汉字的结构'),
    ('汉字', '形近字与错别字', '使用规范汉字'),
    ('汉字', '汉字规范化', '使用规范汉字'),
    ('词汇', '语素', '词汇和词的结构'),
    ('词汇', '词的构造', '词汇和词的结构'),
    ('词汇', '词义（本义·引申义·比喻义）', '词义的性质和构成'),
    ('词汇', '同义词与反义词', '语义场'),
    ('词汇', '熟语（成语·惯用语·歇后语）', '熟语'),
    ('词汇', '词汇的发展与规范', '词汇的发展变化和词汇的规范'),
    ('语法', '短语结构', '短语'),
    ('语法', '句子成分', '句法成分'),
    ('语法', '层次分析', '句法分析'),
    ('语法', '句型与句类', '句型'),
    ('语法', '常见语病', '句法分析'),
    ('修辞', '词语锤炼', '词语的锤炼'),
    ('修辞', '句式选择', '句式的选择'),
    ('修辞', '比喻与比拟', '辞格'),
    ('修辞', '借代与夸张', '辞格'),
    ('修辞', '对偶与排比', '辞格'),
    ('修辞', '辞格综合运用', '辞格的综合运用')
)
update public.questions q
set knowledge_point_id = target.id
from map m
join public.knowledge_points chapter on chapter.parent_id is null and chapter.name = m.chapter
join public.knowledge_points old on old.parent_id = chapter.id and old.name = m.old_name
join public.knowledge_points target on target.parent_id = chapter.id and target.name = m.new_name
where q.knowledge_point_id = old.id;

-- 去掉已经没有题目的旧节次
delete from public.knowledge_points old
using public.knowledge_points chapter
where old.parent_id = chapter.id
  and chapter.parent_id is null
  and old.level = 2
  and not exists (select 1 from public.questions q where q.knowledge_point_id = old.id)
  and old.name not in (
    '语音概说','声母','韵母','声调','音节','音变','音位','朗读和语调','语音规范化',
    '汉字概说','汉字的形体','汉字的结构','汉字的整理和标准化','使用规范汉字',
    '词汇和词的结构','词义的性质和构成','义素分析','语义场','语境与词义','词汇的构成','熟语','词汇的发展变化和词汇的规范',
    '语法概说','词类','短语','句法成分','句法分析','句类','句型','复句','标点符号',
    '修辞概说','词语的锤炼','句式的选择','辞格','辞格的综合运用','语体'
  );
