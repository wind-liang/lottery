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
                 currentUser.order_number !== null
        })
        
        // 检测绝地翻盘获奖者（通过表情 🏆 标识）
        const finalLotteryWinners = currentUsers.filter(currentUser => {
          const lastUser = lastUsers.find(lu => lu.id === currentUser.id)
          return lastUser && 
                 lastUser.current_emoji !== '🏆' && 
                 currentUser.current_emoji === '🏆'
        })
        
        newUsers.forEach(user => {
          onUserJoined?.(user)
        })
        
        leftUsers.forEach(user => {
          onUserLeft?.(user.id)
        })
        
        newWinners.forEach(winner => {
          if (onWinnerDrawn && winner.order_number) {
            onWinnerDrawn({
              userId: winner.id,
              nickname: winner.nickname,
              orderNumber: winner.order_number,
              avatar: winner.avatar_url || undefined
            })
          }
        })
        
        // 处理绝地翻盘获奖者
        finalLotteryWinners.forEach(winner => {
          if (onWinnerDrawn) {
            console.log('🏆 [Realtime] 从用户表检测到绝地翻盘获奖者:', winner.nickname)
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

  // 防抖函数 - 增加防抖时间减少频繁查询
  const debouncedFetchUsers = useCallback(() => {
    if (usersFetchTimeoutRef.current) {
      clearTimeout(usersFetchTimeoutRef.current)
    }
    usersFetchTimeoutRef.current = setTimeout(() => {
      fetchRoomUsers()
    }, 1000) // 增加到1秒防抖，减少频繁查询
  }, [fetchRoomUsers])

  const debouncedFetchRoom = useCallback(() => {
    if (roomFetchTimeoutRef.current) {
      clearTimeout(roomFetchTimeoutRef.current)
    }
    roomFetchTimeoutRef.current = setTimeout(() => {
      fetchRoom()
    }, 1000) // 增加到1秒防抖，减少频繁查询
  }, [fetchRoom])

  const debouncedFetchRewards = useCallback(() => {
    if (rewardsFetchTimeoutRef.current) {
      clearTimeout(rewardsFetchTimeoutRef.current)
    }
    rewardsFetchTimeoutRef.current = setTimeout(() => {
      fetchRewards()
    }, 500) // 奖励数据变化需要更快响应
  }, [fetchRewards])

  // 设置实时订阅
  useEffect(() => {
    if (!roomId) return

    // 清理之前的订阅
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel)
    })
    channelsRef.current = []

    // 用户表订阅
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
        () => {
          // 使用防抖延迟请求
          debouncedFetchUsers()
        }
      )
      .subscribe()

    // 房间表订阅
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
        () => {
          debouncedFetchRoom()
        }
      )
      .subscribe()

    // 奖励表订阅
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
        () => {
          console.log('🎁 [Realtime] 奖励数据变化，刷新奖励列表')
          debouncedFetchRewards()
        }
      )
      .subscribe()

    // 表情表订阅
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
          
          // 移除对用户列表的刷新 - 表情插入不需要刷新用户列表
          // 用户的 current_emoji 字段变化会通过用户表订阅自动处理
        }
      )
      .subscribe()

    // 绝地翻盘参与者表订阅
    const finalLotteryChannel = supabase
      .channel(`final_lottery_participants-${roomId}`, {
        config: {
          presence: {
            key: 'final_lottery_participants'
          }
        }
      })
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
            // 检测到绝地翻盘获奖者
            console.log('🏆 [Realtime] 检测到绝地翻盘获奖者变更:', payload.new.user_id)
            
            try {
              const { data: user } = await supabase
                .from('users')
                .select('id, nickname, avatar_url')
                .eq('id', payload.new.user_id)
                .single()

              console.log('🏆 [Realtime] 获取到用户信息:', user)

              if (user && onWinnerDrawn) {
                console.log('🏆 [Realtime] 准备调用 onWinnerDrawn 回调:', user.nickname)
                onWinnerDrawn({
                  userId: user.id,
                  nickname: user.nickname,
                  orderNumber: 0, // 绝地翻盘获胜者特殊标识
                  avatar: user.avatar_url || undefined
                })
                console.log('🏆 [Realtime] 成功调用 onWinnerDrawn 回调')
              } else {
                console.error('🏆 [Realtime] 无法调用 onWinnerDrawn:', { user, onWinnerDrawn: !!onWinnerDrawn })
              }
            } catch (error) {
              console.error('❌ [Realtime] 获取绝地翻盘获奖者信息失败:', error)
            }
          } else {
            console.log('🔄 [Realtime] 绝地翻盘参与者表更新但不是获奖者:', {
              isDrawn: payload.new?.is_drawn,
              oldIsDrawn: payload.old?.is_drawn
            })
          }
        }
      )
      .subscribe((status, err) => {
        console.log('📡 [Realtime] 绝地翻盘订阅状态变更:', status)
        if (err) {
          console.error('❌ [Realtime] 绝地翻盘订阅错误:', err)
        }
        
        // 如果连接关闭，尝试重连
        if (status === 'CLOSED') {
          console.log('🔄 [Realtime] 检测到连接关闭，2秒后尝试重连...')
          setTimeout(() => {
            console.log('🔄 [Realtime] 尝试重新订阅绝地翻盘频道...')
            finalLotteryChannel.subscribe()
          }, 2000)
        }
      })

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