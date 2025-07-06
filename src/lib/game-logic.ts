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
    const avatarId = Math.floor(Math.random() * 100) + 1
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarId}`
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
      const { error } = await supabase
        .from('rewards')
        .update({ selected_by: userId })
        .eq('id', rewardId)
        .is('selected_by', null) // 确保奖励还没被选择
      
      if (error) throw error
      
      // 更新用户的选择记录
      await supabase
        .from('users')
        .update({ selected_reward: parseInt(rewardId) })
        .eq('id', userId)
      
      return true
    } catch (error) {
      console.error('选择奖励失败:', error)
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
        .order('order_number', { ascending: true })
        .limit(5)
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('获取最后5名玩家失败:', error)
      return []
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
      expiresAt.setSeconds(expiresAt.getSeconds() + 2) // 2秒后过期
      
      const { error } = await supabase
        .from('emojis')
        .insert({
          user_id: userId,
          room_id: roomId,
          emoji,
          expires_at: expiresAt.toISOString()
        })
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('发送表情失败:', error)
      return false
    }
  }

  // 清理过期表情
  static async cleanupExpiredEmojis(): Promise<void> {
    try {
      await supabase.rpc('cleanup_expired_emojis')
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