'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRealtime } from '@/lib/use-realtime'
import { useUserPresence } from '@/lib/use-user-presence'
import { performUserCleanup, markInactiveUsersOffline } from '@/lib/user-cleanup'
import { RealtimeNotifications } from '@/components/realtime-notifications'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']

export default function TestRealtime() {
  const [room, setRoom] = useState<{ id: string; name: string } | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [testMessage, setTestMessage] = useState('')

  // 使用实时通信hook
  const { refreshUsers } = useRealtime({
    roomId: room?.id || null,
    onUsersChange: (updatedUsers) => {
      console.log('🔄 [测试] 用户列表更新:', updatedUsers.length, '个用户')
      setUsers(updatedUsers)
    },
    onEmojiReceived: (emojiData) => {
      console.log('🎭 [测试] 收到表情:', emojiData)
    },
    onUserJoined: (user) => {
      console.log('🆕 [测试] 用户加入:', user.nickname)
      setTestMessage(`${user.nickname} 加入了房间`)
    },
    onUserLeft: (userId) => {
      console.log('👋 [测试] 用户离开:', userId)
      const leftUser = users.find(u => u.id === userId)
      if (leftUser) {
        setTestMessage(`${leftUser.nickname} 离开了房间`)
      }
    }
  })

  // 使用用户状态管理hook
  useUserPresence({
    userId: currentUser?.id || null,
    roomId: room?.id || null,
    enabled: !!currentUser && !!room
  })

  // 初始化测试环境
  useEffect(() => {
    initializeTest()
  }, [])

  const initializeTest = async () => {
    try {
      // 获取默认房间
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .limit(1)
      
      if (rooms && rooms.length > 0) {
        setRoom(rooms[0])
        console.log('✅ 测试房间设置完成:', rooms[0].name)
      }

      // 创建测试用户
      const testUser = {
        nickname: `测试用户_${Date.now()}`,
        avatar_url: null,
        role: 'audience' as const,
        is_online: true
      }

      const { data: user } = await supabase
        .from('users')
        .insert(testUser)
        .select()
        .single()

      if (user) {
        setCurrentUser(user)
        console.log('✅ 测试用户创建完成:', user.nickname)
      }
    } catch (error) {
      console.error('❌ 测试初始化失败:', error)
    }
  }

  const addTestUser = async () => {
    if (!room) return

    const testUser = {
      nickname: `新用户_${Date.now()}`,
      avatar_url: null,
      role: 'audience' as const,
      room_id: room.id,
      is_online: true
    }

    const { data } = await supabase
      .from('users')
      .insert(testUser)
      .select()
      .single()

    if (data) {
      console.log('✅ 添加测试用户:', data.nickname)
    }
  }

  const sendTestEmoji = async () => {
    if (!currentUser || !room) return

    const emoji = '🎉'
    const { data } = await supabase
      .from('emojis')
      .insert({
        user_id: currentUser.id,
        room_id: room.id,
        emoji: emoji,
        expires_at: new Date(Date.now() + 10000).toISOString() // 10秒后过期
      })
      .select()
      .single()

    if (data) {
      console.log('✅ 发送测试表情:', emoji)
    }
  }

  const removeTestUser = async () => {
    if (users.length > 0) {
      const userToRemove = users[0]
      await supabase
        .from('users')
        .delete()
        .eq('id', userToRemove.id)
      
      console.log('✅ 移除测试用户:', userToRemove.nickname)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-600 p-8">
      <RealtimeNotifications />
      
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            实时通信功能测试
          </h1>

          {/* 状态显示 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-2">房间信息</h3>
              <p className="text-sm text-gray-600">
                {room ? `房间: ${room.name}` : '未连接房间'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-2">当前用户</h3>
              <p className="text-sm text-gray-600">
                {currentUser ? `用户: ${currentUser.nickname}` : '未创建用户'}
              </p>
            </div>
          </div>

          {/* 用户列表 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-700 mb-4">
              房间用户 ({users.length}) - 在线: {users.filter(u => u.is_online).length}, 离线: {users.filter(u => !u.is_online).length}
            </h3>
            <div className="space-y-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    user.is_online 
                      ? 'bg-white border-green-200' 
                      : 'bg-gray-100 border-red-200 opacity-70'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm relative ${
                      user.is_online ? 'bg-purple-500' : 'bg-gray-500'
                    }`}>
                      {user.nickname.charAt(0)}
                      {/* 在线状态指示器 */}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white ${
                        user.is_online ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                    </div>
                    <div>
                      <p className={`font-medium ${user.is_online ? 'text-gray-800' : 'text-gray-500'}`}>
                        {user.nickname}
                      </p>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-gray-500">{user.role}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          user.is_online 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_online ? '在线' : '离线'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {user.current_emoji && (
                      <span className="text-2xl">{user.current_emoji}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 测试按钮 */}
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={addTestUser}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors"
            >
              添加测试用户
            </button>
            <button
              onClick={sendTestEmoji}
              className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors"
            >
              发送测试表情 🎉
            </button>
            <button
              onClick={removeTestUser}
              className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
            >
              移除用户
            </button>
                          <button
                onClick={refreshUsers}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
              >
                刷新用户列表
              </button>
              <button
                onClick={markInactiveUsersOffline}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
              >
                标记无活动用户离线
              </button>
              <button
                onClick={performUserCleanup}
                className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors"
              >
                执行用户清理
              </button>
          </div>

          {/* 测试消息 */}
          {testMessage && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">{testMessage}</p>
            </div>
          )}

          {/* 使用说明 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">测试说明</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• 点击&ldquo;添加测试用户&rdquo;将创建一个新用户，您应该看到实时通知</li>
              <li>• 点击&ldquo;发送测试表情&rdquo;将发送一个表情，您应该看到实时通知</li>
              <li>• 点击&ldquo;移除用户&rdquo;将删除一个用户，您应该看到实时通知</li>
              <li>• 点击&ldquo;标记无活动用户离线&rdquo;将检查长时间无活动的用户并标记为离线</li>
              <li>• 点击&ldquo;执行用户清理&rdquo;将清理长时间离线的用户</li>
              <li>• 打开多个浏览器标签页测试多用户实时同步</li>
              <li>• 关闭标签页或最小化窗口测试用户离线状态检测</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 