# 实时通信功能说明

## 功能概述

本项目已成功集成 Supabase Realtime 功能，实现了以下实时通信特性：

### ✅ 已实现功能

1. **实时用户状态同步**
   - 新用户加入房间时，所有其他用户立即看到
   - 用户离开房间时，实时更新用户列表
   - 用户在线状态的实时同步

2. **智能离线状态检测**
   - 自动检测用户页面关闭、网络断开等情况
   - 心跳检测机制，定期检查用户活跃状态
   - 页面可见性监控（最小化/隐藏时停止心跳）
   - 用户活动监控（鼠标移动、键盘输入）
   - 长时间无活动自动标记为离线
   - 离线用户的特殊视觉效果（灰化、离线标识）

3. **实时表情发送**
   - A用户发送表情，B用户立即看到
   - 表情带有发送者信息和时间戳
   - 自动清理过期表情

4. **实时通知系统**
   - 用户进入/离开房间的通知
   - 表情发送的通知
   - 优雅的通知动画和自动消失

5. **实时房间状态同步**
   - 游戏阶段变更的实时同步
   - 房间设置的实时更新

6. **用户清理系统**
   - 自动清理长时间离线用户
   - 标记长时间无活动用户为离线
   - 定期维护用户状态数据

## 技术实现

### 核心文件

1. **`src/lib/use-realtime.ts`** - 实时通信核心Hook
   - 管理所有 Supabase Realtime 订阅
   - 提供统一的实时数据处理接口
   - 自动处理连接管理和清理
   - 支持在线/离线用户数据获取

2. **`src/lib/use-user-presence.ts`** - 用户状态管理Hook
   - 心跳检测机制（每15秒发送心跳）
   - 页面可见性监控
   - 网络状态监控
   - 用户活动检测（鼠标、键盘）
   - 页面卸载时自动设置离线状态

3. **`src/lib/user-cleanup.ts`** - 用户清理工具
   - 清理长时间离线用户（30分钟）
   - 标记无活动用户为离线（2分钟）
   - 定期维护用户状态

4. **`src/components/realtime-notifications.tsx`** - 实时通知组件
   - 显示用户进入/离开通知
   - 显示表情发送通知
   - 自动消失机制

5. **`src/components/user-avatars.tsx`** - 用户头像组件（已优化）
   - 在线/离线状态视觉区分
   - 在线状态指示器（绿色圆点）
   - 离线状态遮罩和图标
   - 用户计数显示（在线/离线）

6. **`src/app/page.tsx`** - 主页面集成
   - 使用 useRealtime Hook
   - 使用 useUserPresence Hook
   - 实时数据状态管理
   - 用户交互处理

7. **`src/app/api/user-offline/route.ts`** - 离线状态API
   - 处理用户离线状态设置
   - 支持页面卸载时的异步调用

8. **`src/app/test-realtime/page.tsx`** - 完整测试页面
   - 离线状态测试功能
   - 用户清理测试
   - 实时状态监控

### 数据库表

- **`users`** - 用户信息表，包含在线状态和当前表情
- **`rooms`** - 房间信息表，包含游戏状态
- **`emojis`** - 表情记录表，包含过期时间

### 实时订阅

1. **用户表订阅** (`users` table)
   - 监听用户加入/离开
   - 监听用户信息变更
   - 监听表情状态变化

2. **房间表订阅** (`rooms` table)
   - 监听游戏状态变更
   - 监听房间设置变化

3. **表情表订阅** (`emojis` table)
   - 监听新表情发送
   - 触发表情通知

## 使用方法

### 基本用法

