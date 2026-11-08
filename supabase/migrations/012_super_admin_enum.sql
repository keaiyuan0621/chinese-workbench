-- 新增超级管理员角色。
-- 新枚举值不能在同一事务里使用，所以角色函数和数据放在下一条迁移。
alter type public.user_role add value if not exists 'super_admin';
