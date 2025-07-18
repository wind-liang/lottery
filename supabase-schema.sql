-- 婚礼抽奖系统数据库架构
-- 在 Supabase SQL 编辑器中运行此脚本

-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('audience', 'host', 'player')) DEFAULT 'audience',
  room_id UUID,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  order_number INTEGER,
  selected_reward UUID REFERENCES rewards(id),
  is_online BOOLEAN DEFAULT true,
  current_emoji TEXT,
  emoji_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 房间表
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('waiting', 'lottery', 'reward_selection', 'final_lottery', 'finished')) DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settings JSONB DEFAULT '{}',
  is_lottery_locked BOOLEAN DEFAULT false,
  current_selector UUID,
  selection_timeout TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 抽奖参与者表
CREATE TABLE lottery_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_drawn BOOLEAN DEFAULT false,
  drawn_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(room_id, user_id)
);

-- 绝地翻盘参与者表
CREATE TABLE final_lottery_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_drawn BOOLEAN DEFAULT false,
  drawn_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(room_id, user_id)
);

-- 奖励表
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  order_index INTEGER NOT NULL,
  selected_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 表情表
CREATE TABLE emojis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 基础索引
CREATE INDEX idx_users_room_id ON users(room_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_lottery_participants_room_id ON lottery_participants(room_id);
CREATE INDEX idx_lottery_participants_user_id ON lottery_participants(user_id);
CREATE INDEX idx_final_lottery_participants_room_id ON final_lottery_participants(room_id);
CREATE INDEX idx_final_lottery_participants_user_id ON final_lottery_participants(user_id);
CREATE INDEX idx_final_lottery_participants_is_drawn ON final_lottery_participants(is_drawn);
CREATE INDEX idx_final_lottery_participants_weight ON final_lottery_participants(weight);
CREATE INDEX idx_rewards_room_id ON rewards(room_id);
CREATE INDEX idx_rewards_order_index ON rewards(order_index);
CREATE INDEX idx_emojis_room_id ON emojis(room_id);
CREATE INDEX idx_emojis_expires_at ON emojis(expires_at);

-- 优化索引：添加复合索引以提高奖励相关查询性能
CREATE INDEX idx_rewards_room_id_order_index ON rewards(room_id, order_index);
CREATE INDEX idx_rewards_room_id_selected_by ON rewards(room_id, selected_by);
CREATE INDEX idx_users_room_id_role_order ON users(room_id, role, order_number);
CREATE INDEX idx_users_room_id_role_selected ON users(room_id, role, selected_reward);
CREATE INDEX idx_final_lottery_participants_room_drawn ON final_lottery_participants(room_id, is_drawn);

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加更新时间戳触发器
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用实时功能
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_lottery_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE emojis ENABLE ROW LEVEL SECURITY;

-- 基础安全策略（允许所有操作，后续可根据需要调整）
CREATE POLICY "Enable all operations for users" ON users
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for rooms" ON rooms
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for lottery_participants" ON lottery_participants
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for final_lottery_participants" ON final_lottery_participants
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for rewards" ON rewards
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for emojis" ON emojis
  FOR ALL USING (true);

-- 清理过期表情的函数
CREATE OR REPLACE FUNCTION cleanup_expired_emojis()
RETURNS void AS $$
BEGIN
  DELETE FROM emojis WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 插入默认房间
INSERT INTO rooms (name, stage) VALUES ('婚礼抽奖房间', 'waiting');

-- 插入默认奖励（示例）
INSERT INTO rewards (room_id, name, description, order_index) 
SELECT 
  r.id,
  reward_name,
  reward_desc,
  idx
FROM rooms r,
LATERAL (VALUES 
  (1, '遥控漂移车', 'AE86-藤原拓海'),
  (2, '遥控漂移车', 'AE86-藤原拓海'),
  (3, '遥控漂移车', 'AE86-藤原拓海'),
  (4, '遥控漂移车', 'AE86-藤原拓海'),
  (5, '遥控漂移车', 'FC-高桥凉介'),
  (6, '遥控漂移车', 'FC-高桥凉介'),
  (7, '遥控漂移车', 'FC-高桥凉介'),
  (8, '遥控漂移车', 'NSX'),
  (9, '遥控漂移车', 'NSX'),
  (10, '遥控漂移车', 'GTR'),
  (11, '遥控漂移车', 'GTR'),
  (12, '红包', '¥88'),
  (13, '红包', '¥66'),
  (14, '红包', '¥50'),
  (15, '红包', '¥30'),
  (16, '红包', '¥30'),
  (17, '红包', '¥30'),
  (18, '红包', '¥30'),
  (19, '红包', '¥30')
) AS rewards(idx, reward_name, reward_desc)
WHERE r.name = '婚礼抽奖房间';

-- 创建实时发布订阅（可选）
-- 在 Supabase Dashboard 的 Database > Replication 中手动启用需要的表的实时功能 