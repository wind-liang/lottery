'use client'

import { useState } from 'react'
import { Crown, User, Users, Lock, X } from 'lucide-react'
import { GameLogic } from '@/lib/game-logic'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']

interface UserAvatarsProps {
  users: User[]
  currentUser: User
  onUserClick: (user: User) => void
  onRoleChange: (userId: string, role: User['role']) => void
}

interface RoleChangeModalProps {
  user: User
  currentUser: User
  onClose: () => void
  onRoleChange: (userId: string, role: User['role']) => void
}

function RoleChangeModal({ user, currentUser, onClose, onRoleChange }: RoleChangeModalProps) {
  const [password, setPassword] = useState('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [error, setError] = useState('')

  const handleBecomeHost = () => {
    if (GameLogic.verifyHostPassword(password)) {
      onRoleChange(user.id, 'host')
      onClose()
    } else {
      setError('密码错误')
    }
  }

  const handleRoleChange = (newRole: User['role']) => {
    if (newRole === 'host' && currentUser.role !== 'host') {
      setShowPasswordInput(true)
      return
    }
    onRoleChange(user.id, newRole)
    onClose()
  }

  const isHost = currentUser.role === 'host'
  const canChangeRole = isHost || (user.id === currentUser.id && user.role === 'audience')

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
              console.log('模态框头像加载失败，使用默认头像:', user.avatar_url)
              const target = e.target as HTMLImageElement
              target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
            }}
          />
          <h4 className="font-medium text-gray-800">{user.nickname}</h4>
          <p className="text-sm text-gray-500">
            {user.role === 'host' ? '主持人' : user.role === 'player' ? '玩家' : '观众'}
          </p>
        </div>

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
              {error && (
                <p className="text-red-500 text-sm mt-1">{error}</p>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowPasswordInput(false)}
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

export function UserAvatars({ users, currentUser, onUserClick, onRoleChange }: UserAvatarsProps) {
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

  const getRoleBorder = (role: User['role']) => {
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

  const avatarSize = getAvatarSize(users.length)

  return (
    <div className="mb-8">
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
        <h3 className="text-white font-medium mb-4 text-center">
          房间成员 ({users.length})
        </h3>
        
        <div className="flex flex-wrap justify-center gap-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="relative cursor-pointer"
              onClick={() => handleUserClick(user)}
            >
              <div className={`${avatarSize} rounded-full border-2 ${getRoleBorder(user.role)} shadow-lg relative overflow-hidden`}>
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                  alt={user.nickname}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.log('头像加载失败，使用默认头像:', user.avatar_url)
                    const target = e.target as HTMLImageElement
                    target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
                  }}
                  onLoad={() => {
                    console.log('头像加载成功:', user.avatar_url)
                  }}
                />
                
                {/* 角色图标 */}
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 border border-gray-200">
                  {getRoleIcon(user.role)}
                </div>
                
                {/* 顺序号 */}
                {user.order_number && (
                  <div className="absolute -bottom-1 -left-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {user.order_number}
                  </div>
                )}
                
                {/* 当前用户标识 */}
                {user.id === currentUser.id && (
                  <div className="absolute inset-0 border-2 border-white rounded-full"></div>
                )}
                
                {/* 离线状态 */}
                {!user.is_online && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <Lock className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              
              <p className="text-white text-xs text-center mt-1 truncate w-16">
                {user.nickname}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      {selectedUser && (
        <RoleChangeModal
          user={selectedUser}
          currentUser={currentUser}
          onClose={() => setSelectedUser(null)}
          onRoleChange={onRoleChange}
        />
      )}
    </div>
  )
} 