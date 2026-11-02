-- 语音 · 音变：把直接挂在二级节点上的题，按题干归入三级节点。
-- 题干分不出属于哪一个三级节点的，仍留在「音变」（首页上的综合练习）。可重复执行。

update public.questions q
set knowledge_point_id = child.id
from public.knowledge_points parent
join public.knowledge_points chapter
  on chapter.id = parent.parent_id
 and chapter.name = '语音'
 and chapter.level = 1
join public.knowledge_points child
  on child.parent_id = parent.id
 and child.level = 3
 and child.name = case
   when q.stem ~ '儿化|花儿|卷舌' then '儿化'
   when q.stem ~ '轻声|买东西|辨东西' then '轻声'
   when q.stem ~ '啊' then '语气词“啊”的音变'
   when q.stem ~ '变调|半上|上声|调值|本调|变读|你好|很好|展览|演讲稿|买米|买布|小狗|“不”|“一”|一'
     then '变调'
   else null
 end
where parent.name = '音变'
  and parent.level = 2
  and q.knowledge_point_id = parent.id;
