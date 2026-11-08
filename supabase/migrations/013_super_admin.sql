-- 超级管理员：教师列表、创建后的资料确认、重置密码、删除普通教师。
-- 密码只改 auth.users.encrypted_password，不改用户 id，也不删业务数据。

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- 超级管理员沿用教师的数据权限，页面上再单独限制「教师管理」。
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('teacher', 'super_admin')
  );
$$;

-- 注册元数据里只有 teacher 会写成教师。不能靠注册把自己设成超级管理员。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  declared_role public.user_role := case
    when meta ->> 'role' = 'teacher' then 'teacher'::public.user_role
    else 'student'::public.user_role
  end;
begin
  insert into public.profiles (id, role, display_name, student_no, class_id, class_name)
  values (
    new.id,
    declared_role,
    coalesce(nullif(meta ->> 'display_name', ''), split_part(new.email, '@', 1)),
    nullif(meta ->> 'student_no', ''),
    nullif(meta ->> 'class_id', '')::bigint,
    nullif(meta ->> 'class_name', '')
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        student_no   = coalesce(excluded.student_no, public.profiles.student_no),
        class_id     = coalesce(excluded.class_id, public.profiles.class_id),
        class_name   = coalesce(excluded.class_name, public.profiles.class_name),
        role = case
          when public.profiles.role = 'super_admin' then public.profiles.role
          when excluded.role = 'teacher' then 'teacher'::public.user_role
          else public.profiles.role
        end;
  return new;
end $$;

-- 普通教师不能把任何人改成教师或超级管理员。
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_super_admin() then
    raise exception '只有超级管理员可以修改角色';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create or replace function public.list_teachers()
returns table (
  id uuid,
  display_name text,
  email text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_super_admin() then
    raise exception '只有超级管理员可以查看教师列表';
  end if;

  return query
  select p.id, p.display_name, u.email::text, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'teacher'
  order by p.created_at desc, p.display_name;
end $$;

create or replace function public.ensure_teacher_profile(target_id uuid, teacher_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_super_admin() then
    raise exception '只有超级管理员可以添加教师';
  end if;
  if target_id is null then
    raise exception '没有找到要添加的教师';
  end if;

  update public.profiles
  set role = 'teacher',
      display_name = coalesce(nullif(btrim(teacher_name), ''), display_name)
  where id = target_id
    and role <> 'super_admin';

  if not found then
    raise exception '没有找到要添加的教师';
  end if;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = target_id;

  return target_id;
end $$;

create or replace function public.reset_teacher_password(target_id uuid, new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  teacher_email text;
begin
  if not public.is_super_admin() then
    raise exception '只有超级管理员可以重置密码';
  end if;
  if target_id is null or char_length(coalesce(new_password, '')) < 6 then
    raise exception '密码至少需要 6 位';
  end if;
  if not exists (
    select 1 from public.profiles where id = target_id and role = 'teacher'
  ) then
    raise exception '只能重置普通教师的密码';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = target_id
  returning email::text into teacher_email;

  if teacher_email is null then
    raise exception '没有找到这个教师账号';
  end if;

  return jsonb_build_object('id', target_id, 'email', teacher_email);
end $$;

create or replace function public.delete_teacher(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_super_admin() then
    raise exception '只有超级管理员可以删除教师';
  end if;
  if target_id is null or target_id = auth.uid() then
    raise exception '不能删除当前登录的账号';
  end if;
  if not exists (
    select 1 from public.profiles where id = target_id and role = 'teacher'
  ) then
    raise exception '只能删除普通教师';
  end if;

  -- 题目、试卷、资料留下，只解开作者关联。
  update public.questions set created_by = null where created_by = target_id;
  update public.papers set created_by = null where created_by = target_id;
  update public.course_materials set uploaded_by = null where uploaded_by = target_id;

  delete from auth.users where id = target_id;
end $$;

revoke all on function public.list_teachers() from public, anon;
revoke all on function public.ensure_teacher_profile(uuid, text) from public, anon;
revoke all on function public.reset_teacher_password(uuid, text) from public, anon;
revoke all on function public.delete_teacher(uuid) from public, anon;
grant execute on function public.list_teachers() to authenticated;
grant execute on function public.ensure_teacher_profile(uuid, text) to authenticated;
grant execute on function public.reset_teacher_password(uuid, text) to authenticated;
grant execute on function public.delete_teacher(uuid) to authenticated;

-- 现有的测试教师是这套系统的管理人员，升为超级管理员。
update public.profiles
set role = 'super_admin'
where id = '380f4b62-bdb2-42cc-80a1-2c70860bc179'
  and role = 'teacher';
