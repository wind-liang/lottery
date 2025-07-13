'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import type { Database } from './supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']
type Reward = Database['public']['Tables']['rewards']['Row']

interface UseRealtimeOptimizedProps {
  roomId: string | null
  onUsersChange?: (users: User[]) => void
  onRoomChange?: (room: Room) => void
  onRewardsChange?: (rewards: Reward[]) => void
  onEmojiReceived?: (emoji: { userId: string, emoji: string, nickname: string }) => void
  onUserJoined?: (user: User) => void
  onUserLeft?: (userId: string) => void
  onWinnerDrawn?: (winner: { userId: string; nickname: string; orderNumber: number; avatar?: string }) => void
}

export function useRealtimeOptimized({
  roomId,
  onUsersChange,
  onRoomChange,
  onRewardsChange,
  onEmojiReceived,
  onUserJoined,
  onUserLeft,
  onWinnerDrawn
}: UseRealtimeOptimizedProps) {
  const channelsRef = useRef<RealtimeChannel[]>([])
  const lastUsersRef = useRef<User[]>([])
  
  // 获取房间内的所有用户（优化版本 - 增量更新逻辑）
  const fetchRoomUsers = useCallback(async () => {
    if (!roomId) return

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', roomId)
        .order('display_order', { ascending: true })

      if (error) {
        console.error('❌ [Realtime] 获取用户列表失败:', error)
        return
      }

      // 检测变化（使用原始逻辑确保兼容性）
      const currentUsers = users || []
      const lastUsers = lastUsersRef.current
      
      if (lastUsers.length > 0) {
        // 检测新用户加入
        const newUsers = currentUsers.filter(
          currentUser => !lastUsers.some(lastUser => lastUser.id === currentUser.id)
        )
        
        // 检测用户离开
        const leftUsers = lastUsers.filter(
          lastUser => !currentUsers.some(currentUser => currentUser.id === lastUser.id)
        )
        
        // 检测获奖者（order_number字段从null变为有值）
        const newWinners = currentUsers.filter(currentUser => {
          const lastUser = lastUsers.find(lu => lu.id === currentUser.id)
          return lastUser && 
                 lastUser.order_number === null && 
                 currentUser.order_number !== null &&
                 currentUser.order_number > 0 // 只处理正常抽奖获奖者
        })
        
        // 检测绝地翻盘获奖者（order_number 从非-1变为-1）
        const finalLotteryWinners = currentUsers.filter(currentUser => {
          const lastUser = lastUsers.find(lu => lu.id === currentUser.id)
          return lastUser && 
                 lastUser.order_number !== -1 && 
                 currentUser.order_number === -1 // 使用 -1 标识绝地翻盘获胜者
        })
        
        // 检测绝地翻盘获奖者（通过表情 🏆 标识 - 保留作为备用机制）
        const finalLotteryWinnersByEmoji = currentUsers.filter(currentUser => {
          const lastUser = lastUsers.find(lu => lu.id === currentUser.id)
          return lastUser && 
                 lastUser.current_emoji !== '🏆' && 
                 currentUser.current_emoji === '🏆' &&
                 currentUser.order_number !== -1 // 避免重复检测
        })
        
        newUsers.forEach(user => {
          onUserJoined?.(user)
        })
        
        leftUsers.forEach(user => {
          onUserLeft?.(user.id)
        })
        
        newWinners.forEach(winner => {
          if (onWinnerDrawn && winner.order_number) {
            console.log('🏆 [Realtime] 检测到正常抽奖获奖者:', winner.nickname, '排名:', winner.order_number)
            onWinnerDrawn({
              userId: winner.id,
              nickname: winner.nickname,
              orderNumber: winner.order_number,
              avatar: winner.avatar_url || undefined
            })
          }
        })
        
        // 处理绝地翻盘获奖者（主要机制）
        finalLotteryWinners.forEach(winner => {
          if (onWinnerDrawn) {
            console.log('🏆 [Realtime] 检测到绝地翻盘获奖者 (order_number):', winner.nickname)
            onWinnerDrawn({
              userId: winner.id,
              nickname: winner.nickname,
              orderNumber: 0, // 绝地翻盘获胜者特殊标识
              avatar: winner.avatar_url || undefined
            })
          }
        })
        
        // 处理绝地翻盘获奖者（备用机制）
        finalLotteryWinnersByEmoji.forEach(winner => {
          if (onWinnerDrawn) {
            console.log('🏆 [Realtime] 检测到绝地翻盘获奖者 (emoji):', winner.nickname)
            onWinnerDrawn({
              userId: winner.id,
              nickname: winner.nickname,
              orderNumber: 0, // 绝地翻盘获胜者特殊标识
              avatar: winner.avatar_url || undefined
            })
          }
        })
      }
      
      lastUsersRef.current = currentUsers
      onUsersChange?.(currentUsers)
    } catch (error) {
      console.error('❌ [Realtime] 获取房间用户失败:', error)
    }
  }, [roomId, onUsersChange, onUserJoined, onUserLeft, onWinnerDrawn])

  // 获取房间信息
  const fetchRoom = useCallback(async () => {
    if (!roomId) return

    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (error) {
      console.error('❌ [Realtime] 获取房间信息失败:', error)
      return
    }

    onRoomChange?.(room)
  }, [roomId, onRoomChange])

  // 获取奖励列表
  const fetchRewards = useCallback(async () => {
    if (!roomId) return

    try {
      const { data: rewards, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('room_id', roomId)
        .order('order_index', { ascending: true })

      if (error) {
        console.error('❌ [Realtime] 获取奖励列表失败:', error)
        return
      }

      onRewardsChange?.(rewards || [])
    } catch (error) {
      console.error('❌ [Realtime] 获取奖励列表失败:', error)
    }
  }, [roomId, onRewardsChange])

  // 防抖定时器引用
  const usersFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const roomFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const rewardsFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchTimeRef = useRef<number>(0)

  // 防抖函数
  const debouncedFetchUsers = useCallback(() => {
    const now = Date.now()
    
    if (now - lastFetchTimeRef.current < 500) {
      return
    }
    
    if (usersFetchTimeoutRef.current) {
      clearTimeout(usersFetchTimeoutRef.current)
    }
    
    usersFetchTimeoutRef.current = setTimeout(() => {
      lastFetchTimeRef.current = Date.now()
      fetchRoomUsers()
    }, 200) // 进一步减少防抖时间，提高响应速度
  }, [fetchRoomUsers])

  const debouncedFetchRoom = useCallback(() => {
    if (roomFetchTimeoutRef.current) {
      clearTimeout(roomFetchTimeoutRef.current)
    }
    roomFetchTimeoutRef.current = setTimeout(() => {
      fetchRoom()
    }, 200)
  }, [fetchRoom])

  const debouncedFetchRewards = useCallback(() => {
    if (rewardsFetchTimeoutRef.current) {
      clearTimeout(rewardsFetchTimeoutRef.current)
    }
    rewardsFetchTimeoutRef.current = setTimeout(() => {
      fetchRewards()
    }, 200)
  }, [fetchRewards])

  // 连接重试机制
  const retryConnection = useCallback(async (channel: RealtimeChannel, maxRetries = 3) => {
    let retries = 0
    
    const attemptConnect = async () => {
      try {
        await channel.subscribe()
        console.log('✅ [Realtime] 连接重试成功')
      } catch (error) {
        retries++
        if (retries < maxRetries) {
          console.log(`🔄 [Realtime] 连接重试 ${retries}/${maxRetries}`, error)
          setTimeout(attemptConnect, 1000 * Math.pow(2, retries)) // 指数退避
        } else {
          console.error('❌ [Realtime] 连接重试失败，已达到最大重试次数', error)
        }
      }
    }
    
    attemptConnect()
  }, [])

  // 设置实时订阅
  useEffect(() => {
    if (!roomId) return

    // 清理之前的订阅
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel)
    })
    channelsRef.current = []

    // 合并的用户相关事件订阅
    const userChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('👥 [Realtime] 用户数据变化:', payload.eventType)
          // 使用防抖查询确保数据一致性
          debouncedFetchUsers()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          console.log('🏠 [Realtime] 房间数据变化:', payload.eventType)
          debouncedFetchRoom()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rewards',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('🎁 [Realtime] 奖励数据变化:', payload.eventType)
          debouncedFetchRewards()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emojis',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          if (payload.new) {
            try {
              const emojiData = payload.new as { user_id: string; emoji: string }
              const { data: user } = await supabase
                .from('users')
                .select('nickname')
                .eq('id', emojiData.user_id)
                .single()

              if (user) {
                onEmojiReceived?.({
                  userId: emojiData.user_id,
                  emoji: emojiData.emoji,
                  nickname: user.nickname
                })
              }
            } catch (error) {
              console.error('❌ [Realtime] 获取表情发送者信息失败:', error)
            }
          }
        }
      )
      .on('system', {}, (status) => {
        console.log('🔌 [Realtime] 连接状态:', status)
        
        // 处理连接状态变化
        if (status === 'CHANNEL_ERROR') {
          console.log('🔄 [Realtime] 检测到连接错误，尝试重连...')
          retryConnection(userChannel)
        }
      })
      .subscribe((status) => {
        console.log('📡 [Realtime] 订阅状态:', status)
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] 订阅成功')
          // 订阅成功后初始化数据
          fetchRoomUsers()
          fetchRoom()
          fetchRewards()
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ [Realtime] 订阅失败，尝试重连...')
          retryConnection(userChannel)
        }
      })

    // 绝地翻盘参与者表订阅 - 重要：用于检测绝地翻盘获奖者
    const finalLotteryChannel = supabase
      .channel(`final_lottery_participants-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'final_lottery_participants',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log('🔄 [Realtime] 绝地翻盘参与者表更新:', payload)
          
          if (payload.new && (payload.new as { is_drawn: boolean }).is_drawn && 
              !(payload.old as { is_drawn: boolean })?.is_drawn) {
            // 检测到绝地翻盘获奖者，作为备用触发机制
            console.log('🏆 [Realtime] 检测到绝地翻盘获奖者变更 (backup):', (payload.new as { user_id: string }).user_id)
            
            // 延迟一点时间，让主要的 users 表监听先处理
            setTimeout(async () => {
              try {
                const { data: user } = await supabase
                  .from('users')
                  .select('id, nickname, avatar_url, order_number')
                  .eq('id', (payload.new as { user_id: string }).user_id)
                  .single()

                if (user && onWinnerDrawn && user.order_number === -1) {
                  console.log('🏆 [Realtime] 备用机制触发绝地翻盘获奖通知:', user.nickname)
                  onWinnerDrawn({
                    userId: user.id,
                    nickname: user.nickname,
                    orderNumber: 0, // 绝地翻盘获胜者特殊标识
                    avatar: user.avatar_url || undefined
                  })
                }
              } catch (error) {
                console.error('❌ [Realtime] 备用机制获取用户信息失败:', error)
              }
            }, 200) // 200ms 延迟
          }
        }
      )
      .subscribe()

    channelsRef.current = [userChannel, finalLotteryChannel]

    // 初始加载数据
    fetchRoomUsers()
    fetchRoom()
    fetchRewards()

    // 清理函数
    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel)
      })
      channelsRef.current = []
      
      // 清理防抖定时器
      if (usersFetchTimeoutRef.current) {
        clearTimeout(usersFetchTimeoutRef.current)
        usersFetchTimeoutRef.current = null
      }
      if (roomFetchTimeoutRef.current) {
        clearTimeout(roomFetchTimeoutRef.current)
        roomFetchTimeoutRef.current = null
      }
      if (rewardsFetchTimeoutRef.current) {
        clearTimeout(rewardsFetchTimeoutRef.current)
        rewardsFetchTimeoutRef.current = null
      }
    }
  }, [roomId, debouncedFetchUsers, debouncedFetchRoom, debouncedFetchRewards, onEmojiReceived, retryConnection, fetchRoomUsers, fetchRoom, fetchRewards])

  return {
    refreshUsers: fetchRoomUsers,
    refreshRoom: fetchRoom,
    refreshRewards: fetchRewards
  }
} 