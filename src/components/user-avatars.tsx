'use client'

import { useState } from 'react'
import { Crown, User, Users, Lock, X, UserX, AlertTriangle } from 'lucide-react'
import { GameLogic } from '@/lib/game-logic'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']

interface UserAvatarsProps {
  users: User[]
  currentUser: User
  onUserClick: (user: User) => void
  onRoleChange: (userId: string, role: User['role']) => void
  onKickUser: (userId: string) => void
}

interface RoleChangeModalProps {
  user: User
  currentUser: User
  users: User[]
  onClose: () => void
  onRoleChange: (userId: string, role: User['role']) => void
  onKickUser: (userId: string) => void
}

function RoleChangeModal({ user, currentUser, users, onClose, onRoleChange, onKickUser }: RoleChangeModalProps) {
  const [password, setPassword] = useState('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [showKickConfirm, setShowKickConfirm] = useState(false)
  const [error, setError] = useState('')

  const handleBecomeHost = () => {
    // 检查主持人数量限制
    const hostCount = users.filter(u => u.role === 'host').length
    if (hostCount >= 2) {
      setError('最多只能有两个主持人')
      return
    }

    if (GameLogic.verifyHostPassword(password)) {
      onRoleChange(user.id, 'host')
      onClose()
    } else {
      setError('密码错误')
    }
  }

  const handleRoleChange = (newRole: User['role']) => {
    if (newRole === 'host') {
      // 检查主持人数量限制
      const hostCount = users.filter(u => u.role === 'host').length
      if (hostCount >= 2) {
        setError('最多只能有两个主持人')
        return
      }
      
      if (currentUser.role !== 'host') {
        setShowPasswordInput(true)
        return
      }
    }
    
    onRoleChange(user.id, newRole)
    onClose()
  }

  const handleKickUser = () => {
    onKickUser(user.id)
    onClose()
  }

  const isHost = currentUser.role === 'host'
  const canChangeRole = isHost || (user.id === currentUser.id && user.role === 'audience')
  const canKickUser = isHost && user.id !== currentUser.id // 主持人不能踢出自己

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">用户设置</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-6">
          <img
            src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
            alt={user.nickname}
            className="w-16 h-16 rounded-full mx-auto mb-2"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
            }}
          />
          <h4 className="font-medium text-gray-800">{user.nickname}</h4>
          <p className="text-sm text-gray-500">
            {user.role === 'host' ? '主持人' : user.role === 'player' ? '玩家' : '观众'}
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {showPasswordInput ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                输入主持人密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="请输入密码"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowPasswordInput(false)
                  setError('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleBecomeHost}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                确认
              </button>
            </div>
          </div>
        ) : showKickConfirm ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-800">确认踢出用户</h4>
                <p className="text-sm text-red-600 mt-1">
                  您确定要踢出用户 &ldquo;<strong>{user.nickname}</strong>&rdquo; 吗？
                </p>
                <p className="text-xs text-red-500 mt-2">
                  此操作将立即将用户从房间中移除，用户需要重新加入房间。
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowKickConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleKickUser}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                确认踢出
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {canChangeRole && (
              <>
                {user.role === 'audience' && (
                  <>
                    <button
                      onClick={() => handleRoleChange('host')}
                      className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center space-x-2"
                    >
                      <Crown className="w-4 h-4" />
                      <span>成为主持人</span>
                    </button>
                    {isHost && (
                      <button
                        onClick={() => handleRoleChange('player')}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2"
                      >
                        <User className="w-4 h-4" />
                        <span>设为玩家</span>
                      </button>
                    )}
                  </>
                )}
                
                {user.role === 'player' && isHost && (
                  <button
                    onClick={() => handleRoleChange('audience')}
                    className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center space-x-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>设为观众</span>
                  </button>
                )}
              </>
            )}
            
            {/* 踢出用户按钮 */}
            {canKickUser && (
              <button
                onClick={() => setShowKickConfirm(true)}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center space-x-2"
              >
                <UserX className="w-4 h-4" />
                <span>踢出用户</span>
              </button>
            )}
            
            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function UserAvatars({ users, currentUser, onUserClick, onRoleChange, onKickUser }: UserAvatarsProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const handleUserClick = (user: User) => {
    onUserClick(user)
    
    // 如果是主持人点击其他用户，或者用户点击自己，显示角色设置弹窗
    if (currentUser.role === 'host' || user.id === currentUser.id) {
      setSelectedUser(user)
    }
  }

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'host':
        return <Crown className="w-3 h-3 text-yellow-400" />
      case 'player':
        return <User className="w-3 h-3 text-blue-400" />
      default:
        return <Users className="w-3 h-3 text-gray-400" />
    }
  }

  const getRoleBorder = (role: User['role'], isOnline: boolean) => {
    if (!isOnline) {
      return 'border-gray-500 shadow-gray-500/30 opacity-60'
    }
    
    switch (role) {
      case 'host':
        return 'border-yellow-400 shadow-yellow-400/50'
      case 'player':
        return 'border-blue-400 shadow-blue-400/50'
      default:
        return 'border-gray-300 shadow-gray-300/50'
    }
  }

  const getAvatarSize = (totalUsers: number) => {
    if (totalUsers <= 6) return 'w-16 h-16'
    if (totalUsers <= 12) return 'w-14 h-14'
    if (totalUsers <= 20) return 'w-12 h-12'
    return 'w-10 h-10'
  }

  // 过滤掉主持人，因为主持人头像已经在抽奖箱两侧显示
  // 按加入时间排序，保持固定顺序
  const nonHostUsers = users
    .filter(user => user.role !== 'host')
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
  const avatarSize = getAvatarSize(nonHostUsers.length)

  return (
    <div className="mb-8">
      <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-4 border border-gray-300/50">
        <h3 className="text-gray-800 font-medium mb-4 text-center">
          房间成员 ({users.length}) - 在线: {users.filter(u => u.is_online).length}
        </h3>
        
        <div className="flex flex-wrap justify-center gap-2 p-1">
          {nonHostUsers.map((user) => (
            <div
              key={user.id}
              className="relative cursor-pointer p-1"
              onClick={() => handleUserClick(user)}
            >
              <div className={`${avatarSize} rounded-full border-2 ${getRoleBorder(user.role, user.is_online)} shadow-lg relative`}>
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                  alt={user.nickname}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
                  }}
                />
                
                {/* 表情显示 */}
                {user.current_emoji && user.emoji_expires_at && new Date(user.emoji_expires_at) > new Date() && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 flex items-center justify-center z-50">
                    <span className={`animate-bounce ${nonHostUsers.length <= 6 ? 'text-5xl' : nonHostUsers.length <= 12 ? 'text-4xl' : 'text-3xl'}`}>
                      {user.current_emoji}
                    </span>
                  </div>
                )}
                
                {/* 角色图标 */}
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 border border-gray-200">
                  {getRoleIcon(user.role)}
                </div>
                
                {/* 当前用户标识 */}
                {user.id === currentUser.id && (
                  <div className="absolute inset-0 border-2 border-white rounded-full pointer-events-none"></div>
                )}
                
                {/* 顺序号 */}
                {user.order_number && (
                  <div className="absolute -bottom-1 -left-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold z-10">
                    {user.order_number === -1 ? '🏆' : user.order_number}
                  </div>
                )}
                
                {/* 离线状态 */}
                {!user.is_online && (
                  <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center">
                    <div className="text-center">
                      <Lock className="w-4 h-4 text-red-400 mx-auto mb-1" />
                      <span className="text-xs text-red-400 font-medium">离线</span>
                    </div>
                  </div>
                )}
                
                {/* 在线状态指示器 */}
                {user.is_online && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
              
              <p className={`text-xs text-center mt-2 mb-1 truncate max-w-20 ${user.is_online ? 'text-gray-800' : 'text-gray-400'}`}>
                {user.nickname}
                {!user.is_online && (
                  <span className="block text-xs text-red-400 font-medium">离线</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      {selectedUser && (
        <RoleChangeModal
          user={selectedUser}
          currentUser={currentUser}
          users={users}
          onClose={() => setSelectedUser(null)}
          onRoleChange={onRoleChange}
          onKickUser={onKickUser}
        />
      )}
    </div>
  )
} 