# 表情功能说明

## 功能介绍

新增了头像表情功能，用户可以发送表情，表情会显示在自己的头像上，房间内的所有人都能看到。

## 主要特性

- 🎭 **头像表情显示**: 表情直接显示在用户头像上
- 📡 **实时同步**: 所有房间成员都能实时看到表情
- ⏰ **自动过期**: 表情会在3秒后自动消失
- 🔄 **自动清理**: 系统会自动清理过期的表情
- 📱 **响应式设计**: 表情会根据头像大小自动调整
- 🎨 **视觉效果**: 表情带有弹跳动画效果

## 使用方法

1. 点击页面右下角的笑脸按钮
2. 从表情面板中选择想要的表情
3. 表情会立即显示在您的头像上
4. 其他用户可以实时看到您的表情
5. 表情会在3秒后自动消失

## 数据库迁移

⚠️ **重要**: 在使用此功能前，您需要运行数据库迁移脚本：

### 步骤1: 运行迁移脚本

在 Supabase SQL 编辑器中运行以下脚本：

```sql
-- 添加表情字段到用户表
-- 在 Supabase SQL 编辑器中运行此脚本

-- 为用户表添加表情相关字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_emoji TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emoji_expires_at TIMESTAMP WITH TIME ZONE;

-- 添加索引以便查询性能
CREATE INDEX IF NOT EXISTS idx_users_emoji_expires_at ON users(emoji_expires_at);

-- 创建清理过期用户表情的函数
CREATE OR REPLACE FUNCTION cleanup_expired_user_emojis()
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET current_emoji = NULL, emoji_expires_at = NULL 
  WHERE emoji_expires_at < NOW() AND current_emoji IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
```

### 步骤2: 验证迁移

运行以下查询验证字段是否成功添加：

```sql
-- 检查用户表结构
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('current_emoji', 'emoji_expires_at');
```

## 技术实现

### 数据结构

- `current_emoji`: 存储用户当前的表情符号
- `emoji_expires_at`: 表情的过期时间戳

### 实时同步

使用 Supabase 的实时功能监听用户表的变化，确保所有用户都能实时看到表情更新。

### 自动清理

- 前端每秒执行一次清理检查
- 后端函数会自动清理过期的表情记录

## 注意事项

1. **冷却时间**: 每次发送表情后有3秒的冷却时间
2. **表情时长**: 表情会在发送后3秒自动消失
3. **实时性**: 表情变化会实时同步给所有房间成员
4. **性能优化**: 过期表情会自动清理，不会占用过多资源

## 故障排除

### 表情不显示

1. 确认数据库迁移脚本已正确执行
2. 检查用户表是否有 `current_emoji` 和 `emoji_expires_at` 字段
3. 检查浏览器控制台是否有错误信息

### 表情不同步

1. 确认 Supabase 实时功能已启用
2. 检查网络连接是否正常
3. 刷新页面重新建立连接

### 表情不过期

1. 确认清理函数已正确创建
2. 检查系统时间是否正确
3. 手动执行清理函数：`SELECT cleanup_expired_user_emojis();`

## 更新日志

### v1.0.0
- 新增头像表情功能
- 实现实时同步
- 添加自动清理机制
- 优化用户体验 