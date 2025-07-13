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
  const finalLotteryPollingRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchTimeRef = useRef<number>(0) // 记录最后一次查询时间

  // 轮询检查绝地翻盘获奖者（作为实时监听的补充）
  const checkFinalLotteryWinner = useCallback(async () => {
    if (!roomId || !onWinnerDrawn) return

    try {
      // 检查是否有新的绝地翻盘获奖者
      const { data: winner, error } = await supabase
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
        .eq('is_drawn', true)
        .single()

      if (error) {
        // 如果没有找到记录，这是正常情况
        if (error.code === 'PGRST116') {
          return // 没有获奖者，这是正常情况
        }
        console.error('❌ [Polling] 轮询检查绝地翻盘获奖者失败:', error)
        return
      }

      if (winner?.users) {
        console.log('🔄 [Polling] 轮询检测到绝地翻盘获奖者:', winner.users.nickname)
        onWinnerDrawn({
          userId: winner.users.id,
          nickname: winner.users.nickname,
          orderNumber: 0, // 绝地翻盘获胜者特殊标识
          avatar: winner.users.avatar_url || undefined
        })
      }
    } catch (error) {
      console.error('❌ [Polling] 轮询检查绝地翻盘获奖者异常:', error)
    }
  }, [roomId, onWinnerDrawn])

  // 合并的防抖函数 - 减少重复查询
  const debouncedFetchAll = useCallback(() => {
    const now = Date.now()
    
    // 如果距离上次查询不足 1 秒，则跳过
    if (now - lastFetchTimeRef.current < 1000) {
      return
    }
    
    if (usersFetchTimeoutRef.current) {
      clearTimeout(usersFetchTimeoutRef.current)
    }
    
    usersFetchTimeoutRef.current = setTimeout(() => {
      lastFetchTimeRef.current = Date.now()
      fetchRoomUsers()
    }, 800) // 减少到800ms防抖，提高用户数据响应速度
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

    // 表情表订阅 - 优化处理逻辑
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
          
          // 表情插入后延迟更新用户列表，避免频繁查询
          setTimeout(() => {
            debouncedFetchUsers()
          }, 1000)
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
        
        // 增强的重连机制
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.log('🔄 [Realtime] 检测到连接问题，启动增强重连机制...')
          
          // 渐进式重连：先尝试快速重连，如果失败则延长间隔
          const reconnectAttempts = [1000, 3000, 5000, 10000] // 1秒, 3秒, 5秒, 10秒
          
          const attemptReconnect = (attemptIndex = 0) => {
            if (attemptIndex >= reconnectAttempts.length) {
              console.error('❌ [Realtime] 绝地翻盘频道重连失败，已达到最大尝试次数')
              return
            }
            
            const delay = reconnectAttempts[attemptIndex]
            console.log(`🔄 [Realtime] 第 ${attemptIndex + 1} 次重连尝试，${delay}ms 后执行...`)
            
            setTimeout(() => {
              console.log(`🔄 [Realtime] 执行第 ${attemptIndex + 1} 次重连...`)
              try {
                finalLotteryChannel.subscribe((reconnectStatus, reconnectErr) => {
                  if (reconnectStatus === 'SUBSCRIBED') {
                    console.log('✅ [Realtime] 绝地翻盘频道重连成功')
                  } else if (reconnectStatus === 'CLOSED' || reconnectStatus === 'CHANNEL_ERROR') {
                    console.log(`❌ [Realtime] 第 ${attemptIndex + 1} 次重连失败，继续尝试...`)
                    attemptReconnect(attemptIndex + 1)
                  }
                  
                  if (reconnectErr) {
                    console.error(`❌ [Realtime] 第 ${attemptIndex + 1} 次重连错误:`, reconnectErr)
                    attemptReconnect(attemptIndex + 1)
                  }
                })
              } catch (error) {
                console.error(`❌ [Realtime] 第 ${attemptIndex + 1} 次重连异常:`, error)
                attemptReconnect(attemptIndex + 1)
              }
            }, delay)
          }
          
          attemptReconnect()
        }
      })

    // 存储所有频道引用
    channelsRef.current = [userChannel, roomChannel, rewardsChannel, emojiChannel, finalLotteryChannel]

    // 初始加载数据
    fetchRoomUsers()
    fetchRoom()
    fetchRewards()

    // 启动绝地翻盘轮询机制（仅在 final_lottery 阶段）
    const startFinalLotteryPolling = () => {
      if (finalLotteryPollingRef.current) {
        clearInterval(finalLotteryPollingRef.current)
      }
      
      console.log('🔄 [Polling] 启动绝地翻盘轮询机制')
      finalLotteryPollingRef.current = setInterval(() => {
        checkFinalLotteryWinner()
      }, 2000) // 每2秒检查一次
    }

    // 停止绝地翻盘轮询机制
    const stopFinalLotteryPolling = () => {
      if (finalLotteryPollingRef.current) {
        console.log('🛑 [Polling] 停止绝地翻盘轮询机制')
        clearInterval(finalLotteryPollingRef.current)
        finalLotteryPollingRef.current = null
      }
    }

    // 对于绝地翻盘阶段，启动轮询作为备用机制
    if (roomId) {
      console.log('🔄 [Polling] 为房间启动绝地翻盘轮询备用机制')
      startFinalLotteryPolling()
    }

    // 清理函数
    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel)
      })
      channelsRef.current = []
      
      // 停止轮询
      stopFinalLotteryPolling()
      
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
  }, [roomId, debouncedFetchUsers, debouncedFetchRoom, debouncedFetchRewards, onEmojiReceived, checkFinalLotteryWinner])

  return {
    refreshUsers: fetchRoomUsers,
    refreshRoom: fetchRoom,
    refreshRewards: fetchRewards
  }
} 