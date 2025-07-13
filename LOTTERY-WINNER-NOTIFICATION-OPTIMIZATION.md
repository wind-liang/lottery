# 绝地翻盘奖励弹窗优化

## 问题分析

### 原始问题
绝地翻盘奖励弹窗有时候会遇到只有主持人弹窗来了，其他人没弹出来的情况。

### 原因分析

#### 第一阶段抽奖弹窗的实现（工作正常）
1. **主持人端**：通过 `onWinnerDrawn` 回调立即显示弹窗
2. **其他客户端**：通过实时监听 `users` 表的 `order_number` 字段变化来检测获奖者
3. **触发机制**：统一且稳定，所有客户端都监听同一个数据源

#### 绝地翻盘奖励弹窗的实现（存在问题）
1. **主持人端**：同样通过 `onWinnerDrawn` 回调立即显示弹窗（正常）
2. **其他客户端**：需要依赖以下几种不稳定的机制：
   - 实时监听 `final_lottery_participants` 表的 `is_drawn` 字段变化
   - 实时监听 `users` 表的 `current_emoji` 字段变化（🏆表情）
   - 多重广播机制（表情标记、updated_at更新等）
   - 轮询机制作为备份
3. **问题所在**：
   - 实时监听不稳定，`final_lottery_participants` 表的监听可能失败
   - 表情机制不可靠，依赖临时表情标记
   - 多重广播过于复杂，增加了故障点

## 优化解决方案

### 核心思路
参考第一阶段抽奖弹窗的稳定机制，为绝地翻盘建立统一的触发机制。

### 具体实现

#### 1. 优化数据库操作
- **新增数据库函数**：`draw_final_lottery_winner()` 确保原子性操作
- **统一标识机制**：在 `users` 表中使用 `order_number = -1` 标识绝地翻盘获胜者
- **事务保证**：确保 `final_lottery_participants` 表和 `users` 表的更新是原子性的

```sql
-- 数据库函数
CREATE OR REPLACE FUNCTION draw_final_lottery_winner(
  participant_id UUID,
  winner_user_id UUID
) RETURNS VOID AS $$
BEGIN
  -- 1. 标记绝地翻盘参与者为已抽中
  UPDATE final_lottery_participants 
  SET is_drawn = true, drawn_at = NOW()
  WHERE id = participant_id;
  
  -- 2. 在用户表中标记获胜者
  UPDATE users 
  SET order_number = -1, updated_at = NOW()
  WHERE id = winner_user_id;
END;
$$ LANGUAGE plpgsql;
```

#### 2. 优化实时监听机制
- **主要机制**：监听 `users` 表的 `order_number` 字段变化，检测 -1 值
- **备用机制**：保留 `final_lottery_participants` 表监听和表情监听作为备用
- **简化逻辑**：移除复杂的多重广播和轮询机制

```typescript
// 检测绝地翻盘获奖者（主要机制）
const finalLotteryWinners = currentUsers.filter(currentUser => {
  const lastUser = lastUsers.find(lu => lu.id === currentUser.id)
  return lastUser && 
         lastUser.order_number !== -1 && 
         currentUser.order_number === -1 // 使用 -1 标识绝地翻盘获胜者
})
```

#### 3. 简化游戏控制逻辑
- **移除复杂广播**：去掉表情标记、多重重试等复杂机制
- **统一触发**：主持人端直接调用 `onWinnerDrawn`，其他客户端通过实时监听触发

```typescript
// 简化后的绝地翻盘抽奖逻辑
const handleFinalLotteryDraw = async () => {
  const winner = await GameLogic.drawFinalLotteryWinner(room.id)
  
  // 主持人端立即显示弹窗
  if (onWinnerDrawn) {
    onWinnerDrawn({
      userId: winner.id,
      nickname: winner.nickname,
      orderNumber: 0, // 绝地翻盘获胜者特殊标识
      avatar: winner.avatar_url || undefined
    })
  }
  
  // 其他客户端通过实时监听自动触发
}
```

## 优化效果

### 技术改进
1. **统一触发机制**：所有客户端都监听相同的数据源（`users` 表）
2. **原子性操作**：使用数据库函数确保数据一致性
3. **简化架构**：移除复杂的多重广播和轮询机制
4. **提高稳定性**：减少故障点，提高弹窗显示的可靠性

### 用户体验改进
1. **一致性**：所有用户都能及时看到绝地翻盘获奖通知
2. **可靠性**：弹窗显示更加稳定，不再出现只有主持人看到的情况
3. **性能**：简化后的逻辑减少了不必要的网络请求和计算

## 测试验证

### 测试场景
1. **正常场景**：主持人点击绝地翻盘抽奖，所有客户端都应该看到弹窗
2. **网络不稳定**：在网络不稳定的情况下，实时监听是否能正常工作
3. **并发场景**：多个客户端同时在线时的弹窗显示情况

### 验证方法
1. **多端测试**：在不同设备上同时打开应用，验证弹窗同步性
2. **网络测试**：模拟网络延迟和断连情况
3. **压力测试**：多人同时在线的情况下进行测试

## 总结

通过参考第一阶段抽奖弹窗的成功实现，我们优化了绝地翻盘奖励弹窗的触发机制：

1. **统一了触发机制**：使用 `users` 表的 `order_number` 字段作为统一的数据源
2. **简化了实现复杂度**：移除了多重广播和轮询等复杂机制
3. **提高了系统稳定性**：原子性操作和统一监听确保了数据一致性
4. **改善了用户体验**：所有用户都能及时、一致地看到绝地翻盘获奖通知

这个优化让绝地翻盘奖励弹窗的实现与第一阶段抽奖弹窗保持了一致性，确保了系统的稳定性和用户体验的一致性。 