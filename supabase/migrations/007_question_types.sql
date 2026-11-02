-- 连线匹配 match、病句修改 correction
alter type public.question_type add value if not exists 'match';
alter type public.question_type add value if not exists 'correction';
