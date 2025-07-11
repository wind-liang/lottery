-- 更新奖励列表 - 数据库迁移脚本
-- 在 Supabase SQL 编辑器中运行此脚本

-- 先清除现有的奖励数据（保留已被选择的记录）
DELETE FROM rewards 
WHERE room_id IN (SELECT id FROM rooms WHERE name = '婚礼抽奖房间')
AND selected_by IS NULL;

-- 插入新的奖励列表
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

-- 验证更新结果
SELECT 
  name,
  description,
  order_index,
  selected_by IS NOT NULL as is_selected
FROM rewards 
WHERE room_id IN (SELECT id FROM rooms WHERE name = '婚礼抽奖房间')
ORDER BY order_index;

-- 显示更新统计
SELECT 
  COUNT(*) as total_rewards,
  COUNT(CASE WHEN selected_by IS NOT NULL THEN 1 END) as selected_rewards,
  COUNT(CASE WHEN selected_by IS NULL THEN 1 END) as available_rewards
FROM rewards 
WHERE room_id IN (SELECT id FROM rooms WHERE name = '婚礼抽奖房间'); 