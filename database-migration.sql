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

-- 创建绝地翻盘抽奖的原子性函数
CREATE OR REPLACE FUNCTION draw_final_lottery_winner(
  participant_id UUID,
  winner_user_id UUID
) RETURNS VOID AS $$
BEGIN
  -- 在事务中执行以下操作
  
  -- 1. 标记绝地翻盘参与者为已抽中
  UPDATE final_lottery_participants 
  SET 
    is_drawn = true,
    drawn_at = NOW()
  WHERE id = participant_id;
  
  -- 2. 在用户表中标记获胜者（使用 -1 表示绝地翻盘获胜者）
  UPDATE users 
  SET 
    order_number = -1,
    updated_at = NOW()
  WHERE id = winner_user_id;
  
  -- 如果任何操作失败，事务会自动回滚
END;
$$ LANGUAGE plpgsql;

-- 启用实时功能
ALTER TABLE final_lottery_participants ENABLE ROW LEVEL SECURITY;

-- 基础安全策略（允许所有操作）
CREATE POLICY "Enable all operations for final_lottery_participants" ON final_lottery_participants
  FOR ALL USING (true); 

-- 添加password字段到users表
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;

-- 为password字段添加唯一约束（如果不存在）
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE users ADD CONSTRAINT unique_password UNIQUE (password);
    EXCEPTION 
        WHEN duplicate_table THEN 
            -- 约束已存在，忽略错误
            NULL;
    END;
END $$;

-- 清空现有用户数据（如果需要重新导入）
-- DELETE FROM users;

-- 插入预定义用户数据
INSERT INTO users (nickname, password, avatar_url, role, is_online) VALUES
('四岗', 'sigang6291', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('超超', 'chaochao4878', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('凯', 'kai6351', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('黑鸭', 'heiya2250', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('阿男', 'anan1644', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('佳哥', 'jiage3397', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('帅皇', 'shuaihuang1809', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('东哥', 'dongge6549', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('凡王', 'fanwang8768', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('丁丁', 'dingding2364', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('二亮', 'erliang1669', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('鹏哥', 'pengge5373', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('学亮', 'xueliang1665', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('鱼子', 'yuzirry8232', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('丹子', 'danzibyt2576', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财1', 'gongxifacai1', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财2', 'gongxifacai2', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财3', 'gongxifacai3', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财4', 'gongxifacai4', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财5', 'gongxifacai5', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财6', 'gongxifacai6', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财7', 'gongxifacai7', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财8', 'gongxifacai8', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财9', 'gongxifacai9', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财10', 'gongxifacai10', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财11', 'gongxifacai11', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财12', 'gongxifacai12', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财13', 'gongxifacai13', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财14', 'gongxifacai14', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财15', 'gongxifacai15', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财16', 'gongxifacai16', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财17', 'gongxifacai17', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财18', 'gongxifacai18', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财19', 'gongxifacai19', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财20', 'gongxifacai20', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财21', 'gongxifacai21', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财22', 'gongxifacai22', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财23', 'gongxifacai23', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('恭喜发财24', 'gongxifacai24', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false)
ON CONFLICT (password) DO NOTHING; 