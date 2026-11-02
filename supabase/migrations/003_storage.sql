-- =====================================================================
-- Storage：课件文件桶 course-materials
-- 私有桶：学生登录后可查看/下载（通过签名 URL 或直接 download），教师可上传/删除
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  52428800,   -- 50 MB
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 学生/教师：读取
drop policy if exists "materials: authenticated read" on storage.objects;
create policy "materials: authenticated read"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-materials');

-- 教师：上传
drop policy if exists "materials: teacher upload" on storage.objects;
create policy "materials: teacher upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-materials' and public.is_teacher());

-- 教师：覆盖/改名
drop policy if exists "materials: teacher update" on storage.objects;
create policy "materials: teacher update"
  on storage.objects for update to authenticated
  using (bucket_id = 'course-materials' and public.is_teacher())
  with check (bucket_id = 'course-materials' and public.is_teacher());

-- 教师：删除
drop policy if exists "materials: teacher delete" on storage.objects;
create policy "materials: teacher delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-materials' and public.is_teacher());
