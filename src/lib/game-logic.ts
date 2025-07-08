import { supabase } from './supabase'
import type { Database } from './supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']
type LotteryParticipant = Database['public']['Tables']['lottery_participants']['Row']
type Reward = Database['public']['Tables']['rewards']['Row']

export class GameLogic {
  // 生成随机昵称
  static generateNickname(): string {
    const adjectives = ['幸运的', '快乐的', '勇敢的', '聪明的', '可爱的', '优雅的', '神秘的', '闪亮的']
    const nouns = ['小熊', '星星', '花朵', '彩虹', '蝴蝶', '珍珠', '钻石', '天使']
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const num = Math.floor(Math.random() * 999) + 1
    return `${adj}${noun}${num}`
  }

  // 生成随机头像URL
  static generateAvatarUrl(): string {
    const avatarId = Math.floor(Math.random() * 1000000) + 1  // 增加随机性
    const timestamp = Date.now()
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarId}-${timestamp}`
  }

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

  // 获取房间的奖励列表
  static async getRewards(roomId: string): Promise<Reward[]> {
    try {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('room_id', roomId)
        .order('order_index', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取奖励列表失败:', error)
      return []
    }
  }

  // 选择奖励
  static async selectReward(userId: string, rewardId: string): Promise<boolean> {
    try {
      console.log('🎯 [selectReward] 开始选择奖励:', { userId, rewardId })
      
      // 先查询用户信息
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, nickname, selected_reward')
        .eq('id', userId)
        .single()
      
      if (userError) {
        console.error('🎯 [selectReward] 查询用户失败:', userError)
        throw userError
      }
      
      console.log('🎯 [selectReward] 用户信息:', user)
      
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
      
      console.log('🎯 [selectReward] 奖励表更新成功')
      
      // 更新用户的选择记录
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ selected_reward: rewardId })
        .eq('id', userId)
      
      if (userUpdateError) {
        console.error('🎯 [selectReward] 更新用户失败:', userUpdateError)
        throw userUpdateError
      }
      
      console.log('🎯 [selectReward] 用户表更新成功')
      
      // 验证更新结果
      const { data: updatedUser, error: verifyError } = await supabase
        .from('users')
        .select('id, nickname, selected_reward')
        .eq('id', userId)
        .single()
      
      if (verifyError) {
        console.error('🎯 [selectReward] 验证更新失败:', verifyError)
      } else {
        console.log('🎯 [selectReward] 验证更新结果:', updatedUser)
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
      console.log('🔍 [getNextSelector] 开始查找下一个选择者，房间ID:', roomId)
      
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
      
      console.log('🔍 [getNextSelector] 找到的玩家列表:', players?.map(p => ({
        id: p.id,
        nickname: p.nickname,
        orderNumber: p.order_number,
        selectedReward: p.selected_reward,
        hasSelected: !!p.selected_reward
      })))
      
      // 找到第一个还没有选择奖励的玩家
      const nextPlayer = players?.find(player => {
        const hasSelected = !!player.selected_reward
        console.log(`🔍 [getNextSelector] 检查玩家 ${player.nickname} (Order: ${player.order_number}): hasSelected=${hasSelected}, selected_reward=${player.selected_reward}`)
        return !hasSelected
      })
      
      console.log('🔍 [getNextSelector] 找到的下一个选择者:', nextPlayer ? {
        id: nextPlayer.id,
        nickname: nextPlayer.nickname,
        orderNumber: nextPlayer.order_number,
        selectedReward: nextPlayer.selected_reward
      } : '没有找到')
      
      return nextPlayer || null
    } catch (error) {
      console.error('获取下一个选择者失败:', error)
      return null
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
      console.log('🎯 [setupFinalLotteryBox] 开始设置绝地翻盘抽奖箱，房间ID:', roomId)
      
      // 先获取最后5名玩家，确保有合格玩家再清空
      const lastFivePlayers = await this.getLastFivePlayers(roomId)
      
      console.log('🎯 [setupFinalLotteryBox] 找到的最后5名玩家:', lastFivePlayers.map(p => ({
        id: p.id,
        nickname: p.nickname,
        orderNumber: p.order_number
      })))
      
      if (lastFivePlayers.length === 0) {
        console.error('❌ [setupFinalLotteryBox] 没有找到参与绝地翻盘的玩家')
        return false
      }
      
      // 清空绝地翻盘抽奖参与者表
      console.log('🎯 [setupFinalLotteryBox] 清空绝地翻盘抽奖参与者表...')
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
      const { data: insertData, error: insertError } = await supabase
        .from('final_lottery_participants')
        .insert(insertEntries)
      
      if (insertError) {
        console.error('❌ [setupFinalLotteryBox] 插入绝地翻盘抽奖条目失败:', insertError)
        return false
      }
      
      console.log('✅ [setupFinalLotteryBox] 绝地翻盘抽奖条目插入成功:', insertData)
      
      // 验证插入结果
      const { data: verifyData, error: verifyError } = await supabase
        .from('final_lottery_participants')
        .select('*, users(nickname, order_number)')
        .eq('room_id', roomId)
      
      if (verifyError) {
        console.error('❌ [setupFinalLotteryBox] 验证绝地翻盘抽奖条目失败:', verifyError)
        return false
      }
      
      console.log(`✅ [setupFinalLotteryBox] 绝地翻盘抽奖箱设置完成！共 ${verifyData?.length || 0} 个玩家参与`)
      verifyData?.forEach(entry => {
        console.log(`  - ${entry.users?.nickname} (第${entry.users?.order_number}名): 权重 ${entry.weight}`)
      })
      
      return true
    } catch (error) {
      console.error('❌ [setupFinalLotteryBox] 设置绝地翻盘抽奖箱失败:', error)
      return false
    }
  }

  // 诊断绝地翻盘问题的函数
  static async diagnoseFinalLotteryIssue(roomId: string): Promise<void> {
    try {
      console.log('🔍 [诊断] 开始诊断绝地翻盘问题，房间ID:', roomId)
      
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
      
      console.log('🔍 [诊断] 房间信息:', {
        name: room.name,
        stage: room.stage,
        current_selector: room.current_selector
      })
      
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
      
      console.log('🔍 [诊断] 有排名的用户:', users?.map(u => ({
        nickname: u.nickname,
        order: u.order_number
      })) || [])
      
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
      
      console.log('🔍 [诊断] 绝地翻盘参与者数量:', finalParticipants?.length || 0)
      
      if (finalParticipants && finalParticipants.length > 0) {
        // 计算总权重和概率
        const totalWeight = finalParticipants.reduce((sum, p) => sum + p.weight, 0)
        console.log('🔍 [诊断] 绝地翻盘参与者详情:')
        finalParticipants.forEach(p => {
          const probability = ((p.weight / totalWeight) * 100).toFixed(1)
          console.log(`  - ${p.users?.nickname} (第${p.users?.order_number}名): 权重 ${p.weight}, 概率 ${probability}%, 已抽中: ${p.is_drawn}`)
        })
      } else {
        console.log('🔍 [诊断] 绝地翻盘参与者详情: 无')
      }
      
      // 4. 统计分析
      const totalUsers = users?.length || 0
      const totalFinalParticipants = finalParticipants?.length || 0
      const drawnFinalParticipants = finalParticipants?.filter(p => p.is_drawn).length || 0
      
      console.log('🔍 [诊断] 统计信息:')
      console.log(`  - 有排名的用户: ${totalUsers} 人`)
      console.log(`  - 绝地翻盘参与者: ${totalFinalParticipants} 人`)
      console.log(`  - 已抽中的参与者: ${drawnFinalParticipants} 人`)
      console.log(`  - 剩余可抽参与者: ${totalFinalParticipants - drawnFinalParticipants} 人`)
      
      // 5. 问题诊断
      if (totalUsers === 0) {
        console.log('⚠️ [诊断] 问题: 没有用户有排名，需要先完成第一轮抽奖')
      } else if (totalFinalParticipants === 0) {
        console.log('⚠️ [诊断] 问题: 绝地翻盘抽奖箱为空，需要点击"进入绝地翻盘"按钮设置')
      } else if (totalFinalParticipants === drawnFinalParticipants) {
        console.log('⚠️ [诊断] 问题: 所有绝地翻盘参与者都已抽完')
      } else {
        console.log('✅ [诊断] 绝地翻盘功能正常，可以进行抽奖')
      }
      
    } catch (error) {
      console.error('❌ [诊断] 诊断过程出错:', error)
    }
  }

  // 抽取绝地翻盘获胜者（使用加权随机算法）
  static async drawFinalLotteryWinner(roomId: string): Promise<User | null> {
    try {
      console.log('🎯 [drawFinalLotteryWinner] 开始绝地翻盘抽奖，房间ID:', roomId)
      
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
      
      console.log('🎯 [drawFinalLotteryWinner] 绝地翻盘参与者数量:', participants?.length || 0)
      
      if (!participants || participants.length === 0) {
        console.log('❌ [drawFinalLotteryWinner] 没有绝地翻盘参与者可以抽取')
        return null
      }
      
      // 计算总权重
      const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0)
      console.log('🎯 [drawFinalLotteryWinner] 总权重:', totalWeight)
      
      // 显示每个参与者的权重和概率
      participants.forEach(p => {
        const probability = ((p.weight / totalWeight) * 100).toFixed(1)
        console.log(`  - ${p.users?.nickname}: 权重 ${p.weight}, 中奖概率 ${probability}%`)
      })
      
      // 生成随机数 (0 到 totalWeight-1)
      const randomWeight = Math.floor(Math.random() * totalWeight)
      console.log('🎯 [drawFinalLotteryWinner] 随机权重值:', randomWeight)
      
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
      
      console.log('🎯 [drawFinalLotteryWinner] 选中的绝地翻盘获胜者:', selectedParticipant.users?.nickname)
      
      // 标记该参与者为已抽中
      const { error: updateError } = await supabase
        .from('final_lottery_participants')
        .update({ 
          is_drawn: true, 
          drawn_at: new Date().toISOString() 
        })
        .eq('id', selectedParticipant.id)
      
      if (updateError) {
        console.error('❌ [drawFinalLotteryWinner] 更新绝地翻盘抽奖状态失败:', updateError)
        return null
      }
      
      console.log('✅ [drawFinalLotteryWinner] 绝地翻盘获胜者抽取成功')
      
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
        .update({ is_lottery_locked: locked })
        .eq('id', roomId)
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('设置抽奖锁定状态失败:', error)
      return false
    }
  }

  // 发送表情
  static async sendEmoji(userId: string, roomId: string, emoji: string): Promise<boolean> {
    try {
      const expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + 5) // 5秒后过期
      
      console.log('🎭 GameLogic.sendEmoji 开始:', {
        userId,
        roomId,
        emoji,
        expiresAt: expiresAt.toISOString()
      })
      
      // 先检查用户是否存在
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, nickname, current_emoji, emoji_expires_at')
        .eq('id', userId)
        .single()
      
      if (checkError) {
        console.error('🎭 查询用户失败:', checkError)
        throw checkError
      }
      
      console.log('🎭 找到用户:', existingUser)
      
      const { data, error } = await supabase
        .from('users')
        .update({
          current_emoji: emoji,
          emoji_expires_at: expiresAt.toISOString()
        })
        .eq('id', userId)
        .select('id, nickname, current_emoji, emoji_expires_at')
      
      if (error) {
        console.error('🎭 数据库更新失败:', error)
        throw error
      }
      
      console.log('🎭 数据库更新成功:', data)
      
      // 验证更新结果
      if (!data || data.length === 0) {
        console.error('🎭 更新失败：没有找到匹配的用户记录')
        throw new Error('更新失败：没有找到匹配的用户记录')
      }
      
      const updatedUser = data[0]
      if (updatedUser.current_emoji !== emoji) {
        console.error('🎭 更新失败：表情字段更新不正确', {
          expected: emoji,
          actual: updatedUser.current_emoji
        })
        throw new Error('表情字段更新不正确')
      }
      
      console.log('🎭 表情更新验证成功:', updatedUser)
      
      // 再次查询数据库验证是否真的更新了
      console.log('🔍 重新查询数据库验证更新结果...')
      const { data: verifyUser, error: verifyError } = await supabase
        .from('users')
        .select('id, nickname, current_emoji, emoji_expires_at')
        .eq('id', userId)
        .single()
      
      if (verifyError) {
        console.error('🎭 验证查询失败:', verifyError)
      } else {
        console.log('🎭 数据库实际状态:', verifyUser)
        
        if (verifyUser.current_emoji !== emoji) {
          console.error('🚨 严重错误：数据库实际没有更新！', {
            expected: emoji,
            actual: verifyUser.current_emoji,
            userInDb: verifyUser
          })
          throw new Error(`数据库实际没有更新！期望: ${emoji}, 实际: ${verifyUser.current_emoji}`)
        } else {
          console.log('✅ 数据库实际更新确认成功!')
        }
      }
      
      return true
    } catch (error) {
      console.error('发送表情失败:', error)
      return false
    }
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