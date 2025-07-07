-- 数据库迁移脚本：更新 selected_reward 字段类型
-- 在 Supabase SQL 编辑器中运行此脚本

-- 首先删除外键约束（如果存在）
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_selected_reward_fkey;

-- 更新字段类型从 integer 到 UUID
ALTER TABLE users ALTER COLUMN selected_reward TYPE UUID USING selected_reward::text::UUID;

-- 重新添加外键约束
ALTER TABLE users ADD CONSTRAINT users_selected_reward_fkey 
  FOREIGN KEY (selected_reward) REFERENCES rewards(id);

-- 验证更改
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'selected_reward'; 