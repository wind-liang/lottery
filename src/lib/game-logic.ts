import { supabase } from './supabase'
import type { Database } from './supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']
type LotteryParticipant = Database['public']['Tables']['lottery_participants']['Row']
type Reward = Database['public']['Tables']['rewards']['Row']

export class GameLogic {

  // 验证主持人密码
  static verifyHostPassword(password: string): boolean {
    const hostPassword = process.env.NEXT_PUBLIC_HOST_PASSWORD || 'wedding2024'
    return password === hostPassword
  }

  // 检查房间是否可以开始抽奖
  static async canStartLottery(roomId: string): Promise<boolean> {
    try {
      const { data: room } = await supabase
        .from('rooms')
        .select('stage, is_lottery_locked')
        .eq('id', roomId)
        .single()
      
      if (!room) return false
      
      // 只有在等待阶段且抽奖未锁定时才能开始抽奖
      return room.stage === 'waiting' && !room.is_lottery_locked
    } catch (error) {
      console.error('检查抽奖状态失败:', error)
      return false
    }
  }

  // 获取抽奖参与者
  static async getLotteryParticipants(roomId: string): Promise<LotteryParticipant[]> {
    try {
      const { data, error } = await supabase
        .from('lottery_participants')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取抽奖参与者失败:', error)
      return []
    }
  }

  // 从抽奖箱中随机抽取一个参与者
  static async drawRandomParticipant(roomId: string): Promise<User | null> {
    try {
      // 获取未被抽中的参与者
      const { data: participants, error } = await supabase
        .from('lottery_participants')
        .select(`
          *,
          users (*)
        `)
        .eq('room_id', roomId)
        .eq('is_drawn', false)
      
      if (error) throw error
      if (!participants || participants.length === 0) return null
      
      // 随机选择一个参与者
      const randomIndex = Math.floor(Math.random() * participants.length)
      const selectedParticipant = participants[randomIndex]
      
      // 标记为已抽中
      await supabase
        .from('lottery_participants')
        .update({
          is_drawn: true,
          drawn_at: new Date().toISOString()
        })
        .eq('id', selectedParticipant.id)
      
      // 计算剩余人数+1作为顺序号
      const remainingCount = participants.length - 1
      const orderNumber = remainingCount + 1
      
      // 更新用户的顺序号
      await supabase
        .from('users')
        .update({ order_number: orderNumber })
        .eq('id', selectedParticipant.user_id)
      
      return selectedParticipant.users as User
    } catch (error) {
      console.error('抽奖失败:', error)
      return null
    }
  }

