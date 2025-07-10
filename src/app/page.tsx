'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { GameLogic } from '@/lib/game-logic'
import { LotteryBox } from '@/components/lottery-box'
import { UserAvatars } from '@/components/user-avatars'
import { GameControls } from '@/components/game-controls'
import { EmojiPanel } from '@/components/emoji-panel'
import { GameStage } from '@/components/game-stage'
import { LoadingSpinner } from '@/components/loading-spinner'
import { RealtimeNotifications, addRealtimeNotification } from '@/components/realtime-notifications'
import { LoginForm } from '@/components/login-form'
import { LotteryWinnerNotification } from '@/components/lottery-winner-notification'
import { RewardSelection } from '@/components/reward-selection'
import { ComebackModal } from '@/components/comeback-modal'
import { RewardViewer } from '@/components/reward-viewer'
import { useRealtime } from '@/lib/use-realtime'
import { useUserPresence } from '@/lib/use-user-presence'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [lotteryWinner, setLotteryWinner] = useState<{
    userId: string
    nickname: string
    orderNumber: number
    avatar?: string
  } | null>(null)
  const [showComebackModal, setShowComebackModal] = useState(false)
  const [lastFivePlayers, setLastFivePlayers] = useState<User[]>([])
  
  // 使用 ref 来即时追踪弹窗显示状态，避免异步状态更新导致的多次触发
  const comebackModalShownRef = useRef(false)

  // 初始化应用
  useEffect(() => {
    // 清理旧的localStorage数据，确保密码登录系统正常工作
    const cleanupOldData = () => {
      // 如果存在旧的用户设置数据，清除它
      if (localStorage.getItem('lottery_user_settings')) {
        console.log('🧹 清理旧的用户设置数据')
        localStorage.removeItem('lottery_user_settings')
      }
      
      // 临时调试：强制清除所有用户数据以确保显示登录界面
      // 可以在确认登录系统正常工作后移除这行
      console.log('🔧 [调试] 强制清除所有用户数据')
      localStorage.removeItem('lottery_user_id')
    }
    
    cleanupOldData()
    initializeApp()
  }, [])

  // 处理登录成功
  const handleLoginSuccess = (user: User) => {
    initializeApp(user)
  }

  // 处理登录错误
  const handleLoginError = (errorMessage: string) => {
    setError(errorMessage)
  }

  // 使用 useCallback 优化回调函数，避免重复创建
  const handleUsersChange = useCallback((updatedUsers: User[]) => {
    console.log('🔄 [实时] 用户列表更新:', updatedUsers.length, '个用户')
    setUsers(updatedUsers)
    
    // 同步更新currentUser状态
    if (currentUser) {
      const updatedCurrentUser = updatedUsers.find(u => u.id === currentUser.id)
      if (updatedCurrentUser) {
        console.log('🔄 [实时] 当前用户信息同步更新:', updatedCurrentUser.role)
        setCurrentUser(updatedCurrentUser)
      }
    }
  }, [currentUser])

  const handleRoomChange = useCallback((updatedRoom: Room) => {
    console.log('🔄 [实时] 房间信息更新:', updatedRoom?.name, '阶段:', updatedRoom?.stage)
    
    // 只有在离开 reward_selection 阶段时才重置绝地翻盘弹窗标志
    if (room && room.stage !== updatedRoom.stage && room.stage === 'reward_selection') {
      console.log('🔄 [实时] 离开奖励选择阶段，重置绝地翻盘弹窗标志')
      comebackModalShownRef.current = false // 重置 ref
    }
    
    setRoom(updatedRoom)
  }, [room])

  const handleEmojiReceived = useCallback((emojiData: { userId: string, emoji: string, nickname: string }) => {
    console.log('🎭 [实时] 收到表情:', emojiData)
    addRealtimeNotification({
      type: 'emoji_sent',
      message: `${emojiData.nickname} 发送了表情`,
      emoji: emojiData.emoji
    })
  }, [])

  const handleUserJoined = useCallback((user: User) => {
    console.log('🆕 [实时] 用户加入:', user.nickname)
    addRealtimeNotification({
      type: 'user_joined',
      message: `${user.nickname} 加入了房间`
    })
  }, [])

  const handleUserLeft = useCallback((userId: string) => {
    console.log('👋 [实时] 用户离开:', userId)
    // 从当前用户列表中找到离开的用户
    const leftUser = users.find(u => u.id === userId)
    if (leftUser) {
      addRealtimeNotification({
        type: 'user_left',
        message: `${leftUser.nickname} 离开了房间`
      })
    }
  }, [users])

  const handleRealtimeWinnerDrawn = useCallback((winner: { userId: string; nickname: string; orderNumber: number; avatar?: string }) => {
    console.log('🏆 [实时] 页面组件检测到获奖者:', winner)
    console.log('🏆 [实时] 是否是绝地翻盘:', winner.orderNumber === 0)
    console.log('🏆 [实时] 当前用户:', currentUser?.nickname)
    
    // 显示获奖弹窗
    setLotteryWinner(winner)
    console.log('🏆 [实时] 已设置获奖弹窗状态')
  }, [currentUser])

  // 使用实时通信hook
  const { refreshUsers, refreshRoom } = useRealtime({
    roomId: room?.id || null,
    onUsersChange: handleUsersChange,
    onRoomChange: handleRoomChange,
    onEmojiReceived: handleEmojiReceived,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onWinnerDrawn: handleRealtimeWinnerDrawn
  })

  // 使用用户状态管理hook
  useUserPresence({
    userId: currentUser?.id || null,
    roomId: room?.id || null,
    enabled: !!currentUser && !!room
  })

  // 定期清理过期表情和刷新UI
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      GameLogic.cleanupExpiredEmojis()
      // 检查是否有表情过期，如果有则刷新UI
      // 使用 ref 来避免依赖 users 状态
      refreshUsers()
    }, 5000) // 每5秒检查一次，减少频率

    return () => clearInterval(cleanupInterval)
  }, [refreshUsers])

  const initializeApp = async (user?: User) => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🚀 开始初始化应用...')

      let currentUserData = user
      
      // 如果没有传入用户，尝试从localStorage获取
      if (!currentUserData) {
        const storedUserId = localStorage.getItem('lottery_user_id')
        if (storedUserId) {
          const retrievedUser = await getUserById(storedUserId)
          if (retrievedUser) {
            currentUserData = retrievedUser
          }
        }
      }
      
      if (!currentUserData) {
        // 用户未登录，显示登录界面
        setIsLoggedIn(false)
        setLoading(false)
        return
      }
      
      console.log('✅ 用户验证成功:', currentUserData)

      // 获取或创建房间
      const roomData = await getOrCreateRoom()
      if (!roomData) {
        throw new Error('无法获取房间')
      }
      console.log('✅ 房间获取成功:', roomData)

      // 将用户加入房间
      const updatedUser = await joinRoom(currentUserData.id, roomData.id)
      if (!updatedUser) {
        throw new Error('无法加入房间')
      }
      console.log('✅ 用户加入房间成功:', updatedUser)

      // 设置状态
      setCurrentUser(updatedUser)
      setRoom(roomData)
      setIsLoggedIn(true)
      console.log('✅ 状态设置完成')
      
      // 用户列表将由useRealtime hook自动管理
      console.log('✅ 初始化完成，等待实时数据同步...')
    } catch (err) {
      console.error('❌ 初始化应用失败:', err)
      setError(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setLoading(false)
    }
  }

  const getUserById = async (userId: string): Promise<User | null> => {
    try {
      console.log('🔍 通过ID查询用户:', userId)
      
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (!error && existingUser) {
        console.log('✅ 找到现有用户:', existingUser)
        
        // 检查用户是否有密码，如果没有密码则认为是旧用户，需要重新登录
        if (!existingUser.password) {
          console.log('⚠️ 用户没有密码，清除localStorage并要求重新登录')
          localStorage.removeItem('lottery_user_id')
          return null
        }
        
        // 标记用户为在线
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ 
            is_online: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)
          .select()
          .single()
        
        if (updateError) {
          console.error('⚠️ 更新在线状态失败:', updateError)
          return existingUser
        }
        
        return updatedUser
      } else {
        console.log('⚠️ 用户查询失败或用户不存在:', error)
        // 清除无效的localStorage数据
        localStorage.removeItem('lottery_user_id')
        return null
      }
    } catch (error) {
      console.error('❌ 获取用户失败:', error)
      localStorage.removeItem('lottery_user_id')
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

  const updateUserRole = async (userId: string, role: User['role']) => {
    try {
      // 如果要设置为主持人，检查数量限制
      if (role === 'host') {
        const hostCount = users.filter(u => u.role === 'host').length
        if (hostCount >= 2) {
          alert('最多只能有两个主持人')
          return
        }
      }
      
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
      alert('更新用户角色失败，请重试')
    }
  }

  const kickUser = async (userId: string) => {
    try {
      console.log('🚪 开始踢出用户:', userId)
      
      // 检查房间是否存在
      if (!room) {
        console.error('❌ 房间不存在')
        return
      }
      
      // 找到被踢出的用户
      const targetUser = users.find(u => u.id === userId)
      if (!targetUser) {
        console.error('❌ 找不到要踢出的用户')
        return
      }

      // 开始事务操作
      // 1. 从抽奖参与者表中移除用户
      const { error: removeParticipantError } = await supabase
        .from('lottery_participants')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', room.id)

      if (removeParticipantError) {
        console.error('❌ 移除抽奖参与者失败:', removeParticipantError)
      }

      // 2. 清理用户的表情记录
      const { error: removeEmojiError } = await supabase
        .from('emojis')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', room.id)

      if (removeEmojiError) {
        console.error('❌ 清理表情记录失败:', removeEmojiError)
      }

      // 3. 将用户从房间中移除并设置为离线状态
      const { error: kickUserError } = await supabase
        .from('users')
        .update({ 
          room_id: null,
          is_online: false,
          role: 'audience',
          order_number: null,
          selected_reward: null,
          current_emoji: null,
          emoji_expires_at: null
        })
        .eq('id', userId)

      if (kickUserError) {
        console.error('❌ 踢出用户失败:', kickUserError)
        alert('踢出用户失败，请重试')
        return
      }

      console.log('✅ 用户踢出成功:', targetUser.nickname)
      
      // 显示通知
      addRealtimeNotification({
        type: 'user_kicked',
        message: `${targetUser.nickname} 已被踢出房间`
      })

      // 用户列表将通过实时订阅自动更新
      
    } catch (error) {
      console.error('❌ 踢出用户异常:', error)
      alert('踢出用户时发生错误，请重试')
    }
  }

  // 处理获奖通知
  const handleWinnerDrawn = (winner: {
    userId: string
    nickname: string
    orderNumber: number
    avatar?: string
  }) => {
    console.log('🏆 [获奖通知] 显示获奖者:', winner)
    setLotteryWinner(winner)
  }

  // 关闭获奖通知
  const handleCloseWinnerNotification = useCallback(() => {
    console.log('🚫 [获奖通知] 父组件关闭获奖通知')
    setLotteryWinner(null)
  }, [])

  // 绝地翻盘弹窗处理函数
  const handleComebackModalClose = () => {
    setShowComebackModal(false)
    comebackModalShownRef.current = true // 标记弹窗已显示过，防止重新显示
  }

  const handleComebackModalComplete = async () => {
    setShowComebackModal(false)
    comebackModalShownRef.current = true // 标记弹窗已显示过
    // 倒计时结束后只关闭弹窗，等待主持人手动点击按钮进入绝地翻盘阶段
  }

  // 监听用户变化以检查是否所有人都选择完毕
  useEffect(() => {
    // 只在奖励选择阶段且有用户且弹窗未显示过时才检查
    if (room?.stage === 'reward_selection' && users.length > 0 && !comebackModalShownRef.current) {
      console.log('🔍 [检查选择状态] 开始检查，弹窗是否已显示过:', comebackModalShownRef.current)
      
      setTimeout(async () => {
        try {
          // 再次检查标记，防止在延迟期间被其他调用标记
          if (comebackModalShownRef.current) {
            console.log('🔍 [检查选择状态] 弹窗已在其他地方显示，跳过')
            return
          }
          
          // 获取所有有排序的玩家
          const { data: players, error } = await supabase
            .from('users')
            .select('id, nickname, order_number, selected_reward')
            .eq('room_id', room.id)
            .eq('role', 'player')
            .not('order_number', 'is', null)
            .order('order_number', { ascending: true })

          if (error) throw error

          // 检查是否所有人都选择了奖励
          const allSelected = players?.every(player => !!player.selected_reward)
          
          console.log('🔍 [检查选择状态] 所有玩家:', players?.map(p => ({
            nickname: p.nickname,
            order: p.order_number,
            hasSelected: !!p.selected_reward
          })))
          
          console.log('🔍 [检查选择状态] 是否全部选择完毕:', allSelected)

          if (allSelected && players && players.length > 0) {
            console.log('🎉 [绝地翻盘] 所有人选择完毕，准备显示绝地翻盘弹窗')
            
            // 只有在真正要显示弹窗时才标记
            comebackModalShownRef.current = true
            
            // 获取最后5名玩家
            const lastFive = await GameLogic.getLastFivePlayers(room.id)
            console.log('🎉 [绝地翻盘] 获取到最后5名玩家:', lastFive)
            
            setLastFivePlayers(lastFive)
            setShowComebackModal(true)
          }
        } catch (error) {
          console.error('检查选择状态失败:', error)
        }
      }, 500) // 延迟检查，确保状态已更新
    }
  }, [room?.stage, room?.id, users.filter(u => u.role === 'player' && u.order_number != null).map(u => u.selected_reward).join(',')]) // 只监听玩家的奖励选择状态变化

  // 如果未登录，显示登录界面
  if (!isLoggedIn && !loading) {
    return (
      <LoginForm
        onLoginSuccess={handleLoginSuccess}
        onError={handleLoginError}
      />
    )
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
            onClick={() => initializeApp()}
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
      {/* 实时通知 */}
      <RealtimeNotifications />
      
      {/* 游戏阶段指示器 */}
      <GameStage stage={room.stage} />
      
      {/* 奖励查看器按钮 */}
      <RewardViewer 
        roomId={room.id}
        users={users}
        className="fixed bottom-20 right-4 z-50"
      />
      
      {/* 主游戏区域 */}
      <div className="container mx-auto px-4 py-8 relative z-20">
        <div className="max-w-md mx-auto">
          {/* 根据游戏阶段显示不同内容 */}
          {room.stage === 'reward_selection' ? (
            /* 奖励选择阶段 */
            <>
              {/* 奖励选择组件 */}
              <RewardSelection
                room={room}
                currentUser={currentUser}
                users={users}
                onStageChange={() => refreshRoom()}
              />
              
              {/* 用户头像区域 - 和第一阶段相同 */}
              <UserAvatars
                users={users}
                currentUser={currentUser}
                onUserClick={(user: User) => {
                  // 处理用户点击事件
                  console.log('用户点击:', user)
                }}
                onRoleChange={updateUserRole}
                onKickUser={kickUser}
              />
            </>
          ) : (
            <>
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
                onKickUser={kickUser}
              />
            </>
          )}
          
          {/* 游戏控制区域 */}
          <GameControls
            room={room}
            currentUser={currentUser}
            users={users}
            onStageChange={() => refreshRoom()}
            onWinnerDrawn={handleWinnerDrawn}
          />
          
          {/* 表情面板 */}
          <EmojiPanel
            currentUser={currentUser}
            roomId={room.id}
            onEmojiSent={() => {
              console.log('🎯 收到表情发送回调，刷新用户数据')
              refreshUsers()
            }}
          />
        </div>
      </div>

      {/* 获奖通知弹窗 */}
      <LotteryWinnerNotification
        winner={lotteryWinner}
        currentUserId={currentUser.id}
        onClose={handleCloseWinnerNotification}
      />

      {/* 绝地翻盘弹窗 */}
      <ComebackModal
        isVisible={showComebackModal && lastFivePlayers.length > 0}
        lastFivePlayers={lastFivePlayers}
        onClose={handleComebackModalClose}
        onComplete={handleComebackModalComplete}
      />
    </div>
  )
}
