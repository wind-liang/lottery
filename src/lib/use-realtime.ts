'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import type { Database } from './supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']
type Reward = Database['public']['Tables']['rewards']['Row']

interface UseRealtimeProps {
  roomId: string | null
  onUsersChange?: (users: User[]) => void
  onRoomChange?: (room: Room) => void
  onRewardsChange?: (rewards: Reward[]) => void
  onEmojiReceived?: (emoji: { userId: string, emoji: string, nickname: string }) => void
  onUserJoined?: (user: User) => void
  onUserLeft?: (userId: string) => void
  onWinnerDrawn?: (winner: { userId: string; nickname: string; orderNumber: number; avatar?: string }) => void
}

export function useRealtime({
  roomId,
  onUsersChange,
  onRoomChange,
  onRewardsChange,
  onEmojiReceived,
  onUserJoined,
  onUserLeft,
  onWinnerDrawn
}: UseRealtimeProps) {
  const channelsRef = useRef<RealtimeChannel[]>([])
  const lastUsersRef = useRef<User[]>([])

  // 获取房间内的所有用户（包括离线用户）
  const fetchRoomUsers = useCallback(async () => {
    if (!roomId) return

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', roomId)
        .order('display_order', { ascending: true }) // 按显示顺序排序，保持固定顺序

      if (error) {
        console.error('❌ [Realtime] 获取用户列表失败:', error)
        return
      }

      // 检测新用户加入和用户离开
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
  const lastFetchTimeRef = useRef<number>(0) // 记录最后一次查询时间

  // 合并的防抖函数 - 为表情功能优化响应速度
  const debouncedFetchAll = useCallback(() => {
    const now = Date.now()
    
    // 优化：对于表情相关的更新，减少防抖间隔
    // 如果距离上次查询不足 500ms，则跳过
    if (now - lastFetchTimeRef.current < 500) {
      return
    }
    
    if (usersFetchTimeoutRef.current) {
      clearTimeout(usersFetchTimeoutRef.current)
    }
    
    usersFetchTimeoutRef.current = setTimeout(() => {
      lastFetchTimeRef.current = Date.now()
      fetchRoomUsers()
    }, 300) // 进一步减少到300ms防抖，提高表情显示响应速度
  }, [fetchRoomUsers])

  // 防抖函数 - 进一步增加防抖时间
  const debouncedFetchUsers = useCallback(() => {
    debouncedFetchAll()
  }, [debouncedFetchAll])

  const debouncedFetchRoom = useCallback(() => {
    if (roomFetchTimeoutRef.current) {
      clearTimeout(roomFetchTimeoutRef.current)
    }
    roomFetchTimeoutRef.current = setTimeout(() => {
      fetchRoom()
    }, 800) // 减少到800ms防抖，提高房间状态响应速度
  }, [fetchRoom])

  const debouncedFetchRewards = useCallback(() => {
    if (rewardsFetchTimeoutRef.current) {
      clearTimeout(rewardsFetchTimeoutRef.current)
    }
    rewardsFetchTimeoutRef.current = setTimeout(() => {
      fetchRewards()
    }, 500) // 减少到500ms防抖，提高奖励数据响应速度
  }, [fetchRewards])

  // 设置实时订阅
  useEffect(() => {
    if (!roomId) return

    // 清理之前的订阅
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel)
    })
    channelsRef.current = []

    // 用户表订阅 - 合并处理多种事件
    const userChannel = supabase
      .channel(`users-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('👥 [Realtime] 用户数据变化，事件类型:', payload.eventType)
          // 使用统一的防抖函数，减少重复查询
          debouncedFetchUsers()
        }
      )
      .subscribe()

    // 房间表订阅 - 减少查询频率
    const roomChannel = supabase
      .channel(`rooms-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          console.log('🏠 [Realtime] 房间数据变化，事件类型:', payload.eventType)
          debouncedFetchRoom()
        }
      )
      .subscribe()

    // 奖励表订阅 - 降低查询频率
    const rewardsChannel = supabase
      .channel(`rewards-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rewards',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('🎁 [Realtime] 奖励数据变化，事件类型:', payload.eventType)
          debouncedFetchRewards()
        }
      )
      .subscribe()

    // 表情表订阅 - 优化处理逻辑，减少重复查询
    const emojiChannel = supabase
      .channel(`emojis-${roomId}`)
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
              // 获取发送表情的用户信息
              const { data: user } = await supabase
                .from('users')
                .select('nickname')
                .eq('id', payload.new.user_id)
                .single()

              if (user) {
                onEmojiReceived?.({
                  userId: payload.new.user_id,
                  emoji: payload.new.emoji,
                  nickname: user.nickname
                })
              }
            } catch (error) {
              console.error('❌ [Realtime] 获取表情发送者信息失败:', error)
            }
          }
          
          // 优化：表情插入后不需要立即刷新用户列表
          // 因为用户表的变化已经通过用户订阅处理了
          // 移除这里的延迟查询，避免重复刷新
          console.log('🎭 [Realtime] 表情插入完成，依赖用户表订阅处理UI更新')
        }
      )
      .subscribe()

    // 绝地翻盘参与者表订阅 - 简化版本，作为 users 表监听的补充
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
          
          if (payload.new && payload.new.is_drawn && !payload.old?.is_drawn) {
            // 检测到绝地翻盘获奖者，作为备用触发机制
            console.log('🏆 [Realtime] 检测到绝地翻盘获奖者变更 (backup):', payload.new.user_id)
            
            // 延迟一点时间，让主要的 users 表监听先处理
            setTimeout(async () => {
              try {
                const { data: user } = await supabase
                  .from('users')
                  .select('id, nickname, avatar_url, order_number')
                  .eq('id', payload.new.user_id)
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

    // 存储所有频道引用
    channelsRef.current = [userChannel, roomChannel, rewardsChannel, emojiChannel, finalLotteryChannel]

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
  }, [roomId, debouncedFetchUsers, debouncedFetchRoom, debouncedFetchRewards, onEmojiReceived])

  return {
    refreshUsers: fetchRoomUsers,
    refreshRoom: fetchRoom,
    refreshRewards: fetchRewards
  }
} 