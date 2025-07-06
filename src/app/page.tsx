'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GameLogic } from '@/lib/game-logic'
import { LotteryBox } from '@/components/lottery-box'
import { UserAvatars } from '@/components/user-avatars'
import { GameControls } from '@/components/game-controls'
import { EmojiPanel } from '@/components/emoji-panel'
import { GameStage } from '@/components/game-stage'
import { LoadingSpinner } from '@/components/loading-spinner'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 初始化用户和房间
  useEffect(() => {
    initializeApp()
  }, [])

  // 监听实时数据变化
  useEffect(() => {
    if (!room) return

    const userChannel = supabase
      .channel('users')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          console.log('用户数据变化:', payload)
          fetchUsers()
        }
      )
      .subscribe()

    const roomChannel = supabase
      .channel('rooms')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          console.log('房间数据变化:', payload)
          fetchRoom()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(userChannel)
      supabase.removeChannel(roomChannel)
    }
  }, [room])

  const initializeApp = async () => {
    try {
      setLoading(true)
      setError(null)

      // 获取或创建用户
      let user = await getOrCreateUser()
      if (!user) {
        throw new Error('无法创建用户')
      }

      // 获取或创建房间
      const roomData = await getOrCreateRoom()
      if (!roomData) {
        throw new Error('无法获取房间')
      }

      // 将用户加入房间
      user = await joinRoom(user.id, roomData.id)
      if (!user) {
        throw new Error('无法加入房间')
      }

      setCurrentUser(user)
      setRoom(roomData)
      
      // 获取房间内的所有用户
      await fetchUsers()
    } catch (err) {
      console.error('初始化应用失败:', err)
      setError(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setLoading(false)
    }
  }

  const getOrCreateUser = async (): Promise<User | null> => {
    try {
      // 先尝试从 localStorage 获取用户ID
      const storedUserId = localStorage.getItem('lottery_user_id')
      
      if (storedUserId) {
        const { data: existingUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', storedUserId)
          .single()
        
        if (!error && existingUser) {
          // 标记用户为在线
          await supabase
            .from('users')
            .update({ is_online: true })
            .eq('id', existingUser.id)
          
          return existingUser
        }
      }

      // 创建新用户
      const nickname = GameLogic.generateNickname()
      const avatarUrl = GameLogic.generateAvatarUrl()
      
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          nickname,
          avatar_url: avatarUrl,
          role: 'audience',
          is_online: true
        })
        .select()
        .single()

      if (error) throw error

      // 存储用户ID到 localStorage
      localStorage.setItem('lottery_user_id', newUser.id)
      
      return newUser
    } catch (error) {
      console.error('获取或创建用户失败:', error)
      return null
    }
  }

  const getOrCreateRoom = async (): Promise<Room | null> => {
    try {
      // 获取默认房间
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('name', '婚礼抽奖房间')
        .limit(1)

      if (error) throw error

      if (rooms && rooms.length > 0) {
        return rooms[0]
      }

      // 如果没有房间，创建一个新房间
      const { data: newRoom, error: createError } = await supabase
        .from('rooms')
        .insert({
          name: '婚礼抽奖房间',
          stage: 'waiting'
        })
        .select()
        .single()

      if (createError) throw createError
      return newRoom
    } catch (error) {
      console.error('获取或创建房间失败:', error)
      return null
    }
  }

  const joinRoom = async (userId: string, roomId: string): Promise<User | null> => {
    try {
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ room_id: roomId })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return updatedUser
    } catch (error) {
      console.error('加入房间失败:', error)
      return null
    }
  }

  const fetchUsers = async () => {
    if (!room) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', room.id)
        .eq('is_online', true)
        .order('joined_at', { ascending: true })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('获取用户列表失败:', error)
    }
  }

  const fetchRoom = async () => {
    if (!room) return

    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', room.id)
        .single()

      if (error) throw error
      setRoom(data)
    } catch (error) {
      console.error('获取房间信息失败:', error)
    }
  }

  const updateUserRole = async (userId: string, role: User['role']) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId)

      if (error) throw error
      
      // 更新本地状态
      if (currentUser?.id === userId) {
        setCurrentUser(prev => prev ? { ...prev, role } : null)
      }
    } catch (error) {
      console.error('更新用户角色失败:', error)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">加载失败</h1>
          <p className="mb-4">{error}</p>
          <button
            onClick={initializeApp}
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!currentUser || !room) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-600">
      {/* 游戏阶段指示器 */}
      <GameStage stage={room.stage} />
      
      {/* 主游戏区域 */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* 抽奖箱 */}
          <LotteryBox 
            roomId={room.id}
            stage={room.stage}
            currentUser={currentUser}
            users={users}
          />
          
          {/* 用户头像区域 */}
          <UserAvatars
            users={users}
            currentUser={currentUser}
                         onUserClick={(user: User) => {
               // 处理用户点击事件
               console.log('用户点击:', user)
             }}
            onRoleChange={updateUserRole}
          />
          
          {/* 游戏控制区域 */}
          <GameControls
            room={room}
            currentUser={currentUser}
            users={users}
            onStageChange={() => fetchRoom()}
          />
          
          {/* 表情面板 */}
          <EmojiPanel
            currentUser={currentUser}
            roomId={room.id}
          />
        </div>
      </div>
    </div>
  )
}