  // 检查是否所有参与者都已被抽中
  static async areAllParticipantsDrawn(roomId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('lottery_participants')
        .select('is_drawn')
        .eq('room_id', roomId)
      
      if (error) throw error
      if (!data || data.length === 0) return true
      
      return data.every(participant => participant.is_drawn)
    } catch (error) {
      console.error('检查抽奖状态失败:', error)
      return false
    }
  }

  // 获取按顺序排列的玩家
  static async getPlayersInOrder(roomId: string): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', roomId)
        .not('order_number', 'is', null)
        .order('order_number', { ascending: false }) // 第一名是最后被抽中的
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取玩家顺序失败:', error)
      return []
    }
  }

  // 获取房间的奖励列表 - 优化版本
  static async getRewards(roomId: string): Promise<Reward[]> {
    try {
      // 使用索引优化的查询
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('room_id', roomId)
        .order('order_index', { ascending: true })
      
      if (error) {
        console.error('🎁 [GameLogic] 获取奖励列表失败:', error)
        throw error
      }
      
      console.log('🎁 [GameLogic] 成功获取奖励列表:', data?.length || 0, '个奖励')
      return data || []
    } catch (error) {
      console.error('获取奖励列表失败:', error)
      return []
    }
  }

  // 选择奖励
  static async selectReward(userId: string, rewardId: string): Promise<boolean> {
    try {
      // 更新奖励表
      const { error: rewardError } = await supabase
        .from('rewards')
        .update({ selected_by: userId })
        .eq('id', rewardId)
        .is('selected_by', null) // 确保奖励还没被选择
      
      if (rewardError) {
        console.error('🎯 [selectReward] 更新奖励表失败:', rewardError)
        throw rewardError
      }
      
      // 更新用户的选择记录
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ selected_reward: rewardId })
        .eq('id', userId)
      
      if (userUpdateError) {
        console.error('🎯 [selectReward] 更新用户失败:', userUpdateError)
        throw userUpdateError
      }
      
      return true
    } catch (error) {
      console.error('选择奖励失败:', error)
      return false
    }
  }

  // 开始奖励选择流程
  static async startRewardSelection(roomId: string): Promise<boolean> {
    try {
      // 获取有排序的玩家列表
      const { data: players, error } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', roomId)
        .eq('role', 'player')
        .not('order_number', 'is', null)
        .order('order_number', { ascending: true })
      
      if (error) throw error
      
      if (!players || players.length === 0) {
        console.error('没有找到有排序的玩家')
        return false
      }
      
      // 设置第一个玩家为当前选择者
      const firstPlayer = players[0]
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ 
          current_selector: firstPlayer.id,
          selection_timeout: new Date(Date.now() + 30000).toISOString()
        })
        .eq('id', roomId)
      
      if (updateError) throw updateError
      
      return true
    } catch (error) {
      console.error('开始奖励选择失败:', error)
      return false
    }
  }

  // 获取下一个选择者
  static async getNextSelector(roomId: string): Promise<User | null> {
    try {
      const { data: players, error } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', roomId)
        .eq('role', 'player')
        .not('order_number', 'is', null)
        .order('order_number', { ascending: true })
      
      if (error) {
        console.error('🔍 [getNextSelector] 查询玩家失败:', error)
        throw error
      }
      
      // 找到第一个还没有选择奖励的玩家
      const nextPlayer = players?.find(player => !player.selected_reward)
      
      return nextPlayer || null
    } catch (error) {
      console.error('获取下一个选择者失败:', error)
      return null
    }
  }

  // 检查所有人是否选择完毕
  static async areAllRewardSelectionComplete(roomId: string): Promise<boolean> {
    try {
      const { data: players, error } = await supabase
        .from('users')
        .select('id, nickname, order_number, selected_reward')
        .eq('room_id', roomId)
        .eq('role', 'player')
        .not('order_number', 'is', null)
        .order('order_number', { ascending: true })
      
      if (error) {
        console.error('🔍 [areAllRewardSelectionComplete] 查询玩家失败:', error)
        throw error
      }
      
      // 检查是否所有玩家都选择了奖励
      return players?.every(player => !!player.selected_reward) || false
    } catch (error) {
      console.error('检查奖励选择完成状态失败:', error)
      return false
    }
  }

  // 获取最后5名玩家（用于绝地翻盘）
  static async getLastFivePlayers(roomId: string): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', roomId)
        .not('order_number', 'is', null)
        .order('order_number', { ascending: false })
        .limit(5)
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取最后5名玩家失败:', error)
      return []
    }
  }

  // 创建绝地翻盘抽奖箱（按权重添加玩家到专门的绝地翻盘表）
  static async setupFinalLotteryBox(roomId: string): Promise<boolean> {
    try {
      // 先获取最后5名玩家，确保有合格玩家再清空
      const lastFivePlayers = await this.getLastFivePlayers(roomId)
      
      if (lastFivePlayers.length === 0) {
        console.error('❌ [setupFinalLotteryBox] 没有找到参与绝地翻盘的玩家')
        return false
      }
      
      // 清空绝地翻盘抽奖参与者表
      const { error: deleteError } = await supabase
        .from('final_lottery_participants')
        .delete()
        .eq('room_id', roomId)
      
      if (deleteError) {
        console.error('❌ [setupFinalLotteryBox] 清空绝地翻盘抽奖参与者失败:', deleteError)
        return false
      }
      
      // 为每个玩家创建一条记录，设置相应的权重
      const insertEntries = []
      
      for (let i = 0; i < lastFivePlayers.length; i++) {
        const player = lastFivePlayers[i]
        const weight = lastFivePlayers.length - i // 排名越靠后权重越高
        
        console.log(`🎯 [setupFinalLotteryBox] 玩家 ${player.nickname} (第${player.order_number}名) 权重: ${weight}`)
        
        // 每个玩家只插入一条记录，设置相应权重
        insertEntries.push({
          room_id: roomId,
          user_id: player.id,
          weight: weight
        })
      }
      
      console.log(`🎯 [setupFinalLotteryBox] 准备插入 ${insertEntries.length} 个绝地翻盘玩家记录:`, insertEntries)
      
      // 批量插入抽奖条目到绝地翻盘表
      const { error: insertError } = await supabase
        .from('final_lottery_participants')
        .insert(insertEntries)
      
      if (insertError) {
        console.error('❌ [setupFinalLotteryBox] 插入绝地翻盘抽奖条目失败:', insertError)
        return false
      }
      
      return true
    } catch (error) {
      console.error('❌ [setupFinalLotteryBox] 设置绝地翻盘抽奖箱失败:', error)
      return false
    }
  }

  // 诊断绝地翻盘问题的函数
  static async diagnoseFinalLotteryIssue(roomId: string): Promise<void> {
    try {
      // 1. 检查房间信息
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()
      
      if (roomError) {
        console.error('❌ [诊断] 获取房间信息失败:', roomError)
        return
      }
      
      console.log('🏠 [诊断] 房间信息:', room)
      
      // 2. 检查用户排名情况
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, nickname, role, order_number')
        .eq('room_id', roomId)
        .not('order_number', 'is', null)
        .order('order_number', { ascending: false })
      
      if (usersError) {
        console.error('❌ [诊断] 获取用户排名失败:', usersError)
        return
      }
      
      console.log('👥 [诊断] 用户排名:', users)
      
      // 3. 检查绝地翻盘抽奖参与者
      const { data: finalParticipants, error: finalParticipantsError } = await supabase
        .from('final_lottery_participants')
        .select(`
          *,
          users (
            id,
            nickname,
            order_number
          )
        `)
        .eq('room_id', roomId)
      
      if (finalParticipantsError) {
        console.error('❌ [诊断] 获取绝地翻盘参与者失败:', finalParticipantsError)
        return
      }
      
      console.log('🎲 [诊断] 绝地翻盘参与者:', finalParticipants)
      
      // 4. 统计分析
      const totalUsers = users?.length || 0
      const totalFinalParticipants = finalParticipants?.length || 0
      const drawnFinalParticipants = finalParticipants?.filter(p => p.is_drawn).length || 0
      
      console.log('📊 [诊断] 统计分析:', {
        totalUsers,
        totalFinalParticipants,
        drawnFinalParticipants
      })
      
    } catch (error) {
      console.error('❌ [诊断] 诊断过程出错:', error)
    }
  }

  // 抽取绝地翻盘获胜者（使用加权随机算法）
  static async drawFinalLotteryWinner(roomId: string): Promise<User | null> {
    try {
      console.log('🎯 [drawFinalLotteryWinner] 开始获取绝地翻盘参与者')
      
      // 获取所有未被抽中的绝地翻盘参与者
      const { data: participants, error } = await supabase
        .from('final_lottery_participants')
        .select(`
          *,
          users (
            id,
            nickname,
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .eq('is_drawn', false)
      
      if (error) {
        console.error('❌ [drawFinalLotteryWinner] 获取绝地翻盘参与者失败:', error)
        return null
      }
      
      console.log('🎯 [drawFinalLotteryWinner] 获取到参与者:', participants?.length || 0)
      
      if (!participants || participants.length === 0) {
        console.error('❌ [drawFinalLotteryWinner] 没有找到参与者')
        return null
      }
      
      // 计算总权重
      const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0)
      console.log('🎯 [drawFinalLotteryWinner] 总权重:', totalWeight)
      
      // 生成随机数 (0 到 totalWeight-1)
      const randomWeight = Math.floor(Math.random() * totalWeight)
      console.log('🎯 [drawFinalLotteryWinner] 随机权重:', randomWeight)
      
      // 根据权重分布选择获胜者
      let currentWeight = 0
      let selectedParticipant = null
      
      for (const participant of participants) {
        currentWeight += participant.weight
        if (randomWeight < currentWeight) {
          selectedParticipant = participant
          break
        }
      }
      
      if (!selectedParticipant) {
        console.error('❌ [drawFinalLotteryWinner] 加权随机算法失败')
        return null
      }
      
      console.log('🎯 [drawFinalLotteryWinner] 选中的参与者:', selectedParticipant.users.nickname)
      
      // 使用数据库事务确保原子性操作
      const { error: transactionError } = await supabase.rpc('draw_final_lottery_winner', {
        participant_id: selectedParticipant.id,
        winner_user_id: selectedParticipant.user_id
      })
      
      if (transactionError) {
        console.error('❌ [drawFinalLotteryWinner] 事务执行失败:', transactionError)
        
        // 如果 RPC 函数不存在，则回退到手动事务
        console.log('🔄 [drawFinalLotteryWinner] 回退到手动事务处理')
        
        // 步骤1：标记绝地翻盘参与者为已抽中
        const { error: updateParticipantError } = await supabase
          .from('final_lottery_participants')
          .update({ 
            is_drawn: true, 
            drawn_at: new Date().toISOString() 
          })
          .eq('id', selectedParticipant.id)
        
        if (updateParticipantError) {
          console.error('❌ [drawFinalLotteryWinner] 更新绝地翻盘参与者失败:', updateParticipantError)
          return null
        }
        
        // 步骤2：在用户表中标记获胜者（使用特殊的 order_number: -1 表示绝地翻盘获胜者）
        const { error: updateUserError } = await supabase
          .from('users')
          .update({ 
            order_number: -1, // 使用 -1 标识绝地翻盘获胜者
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedParticipant.user_id)
        
        if (updateUserError) {
          console.error('❌ [drawFinalLotteryWinner] 更新用户获胜标记失败:', updateUserError)
          
          // 如果更新用户表失败，回滚绝地翻盘参与者表的更新
          await supabase
            .from('final_lottery_participants')
            .update({ 
              is_drawn: false, 
              drawn_at: null 
            })
            .eq('id', selectedParticipant.id)
          
          return null
        }
      }
      
      console.log('✅ [drawFinalLotteryWinner] 绝地翻盘获胜者更新成功')
      
      // 等待短时间确保实时监听有时间处理
      await new Promise(resolve => setTimeout(resolve, 300))
      
      return selectedParticipant.users
    } catch (error) {
      console.error('❌ [drawFinalLotteryWinner] 绝地翻盘抽奖失败:', error)
      return null
    }
  }

  // 更新房间阶段
  static async updateRoomStage(roomId: string, stage: Room['stage']): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ stage })
        .eq('id', roomId)
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('更新房间阶段失败:', error)
      return false
    }
  }

  // 锁定/解锁抽奖
  static async setLotteryLocked(roomId: string, locked: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ 
          is_lottery_locked: locked,
          // 添加锁定时间戳，用于超时保护
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
      
      if (error) throw error
      
      console.log(locked ? '🔒 [锁定] 抽奖已锁定' : '🔓 [解锁] 抽奖已解锁')
      return true
    } catch (error) {
      console.error('设置抽奖锁定状态失败:', error)
      return false
    }
  }

  // 带超时保护的锁定方法
  static async setLotteryLockedWithTimeout(roomId: string, timeoutMs: number = 10000): Promise<boolean> {
    try {
      // 先设置锁定
      const lockResult = await this.setLotteryLocked(roomId, true)
      if (!lockResult) return false

      // 设置超时保护 - 防止抽奖过程中出现异常导致永久锁定
      setTimeout(async () => {
        console.log('⏰ [超时保护] 检查锁定状态...')
        const { data: room } = await supabase
          .from('rooms')
          .select('is_lottery_locked, updated_at')
          .eq('id', roomId)
          .single()
        
        if (room?.is_lottery_locked) {
          const lockTime = new Date(room.updated_at).getTime()
          const now = new Date().getTime()
          const timeDiff = now - lockTime
          
          // 如果锁定时间超过预期，强制解锁
          if (timeDiff > timeoutMs) {
            console.log('⚠️ [超时保护] 检测到异常锁定，强制解锁')
            await this.setLotteryLocked(roomId, false)
          }
        }
      }, timeoutMs + 2000) // 多等2秒作为缓冲

      return true
    } catch (error) {
      console.error('设置带超时保护的锁定失败:', error)
      return false
    }
  }

  // 检查锁定状态并自动恢复
  static async checkAndRecoverLockStatus(roomId: string): Promise<boolean> {
    try {
      const { data: room } = await supabase
        .from('rooms')
        .select('is_lottery_locked, updated_at, stage')
        .eq('id', roomId)
        .single()
      
      if (!room || !room.is_lottery_locked) {
        return true // 未锁定或房间不存在
      }

      const lockTime = new Date(room.updated_at).getTime()
      const now = new Date().getTime()
      const timeDiff = now - lockTime

      // 如果锁定时间超过15秒，认为是异常锁定
      if (timeDiff > 15000) {
        console.log('🚨 [自动恢复] 检测到异常锁定，自动解锁')
        await this.setLotteryLocked(roomId, false)
        return false // 返回false表示发生了异常恢复
      }

      return true // 正常锁定状态
    } catch (error) {
      console.error('检查锁定状态失败:', error)
      return true
    }
  }

  // 强制解锁（紧急情况使用）
  static async forceUnlock(roomId: string): Promise<boolean> {
    try {
      console.log('🚨 [强制解锁] 执行强制解锁操作')
      const result = await this.setLotteryLocked(roomId, false)
      
      if (result) {
        console.log('✅ [强制解锁] 强制解锁成功')
      } else {
        console.error('❌ [强制解锁] 强制解锁失败')
      }
      
      return result
    } catch (error) {
      console.error('强制解锁失败:', error)
      return false
    }
  }

  // 发送表情 - 优化版本：减少数据库查询次数
  static async sendEmoji(userId: string, roomId: string, emoji: string): Promise<boolean> {
    const MAX_RETRIES = 2
    const RETRY_DELAY = 1000 // 减少重试延迟到1秒
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🎭 [发送表情] 尝试第 ${attempt} 次发送:`, { userId, roomId, emoji })
        
        // 检查网络连接状态
        if (typeof window !== 'undefined' && 'navigator' in window && !navigator.onLine) {
          throw new Error('网络连接已断开，请检查网络后重试')
        }
        
        const expiresAt = new Date()
        expiresAt.setSeconds(expiresAt.getSeconds() + 5) // 5秒后过期
        
        // 优化：直接更新用户表，如果用户不存在会自动失败
        // 移除不必要的用户存在性检查，减少一次数据库查询
        const { data, error } = await supabase
          .from('users')
          .update({
            current_emoji: emoji,
            emoji_expires_at: expiresAt.toISOString()
          })
          .eq('id', userId)
          .eq('room_id', roomId) // 添加房间ID检查，提高安全性
          .select('id, nickname, current_emoji, emoji_expires_at')
          .single()

        if (error) {
          console.error(`🎭 [发送表情] 第${attempt}次尝试失败:`, error)
          if (error.code === 'PGRST116') { // 用户不存在
            throw new Error('用户不存在或不在该房间，请重新加入房间')
          }
          if (attempt === MAX_RETRIES) {
            throw new Error('发送表情失败，请稍后重试')
          }
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          continue
        }

        console.log('🎭 [发送表情] 发送成功:', data)
        
        // 优化：异步插入表情记录，不阻塞主流程
        // 使用Promise.resolve包装，避免阻塞用户反馈
        Promise.resolve().then(async () => {
          try {
            const { error: insertError } = await supabase
              .from('emojis')
              .insert({
                user_id: userId,
                room_id: roomId,
                emoji: emoji,
                expires_at: expiresAt.toISOString()
              })

            if (insertError) {
              console.error('🎭 [发送表情] 插入表情记录失败:', insertError)
            }
          } catch (insertError) {
            console.error('🎭 [发送表情] 插入表情记录异常:', insertError)
          }
        })

        return true

      } catch (error) {
        console.error(`🎭 [发送表情] 第${attempt}次尝试异常:`, error)
        
        if (attempt === MAX_RETRIES) {
          console.error('🎭 [发送表情] 所有重试均失败:', error)
          throw error
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      }
    }
    
    return false
  }

  // 清理过期表情
  static async cleanupExpiredEmojis(): Promise<void> {
    try {
      await supabase.rpc('cleanup_expired_user_emojis')
    } catch (error) {
      console.error('清理过期表情失败:', error)
    }
  }

  // 重置游戏
  static async resetGame(roomId: string): Promise<boolean> {
    try {
      // 开始事务
      const { error: deleteParticipantsError } = await supabase
        .from('lottery_participants')
        .delete()
        .eq('room_id', roomId)
      
      if (deleteParticipantsError) throw deleteParticipantsError
      
      // 清理绝地翻盘参与者表
      const { error: deleteFinalLotteryParticipantsError } = await supabase
        .from('final_lottery_participants')
        .delete()
        .eq('room_id', roomId)
      
      if (deleteFinalLotteryParticipantsError) throw deleteFinalLotteryParticipantsError
      
      const { error: deleteEmojisError } = await supabase
        .from('emojis')
        .delete()
        .eq('room_id', roomId)
      
      if (deleteEmojisError) throw deleteEmojisError
      
      const { error: resetUsersError } = await supabase
        .from('users')
        .update({
          role: 'audience',
          order_number: null,
          selected_reward: null
        })
        .eq('room_id', roomId)
      
      if (resetUsersError) throw resetUsersError
      
      const { error: resetRewardsError } = await supabase
        .from('rewards')
        .update({ selected_by: null })
        .eq('room_id', roomId)
      
      if (resetRewardsError) throw resetRewardsError
      
      const { error: resetRoomError } = await supabase
        .from('rooms')
        .update({
          stage: 'waiting',
          is_lottery_locked: false,
          current_selector: null,
          selection_timeout: null
        })
        .eq('id', roomId)
      
      if (resetRoomError) throw resetRoomError
      
      return true
    } catch (error) {
      console.error('重置游戏失败:', error)
      return false
    }
  }
} 