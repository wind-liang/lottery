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
import { UserSettings } from '@/components/user-settings'
import { Settings } from 'lucide-react'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

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
      
      console.log('🚀 开始初始化应用...')

      // 获取或创建用户
      let user = await getOrCreateUser()
      if (!user) {
        throw new Error('无法创建用户')
      }
      console.log('✅ 用户创建/获取成功:', user)

      // 获取或创建房间
      const roomData = await getOrCreateRoom()
      if (!roomData) {
        throw new Error('无法获取房间')
      }
      console.log('✅ 房间获取成功:', roomData)

      // 将用户加入房间
      user = await joinRoom(user.id, roomData.id)
      if (!user) {
        throw new Error('无法加入房间')
      }
      console.log('✅ 用户加入房间成功:', user)

      // 设置状态
      setCurrentUser(user)
      setRoom(roomData)
      console.log('✅ 状态设置完成')
      
      // 立即获取房间内的所有用户
      console.log('🔍 开始获取用户列表...')
      const { data: roomUsers, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('is_online', true)
        .order('created_at', { ascending: true })

      if (fetchError) {
        console.error('❌ 获取用户列表失败:', fetchError)
        throw fetchError
      }
      
      console.log('✅ 用户列表获取成功:', roomUsers)
      console.log('📊 用户数量:', roomUsers?.length || 0)
      
      if (roomUsers && roomUsers.length > 0) {
        console.log('👥 用户详情:', roomUsers.map(u => ({
          id: u.id,
          nickname: u.nickname,
          role: u.role,
          avatar_url: u.avatar_url,
          is_online: u.is_online
        })))
      }
      
      setUsers(roomUsers || [])
      console.log('✅ 初始化完成')
    } catch (err) {
      console.error('❌ 初始化应用失败:', err)
      setError(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setLoading(false)
    }
  }

  const getOrCreateUser = async (): Promise<User | null> => {
    try {
      console.log('🔍 检查本地存储的用户ID...')
      
      // 先尝试从 localStorage 获取用户ID
      const storedUserId = localStorage.getItem('lottery_user_id')
      console.log('📦 本地用户ID:', storedUserId)
      
      if (storedUserId) {
        console.log('🔍 查询现有用户...')
        const { data: existingUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', storedUserId)
          .single()
        
        if (!error && existingUser) {
          console.log('✅ 找到现有用户:', existingUser)
          
          // 检查localStorage中是否有更新的用户设置
          const storedSettings = localStorage.getItem('lottery_user_settings')
          if (storedSettings) {
            try {
              const settings = JSON.parse(storedSettings)
              console.log('📦 找到本地用户设置:', settings)
              
              // 检查是否需要同步到数据库
              const needsUpdate = 
                settings.nickname !== existingUser.nickname ||
                settings.avatar_url !== existingUser.avatar_url
              
              if (needsUpdate) {
                console.log('🔄 同步本地设置到数据库...')
                const { data: updatedUser, error: updateError } = await supabase
                  .from('users')
                  .update({
                    nickname: settings.nickname,
                    avatar_url: settings.avatar_url,
                    is_online: true,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingUser.id)
                  .select()
                  .single()
                
                if (updateError) {
                  console.error('⚠️ 同步设置失败:', updateError)
                } else {
                  console.log('✅ 设置同步成功:', updatedUser)
                  return updatedUser
                }
              }
            } catch (e) {
              console.error('⚠️ 解析本地设置失败:', e)
            }
          }
          
          // 标记用户为在线
          await supabase
            .from('users')
            .update({ is_online: true })
            .eq('id', existingUser.id)
          
          return existingUser
        } else {
          console.log('⚠️ 现有用户查询失败:', error)
        }
      }

      // 创建新用户
      console.log('🆕 创建新用户...')
      
      // 检查localStorage中是否有用户设置
      const storedSettings = localStorage.getItem('lottery_user_settings')
      let nickname = GameLogic.generateNickname()
      let avatarUrl = GameLogic.generateAvatarUrl()
      
      if (storedSettings) {
        try {
          const settings = JSON.parse(storedSettings)
          if (settings.nickname) {
            nickname = settings.nickname
            console.log('📦 使用本地昵称:', nickname)
          }
          if (settings.avatar_url) {
            avatarUrl = settings.avatar_url
            console.log('📦 使用本地头像:', avatarUrl)
          }
        } catch (e) {
          console.error('⚠️ 解析本地设置失败:', e)
        }
      }
      
      console.log('👤 生成用户信息:', { nickname, avatarUrl })
      
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

      if (error) {
        console.error('❌ 创建用户失败:', error)
        throw error
      }

      console.log('✅ 新用户创建成功:', newUser)
      
      // 存储用户ID到 localStorage
      localStorage.setItem('lottery_user_id', newUser.id)
      
      // 同步用户设置到localStorage
      const userSettings = {
        nickname: newUser.nickname,
        avatar_url: newUser.avatar_url,
        updated_at: new Date().toISOString()
      }
      localStorage.setItem('lottery_user_settings', JSON.stringify(userSettings))
      
      return newUser
    } catch (error) {
      console.error('❌ 获取或创建用户失败:', error)
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
    if (!room) {
      console.log('⚠️ 房间信息缺失，跳过用户获取')
      return
    }

    try {
      console.log('🔍 获取房间用户列表...', room.id)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('room_id', room.id)
        .eq('is_online', true)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ 获取用户列表失败:', error)
        throw error
      }
      
      console.log('✅ 用户列表获取成功:', data)
      console.log('📊 用户数量:', data?.length || 0)
      
      if (data && data.length > 0) {
        console.log('👥 用户详情:', data.map(u => ({
          id: u.id,
          nickname: u.nickname,
          role: u.role,
          avatar_url: u.avatar_url,
          is_online: u.is_online
        })))
      }
      
      setUsers(data || [])
    } catch (error) {
      console.error('❌ 获取用户列表失败:', error)
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

  const updateUserInfo = async (updatedUser: User) => {
    try {
      console.log('🔄 更新用户信息:', updatedUser)
      
      // 更新当前用户状态
      if (currentUser?.id === updatedUser.id) {
        setCurrentUser(updatedUser)
      }
      
      // 更新用户列表中的用户信息
      setUsers(prev => prev.map(user => 
        user.id === updatedUser.id ? updatedUser : user
      ))
      
      // 同步到localStorage
      const userSettings = {
        nickname: updatedUser.nickname,
        avatar_url: updatedUser.avatar_url,
        updated_at: new Date().toISOString()
      }
      localStorage.setItem('lottery_user_settings', JSON.stringify(userSettings))
      
      console.log('✅ 用户信息更新成功')
    } catch (error) {
      console.error('❌ 更新用户信息失败:', error)
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
      
      {/* 设置按钮 */}
      <div className="fixed top-4 right-4 z-10">
        <button
          onClick={() => setShowSettings(true)}
          className="bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-colors border border-white/30"
          title="个人设置"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
      
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
      
      {/* 用户设置弹窗 */}
      {showSettings && currentUser && (
        <UserSettings
          user={currentUser}
          onClose={() => setShowSettings(false)}
          onUserUpdate={updateUserInfo}
        />
      )}
    </div>
  )
}
