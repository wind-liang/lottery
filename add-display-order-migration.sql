-- 添加 display_order 字段到 users 表
-- 用于保证用户顺序在进入后就不再变化

-- 添加 display_order 字段
ALTER TABLE users ADD COLUMN display_order INTEGER;

-- 创建索引以提高查询性能
CREATE INDEX idx_users_display_order ON users(display_order);

-- 为现有用户设置 display_order 值
-- 按照当前的 joined_at 顺序分配 display_order
UPDATE users 
SET display_order = subquery.row_number
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY joined_at ASC) as row_number
  FROM users 
  WHERE room_id IS NOT NULL
) AS subquery
WHERE users.id = subquery.id;

-- 为没有房间的用户设置默认值
UPDATE users 
SET display_order = 1
WHERE display_order IS NULL;

-- 添加约束确保每个房间内的 display_order 唯一
-- 注意：这里我们不添加唯一约束，因为可能有多个房间，每个房间内的 display_order 独立编号 