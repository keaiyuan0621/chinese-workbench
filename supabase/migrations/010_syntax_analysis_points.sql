-- 语法 · 句法分析 补两个三级知识点，并把原先直接挂在二级节点上的题按题干归位。可重复执行。

insert into public.knowledge_points (name, parent_id, level, sort_order)
select v.name, parent.id, 3, v.sort_order
from (
  values
    ('句法成分分析', 1),
    ('层次分析', 2)
) as v(name, sort_order)
join public.knowledge_points parent
  on parent.name = '句法分析' and parent.level = 2
join public.knowledge_points chapter
  on chapter.id = parent.parent_id and chapter.name = '语法' and chapter.level = 1
on conflict (parent_id, name) do update
set level = excluded.level,
    sort_order = excluded.sort_order;

update public.questions q
set knowledge_point_id = child.id
from public.knowledge_points parent
join public.knowledge_points chapter
  on chapter.id = parent.parent_id and chapter.name = '语法' and chapter.level = 1
join public.knowledge_points child
  on child.parent_id = parent.id
 and child.level = 3
 and child.name = case
   when q.stem ~ '层次|第一层|逐层|切分|直接成分|两种结构|歧义|看望老师的学生'
     then '层次分析'
   else '句法成分分析'
 end
where parent.name = '句法分析'
  and parent.level = 2
  and q.knowledge_point_id = parent.id;
