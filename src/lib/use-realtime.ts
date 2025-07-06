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
}

export function useRealtime({
  roomId,
  onUsersChange,
  onRoomChange,
  onEmojiReceived,
  onUserJoined,
  onUserLeft
}: UseRealtimeProps) {
  const channelsRef = useRef<RealtimeChannel[]>([])
  const lastUsersRef = useRef<User[]>([])

  // 获取房间内的所有用户（包括离线用户）
  const fetchRoomUsers = useCallback(async () => {
    if (!roomId) return

    console.log('🔄 [Realtime] 获取房间用户列表...')
    
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
      
      newUsers.forEach(user => {
        console.log('🆕 [Realtime] 新用户加入:', user.nickname)
        onUserJoined?.(user)
      })
      
      leftUsers.forEach(user => {
        console.log('👋 [Realtime] 用户离开:', user.nickname)
        onUserLeft?.(user.id)
      })
    }
    
    lastUsersRef.current = currentUsers
    onUsersChange?.(currentUsers)
  }, [roomId, onUsersChange, onUserJoined, onUserLeft])

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
          
          // 稍微延迟以确保数据同步
          setTimeout(() => {
            fetchRoomUsers()
          }, 100)
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
          setTimeout(() => {
            fetchRoom()
          }, 100)
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
          }
          
          // 刷新用户列表以更新表情显示
          setTimeout(() => {
            fetchRoomUsers()
          }, 100)
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
    }
  }, [roomId, fetchRoomUsers, fetchRoom, onEmojiReceived])

  return {
    refreshUsers: fetchRoomUsers,
    refreshRoom: fetchRoom
  }
} 