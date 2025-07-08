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

-- 添加绝地翻盘参与者表
-- 这个迁移脚本用于在现有数据库中添加绝地翻盘功能的新表

-- 创建绝地翻盘参与者表
CREATE TABLE IF NOT EXISTS final_lottery_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_drawn BOOLEAN DEFAULT false,
  drawn_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(room_id, user_id)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_final_lottery_participants_room_id ON final_lottery_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_final_lottery_participants_user_id ON final_lottery_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_final_lottery_participants_is_drawn ON final_lottery_participants(is_drawn);

-- 添加注释
COMMENT ON TABLE final_lottery_participants IS '绝地翻盘参与者表 - 专门用于绝地翻盘功能的抽奖参与者';
COMMENT ON COLUMN final_lottery_participants.room_id IS '房间ID';
COMMENT ON COLUMN final_lottery_participants.user_id IS '用户ID';
COMMENT ON COLUMN final_lottery_participants.weight IS '抽奖权重，数值越大中奖概率越高';
COMMENT ON COLUMN final_lottery_participants.is_drawn IS '是否已被抽中';
COMMENT ON COLUMN final_lottery_participants.drawn_at IS '抽中时间'; 