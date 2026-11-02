-- 语法下的句型、句式、句类应是「单句」的三级子节点。
-- 005 留下的二级「句型」「句类」与 006 的三级节点重名，地图会把空壳当成独立模块。
-- 另有 5 道简答被导入别名挂在父节点「单句」上，按题干归回对应三级知识点。

update public.questions q
set knowledge_point_id = child.id
from public.knowledge_points parent
join public.knowledge_points child on child.parent_id = parent.id
where q.knowledge_point_id = parent.id
  and parent.name = '单句'
  and parent.level = 2
  and (
    (q.stem like '%既可称为主谓句%' and child.name = '单句的类型系统')
    or (q.stem like '%把字句%' and child.name = '句式')
    or (q.stem like '%被字句%' and child.name = '句式')
    or (q.stem like '请辨析%' and child.name = '句式')
    or (
      q.stem like '%句型%'
      and q.stem not like '%把字句%'
      and q.stem not like '%被字句%'
      and child.name = '句型'
    )
  );

delete from public.knowledge_points kp
using public.knowledge_points chapter
where kp.parent_id = chapter.id
  and chapter.name = '语法'
  and chapter.level = 1
  and kp.level = 2
  and kp.name in ('句型', '句类')
  and not exists (select 1 from public.questions q where q.knowledge_point_id = kp.id)
  and not exists (select 1 from public.knowledge_points child where child.parent_id = kp.id);