```typescript
import { useRealtime } from '@/lib/use-realtime'
import { useUserPresence } from '@/lib/use-user-presence'
import { RealtimeNotifications } from '@/components/realtime-notifications'

// 在组件中使用实时通信
const { refreshUsers, refreshRoom } = useRealtime({
  roomId: 'your-room-id',
  onUsersChange: (users) => {
    // 处理用户列表变化（包括在线/离线状态）
    setUsers(users)
  },
  onEmojiReceived: (emojiData) => {
    // 处理表情接收
    console.log('收到表情:', emojiData)
  },
  onUserJoined: (user) => {
    // 处理用户加入
    console.log('用户加入:', user.nickname)
  },
  onUserLeft: (userId) => {
    // 处理用户离开
    console.log('用户离开:', userId)
  }
})

// 使用用户状态管理
useUserPresence({
  userId: currentUser?.id,
  roomId: 'your-room-id',
  enabled: true // 是否启用状态管理
})

// 在JSX中添加通知组件
<RealtimeNotifications />
```

### 发送表情

```typescript
import { GameLogic } from '@/lib/game-logic'

// 发送表情
await GameLogic.sendEmoji(userId, roomId, '😊')
```

### 更新用户状态

```typescript
// 更新用户在线状态
await supabase
  .from('users')
  .update({ is_online: true })
  .eq('id', userId)
```

### 离线状态检测机制

```typescript
import { performUserCleanup, markInactiveUsersOffline } from '@/lib/user-cleanup'

// 标记长时间无活动用户为离线（2分钟无活动）
await markInactiveUsersOffline()

// 清理长时间离线用户（30分钟离线）
await performUserCleanup()
```

### 离线状态检测触发条件

1. **自动心跳检测**
   - 每15秒发送一次心跳
   - 2分钟无心跳自动标记为离线

2. **页面状态监控**
   - 页面隐藏/最小化时停止心跳
   - 页面重新可见时恢复心跳

3. **网络状态监控**
   - 网络断开时停止心跳
   - 网络恢复时重启心跳

4. **用户活动监控**
   - 鼠标移动触发心跳（限频10秒）
   - 键盘输入触发心跳（限频10秒）

5. **页面卸载处理**
   - 使用 `navigator.sendBeacon` 异步设置离线状态
   - 确保页面关闭时能够正确更新状态

## 测试方法

### 本地测试

1. 启动开发服务器：`npm run dev`
2. 访问测试页面：`http://localhost:3000/test-realtime`
3. 点击测试按钮验证实时功能

### 多用户测试

1. 在不同浏览器标签页中打开应用
2. 模拟不同用户操作
3. 观察实时同步效果

### 测试页面功能

- **添加测试用户** - 验证用户加入的实时通知
- **发送测试表情** - 验证表情的实时同步
- **移除用户** - 验证用户离开的实时通知
- **刷新用户列表** - 手动刷新功能

## 性能优化

1. **连接管理**
   - 自动清理无用连接
   - 避免重复订阅
   - 优雅的错误处理

2. **数据同步**
   - 防抖处理避免频繁更新
   - 智能缓存机制
   - 过期数据自动清理

3. **通知系统**
   - 限制通知数量
   - 自动过期机制
   - 优化动画性能

## 注意事项

1. **数据库配置**
   - 确保 Supabase 项目已启用 Realtime 功能
   - 正确配置 RLS (Row Level Security) 策略

2. **环境变量**
   - 正确配置 `NEXT_PUBLIC_SUPABASE_URL`
   - 正确配置 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **网络连接**
   - 处理网络断开重连
   - 优化移动网络体验

## 扩展功能

可以基于现有实时通信基础设施扩展以下功能：

1. **私聊功能** - 用户之间的私人消息
2. **语音通话** - 集成 WebRTC 实现语音通话
3. **屏幕共享** - 实现屏幕共享功能
4. **文件传输** - 实时文件传输功能
5. **更多表情** - 扩展表情包和动画效果

## 总结

通过集成 Supabase Realtime，本项目实现了完整的实时通信功能，包括：

- ✅ 实时用户状态同步
- ✅ 智能离线状态检测
- ✅ 心跳检测机制
- ✅ 用户活动监控
- ✅ 页面状态监控
- ✅ 网络状态监控
- ✅ 实时表情发送与接收
- ✅ 实时通知系统
- ✅ 用户清理系统
- ✅ 自动数据清理
- ✅ 优雅的错误处理
- ✅ 完整的测试页面
- ✅ 离线用户视觉区分

所有功能都已经过测试，可以直接在生产环境中使用。 