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
import { RefreshButton } from '@/components/refresh-button'
import { Confetti } from '@/components/confetti'
import { ConnectionStatusMini } from '@/components/connection-status'
import { RealtimePerformanceMonitor } from '@/components/realtime-performance-monitor'

import { useRealtimeOptimized as useRealtime } from '@/lib/use-realtime-optimized'
import { useUserPresenceOptimized as useUserPresence } from '@/lib/use-user-presence-optimized'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']
type Reward = Database['public']['Tables']['rewards']['Row']

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
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
    
    // 在奖励选择阶段，添加详细的用户状态日志
    if (room?.stage === 'reward_selection') {
      const playersWithOrder = updatedUsers.filter(u => u.role === 'player' && u.order_number != null)
      const playersWithReward = playersWithOrder.filter(u => u.selected_reward != null)
      console.log('🔄 [实时] 奖励选择阶段用户状态:', {
        totalPlayers: playersWithOrder.length,
        selectedPlayers: playersWithReward.length,
        progress: playersWithReward.map(p => ({ nickname: p.nickname, order: p.order_number }))
      })
    }
    
    setUsers(updatedUsers)
    
    // 同步更新currentUser状态
    if (currentUser) {
      const updatedCurrentUser = updatedUsers.find(u => u.id === currentUser.id)
      if (updatedCurrentUser) {
        console.log('🔄 [实时] 当前用户信息同步更新:', updatedCurrentUser.role)
        setCurrentUser(updatedCurrentUser)
      }
    }
  }, [currentUser, room?.stage])

  const handleRoomChange = useCallback((updatedRoom: Room) => {
    console.log('🔄 [实时] 房间信息更新:', updatedRoom?.name, '阶段:', updatedRoom?.stage)
    
    // 重置绝地翻盘弹窗标志的条件：
    // 1. 离开 reward_selection 阶段
    // 2. 游戏被重置（回到 waiting 阶段）
    // 3. 重新进入 reward_selection 阶段（新一轮游戏）
    if (room && room.stage !== updatedRoom.stage) {
      if (room.stage === 'reward_selection' || updatedRoom.stage === 'waiting' || updatedRoom.stage === 'reward_selection') {
        console.log('🔄 [实时] 检测到阶段变更，重置绝地翻盘弹窗标志')
        console.log('🔄 [实时] 原阶段:', room.stage, '新阶段:', updatedRoom.stage)
        comebackModalShownRef.current = false // 重置 ref
        setShowComebackModal(false) // 同时关闭弹窗
        setLastFivePlayers([]) // 清空最后五名玩家数据
        
        // 如果是游戏重置，也重置获奖通知弹窗
        if (updatedRoom.stage === 'waiting') {
          console.log('🔄 [实时] 游戏重置，清理获奖通知弹窗')
          setLotteryWinner(null) // 清空获奖通知
        }
      }
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
    
    // 防重复机制：检查是否已经显示了相同的获奖者
    if (lotteryWinner && lotteryWinner.userId === winner.userId && lotteryWinner.orderNumber === winner.orderNumber) {
      console.log('🏆 [实时] 已显示相同获奖者，跳过重复显示')
      return
    }
    
    // 时序协调：确保在状态更新之前有足够的准备时间
    setTimeout(() => {
      console.log('🏆 [实时] 延迟显示获奖弹窗，确保状态同步')
      setLotteryWinner(winner)
      console.log('🏆 [实时] 已设置获奖弹窗状态')
    }, 100) // 100ms延迟，确保状态同步
  }, [currentUser, lotteryWinner])

  const handleRewardsChange = useCallback((rewardsData: Reward[]) => {
    console.log('🎁 [实时] 奖励数据更新:', rewardsData.length)
    setRewards(rewardsData)
  }, [])

  // 使用优化版实时通信hook
  const { refreshRoom } = useRealtime({
    roomId: room?.id || null,
    onUsersChange: handleUsersChange,
    onRoomChange: handleRoomChange,
    onRewardsChange: handleRewardsChange,
    onEmojiReceived: handleEmojiReceived,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onWinnerDrawn: handleRealtimeWinnerDrawn
  })

  // 使用优化版用户状态管理hook
  const presenceData = useUserPresence({
    userId: currentUser?.id || null,
    roomId: room?.id || null,
    enabled: !!currentUser && !!room
  })
  
  const { connectionState, isOnline } = presenceData

  // 定期清理过期表情（降低频率，减少数据库负载）
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      GameLogic.cleanupExpiredEmojis()
      // 实时订阅会自动处理表情变化，无需手动刷新
    }, 300000) // 改为5分钟清理一次，大幅降低频率

    return () => clearInterval(cleanupInterval)
  }, [])

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
            is_online: true
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
      // 首先检查用户是否已经有 display_order
      const { data: currentUser, error: getUserError } = await supabase
        .from('users')
        .select('display_order')
        .eq('id', userId)
        .single()

      if (getUserError) throw getUserError

      let displayOrder = currentUser?.display_order

      // 如果用户还没有 display_order，为其分配一个
      if (displayOrder === null || displayOrder === undefined) {
        // 查询当前房间内的最大 display_order
        const { data: maxOrderData, error: maxOrderError } = await supabase
          .from('users')
          .select('display_order')
          .eq('room_id', roomId)
          .not('display_order', 'is', null)
          .order('display_order', { ascending: false })
          .limit(1)

        if (maxOrderError) throw maxOrderError

        // 设置新的 display_order
        displayOrder = (maxOrderData?.[0]?.display_order || 0) + 1
      }

      // 更新用户的房间ID和 display_order
      const updateData: { room_id: string; display_order?: number } = { room_id: roomId }
      if (currentUser?.display_order === null || currentUser?.display_order === undefined) {
        updateData.display_order = displayOrder
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updateData)
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



  // 监听用户变化以检查是否所有人都选择完毕 - 优化依赖项
  useEffect(() => {
    // 只在奖励选择阶段且有用户且弹窗未显示过时才检查
    if (room?.stage === 'reward_selection' && users.length > 0 && !comebackModalShownRef.current) {
      console.log('🔍 [检查选择状态] 开始检查，弹窗是否已显示过:', comebackModalShownRef.current)
      
      // 使用更短的防抖时间，确保快速响应
      const checkTimeout = setTimeout(async () => {
        try {
          // 再次检查标记，防止在延迟期间被其他调用标记
          if (comebackModalShownRef.current) {
            console.log('🔍 [检查选择状态] 弹窗已在其他地方显示，跳过')
            return
          }
          
          // 直接使用已有的用户数据，避免重复查询
          const playersWithOrder = users.filter(u => u.role === 'player' && u.order_number != null)
          const playersWithReward = playersWithOrder.filter(u => u.selected_reward != null)
          
          console.log('🔍 [检查选择状态] 所有玩家:', playersWithOrder.map(p => ({
            nickname: p.nickname,
            order: p.order_number,
            hasSelected: !!p.selected_reward
          })))
          
          console.log('🔍 [检查选择状态] 选择进度:', playersWithReward.length, '/', playersWithOrder.length)
          
          // 检查是否所有人都选择了奖励
          const allSelected = playersWithOrder.length > 0 && playersWithReward.length === playersWithOrder.length
          
          console.log('🔍 [检查选择状态] 是否全部选择完毕:', allSelected)

          if (allSelected) {
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
      }, 100) // 减少到100ms防抖，提高响应速度

      return () => clearTimeout(checkTimeout)
    }
  }, [
    room?.stage, 
    room?.id, 
    // 优化依赖项：直接监听用户数组的变化，确保任何奖励选择状态变化都能触发检查
    users.map(u => u.role === 'player' && u.order_number != null && u.selected_reward != null ? `${u.id}:selected` : `${u.id}:unselected`).join(',')
  ])

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
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center">
        <div className="text-gray-800 text-center">
          <h1 className="text-2xl font-bold mb-4">加载失败</h1>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => initializeApp()}
            className="bg-white text-pink-600 px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-rose-200">
      {/* 撒花效果 - 游戏结束时显示 */}
      <Confetti isActive={room.stage === 'finished'} />
      
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
      
      {/* 刷新按钮 */}
      <RefreshButton 
        onRefresh={() => {
          window.location.reload()
        }}
        className="bottom-36 right-4"
      />
      
      {/* 开发环境调试工具 */}
      {process.env.NODE_ENV === 'development' && (
        <>
          {/* 连接状态指示器 */}
          <ConnectionStatusMini
            connectionState={connectionState}
            isOnline={isOnline}
            className="fixed bottom-4 right-4 z-40"
          />
          
          {/* 性能监控 */}
          <RealtimePerformanceMonitor
            enabled={true}
            className="fixed bottom-4 left-4 w-80 z-40"
          />
        </>
      )}
      
      {/* 主游戏区域 */}
      <div className="container mx-auto px-4 py-8 relative z-20">
        <div className="max-w-md mx-auto">
          {/* 根据游戏阶段显示不同内容 */}
          {room.stage === 'reward_selection' && !showComebackModal ? (
            /* 奖励选择阶段 - 但不在绝地翻盘弹窗状态时 */
            <>
              {/* 奖励选择组件 */}
              <RewardSelection
                room={room}
                currentUser={currentUser}
                users={users}
                rewards={rewards}
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
          ) : showComebackModal ? (
            /* 当绝地翻盘弹窗显示时，显示等待界面 */
            <>
              {/* 抽奖箱 - 但显示等待绝地翻盘的状态 */}
              <LotteryBox 
                roomId={room.id}
                stage="final_lottery" // 传递绝地翻盘阶段状态
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
          ) : (
            <>
              {/* 其他阶段：抽奖箱 */}
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
        </div>
      </div>

      {/* 表情面板 - 移到页面根部以避免层叠上下文问题 */}
      <EmojiPanel
        currentUser={currentUser}
        roomId={room.id}
        onEmojiSent={() => {
          console.log('🎯 表情发送完成 - 完全依赖实时订阅自动更新')
          // 优化：完全移除手动刷新，依赖实时订阅自动处理
          // 这样可以避免重复查询，提高性能
        }}
      />

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
