'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import type { Database } from './supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface UseRealtimeProps {
  roomId: string | null
  onUsersChange?: (users: User[]) => void
  onRoomChange?: (room: Room) => void
  onEmojiReceived?: (emoji: { userId: string, emoji: string, nickname: string }) => void
  onUserJoined?: (user: User) => void
  onUserLeft?: (userId: string) => void
  onWinnerDrawn?: (winner: { userId: string; nickname: string; orderNumber: number; avatar?: string }) => void
}

export function useRealtime({
  roomId,
  onUsersChange,
  onRoomChange,
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

    console.log('🔄 [Realtime] 获取房间用户列表...')
    
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', roomId)
        .order('is_online', { ascending: false }) // 在线用户排在前面
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ [Realtime] 获取用户列表失败:', error)
        return
      }

      const onlineCount = users?.filter(u => u.is_online).length || 0
      const offlineCount = users?.filter(u => !u.is_online).length || 0
      console.log('✅ [Realtime] 获取到用户列表:', users?.length || 0, '个用户 (在线:', onlineCount, '离线:', offlineCount, ')')
      
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
        
        newUsers.forEach(user => {
          console.log('🆕 [Realtime] 新用户加入:', user.nickname)
          onUserJoined?.(user)
        })
        
        leftUsers.forEach(user => {
          console.log('👋 [Realtime] 用户离开:', user.nickname)
          onUserLeft?.(user.id)
        })
        
        newWinners.forEach(winner => {
          console.log('🏆 [Realtime] 检测到新获奖者:', winner.nickname, '排名:', winner.order_number)
          if (onWinnerDrawn && winner.order_number) {
            onWinnerDrawn({
              userId: winner.id,
              nickname: winner.nickname,
              orderNumber: winner.order_number,
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

    console.log('🔄 [Realtime] 获取房间信息...')
    
    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (error) {
      console.error('❌ [Realtime] 获取房间信息失败:', error)
      return
    }

    console.log('✅ [Realtime] 获取到房间信息:', room?.name)
    onRoomChange?.(room)
  }, [roomId, onRoomChange])

  // 防抖定时器引用
  const usersFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const roomFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 防抖函数
  const debouncedFetchUsers = useCallback(() => {
    if (usersFetchTimeoutRef.current) {
      clearTimeout(usersFetchTimeoutRef.current)
    }
    usersFetchTimeoutRef.current = setTimeout(() => {
      fetchRoomUsers()
    }, 300) // 300ms 防抖
  }, [fetchRoomUsers])

  const debouncedFetchRoom = useCallback(() => {
    if (roomFetchTimeoutRef.current) {
      clearTimeout(roomFetchTimeoutRef.current)
    }
    roomFetchTimeoutRef.current = setTimeout(() => {
      fetchRoom()
    }, 300) // 300ms 防抖
  }, [fetchRoom])

  // 设置实时订阅
  useEffect(() => {
    if (!roomId) return

    console.log('🔌 [Realtime] 设置实时订阅...')

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
        (payload) => {
          console.log('🔄 [Realtime] 用户数据变化:', payload.eventType, payload.new || payload.old)
          
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
        (payload) => {
          console.log('🔄 [Realtime] 房间数据变化:', payload.eventType, payload.new || payload.old)
          debouncedFetchRoom()
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
          console.log('🎭 [Realtime] 新表情数据:', payload.new)
          
          if (payload.new) {
            try {
              // 获取发送表情的用户信息
              const { data: user } = await supabase
                .from('users')
                .select('nickname')
                .eq('id', payload.new.user_id)
                .single()

              if (user) {
                console.log('🎭 [Realtime] 表情发送者:', user.nickname)
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
          
          // 使用防抖刷新用户列表
          debouncedFetchUsers()
        }
      )
      .subscribe()

    // 存储所有频道引用
    channelsRef.current = [userChannel, roomChannel, emojiChannel]

    // 初始加载数据
    fetchRoomUsers()
    fetchRoom()

    console.log('✅ [Realtime] 实时订阅设置完成')

    // 清理函数
    return () => {
      console.log('🔌 [Realtime] 清理实时订阅...')
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
    }
  }, [roomId, debouncedFetchUsers, debouncedFetchRoom, onEmojiReceived])

  return {
    refreshUsers: fetchRoomUsers,
    refreshRoom: fetchRoom
  }
} 