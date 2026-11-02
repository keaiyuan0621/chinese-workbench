-- 语法 · 标点符号 补三个三级知识点。可重复执行。

insert into public.knowledge_points (name, parent_id, level, sort_order)
select v.name, parent.id, 3, v.sort_order
from (
  values
    ('标点符号的作用和种类', 1),
    ('标点符号的用法', 2),
    ('标点符号用法的灵活性', 3)
) as v(name, sort_order)
join public.knowledge_points parent
  on parent.name = '标点符号' and parent.level = 2
join public.knowledge_points chapter
  on chapter.id = parent.parent_id and chapter.name = '语法' and chapter.level = 1
on conflict (parent_id, name) do update
set level = excluded.level,
    sort_order = excluded.sort_order;
