'use client'

import { useState } from 'react'
import { X, User, Camera, Save, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { GameLogic } from '@/lib/game-logic'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']

interface UserSettingsProps {
  user: User
  onClose: () => void
  onUserUpdate: (user: User) => void
}

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=happy',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=smile',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=cool',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=cute',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=funny',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=brave',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=smart',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=lucky',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=elegant',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=mystery',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=shine',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=angel'
]

export function UserSettings({ user, onClose, onUserUpdate }: UserSettingsProps) {
  const [nickname, setNickname] = useState(user.nickname || '')
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar_url || AVATAR_OPTIONS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 生成更多随机头像选项
  const generateRandomAvatars = () => {
    const additionalAvatars = []
    for (let i = 0; i < 12; i++) {
      const seed = Math.random().toString(36).substring(7)
      additionalAvatars.push(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`)
    }
    return [...AVATAR_OPTIONS, ...additionalAvatars]
  }

  const [avatarOptions, setAvatarOptions] = useState(generateRandomAvatars())

  const handleRefreshAvatars = () => {
    setAvatarOptions(generateRandomAvatars())
  }

  const handleSave = async () => {
    if (!nickname.trim()) {
      setError('请输入昵称')
      return
    }

    if (nickname.trim().length < 2) {
      setError('昵称至少需要2个字符')
      return
    }

    if (nickname.trim().length > 20) {
      setError('昵称不能超过20个字符')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 更新数据库
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          nickname: nickname.trim(),
          avatar_url: selectedAvatar,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) throw updateError

      // 更新localStorage
      const userSettings = {
        nickname: nickname.trim(),
        avatar_url: selectedAvatar,
        updated_at: new Date().toISOString()
      }
      localStorage.setItem('lottery_user_settings', JSON.stringify(userSettings))
      
      console.log('✅ 用户设置保存成功:', userSettings)
      
      // 通知父组件更新用户信息
      onUserUpdate(updatedUser)
      onClose()
    } catch (error) {
      console.error('❌ 保存用户设置失败:', error)
      setError('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRandomNickname = () => {
    const randomNickname = GameLogic.generateNickname()
    setNickname(randomNickname)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">个人设置</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* 当前头像 */}
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <img
              src={selectedAvatar}
              alt="当前头像"
              className="w-20 h-20 rounded-full border-4 border-purple-200 shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 bg-purple-500 text-white rounded-full p-1">
              <Camera className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 昵称设置 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            昵称
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="请输入昵称"
              maxLength={20}
            />
            <button
              onClick={handleGenerateRandomNickname}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              title="随机生成昵称"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {nickname.length}/20 字符
          </p>
        </div>

        {/* 头像选择 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              选择头像
            </label>
            <button
              onClick={handleRefreshAvatars}
              className="text-sm text-purple-600 hover:text-purple-700 flex items-center space-x-1"
            >
              <RefreshCw className="w-4 h-4" />
              <span>更换头像</span>
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-3 max-h-60 overflow-y-auto">
            {avatarOptions.map((avatar, index) => (
              <button
                key={index}
                onClick={() => setSelectedAvatar(avatar)}
                className={`relative w-14 h-14 rounded-full border-2 transition-all ${
                  selectedAvatar === avatar
                    ? 'border-purple-500 ring-2 ring-purple-200'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <img
                  src={avatar}
                  alt={`头像选项 ${index + 1}`}
                  className="w-full h-full rounded-full object-cover"
                />
                {selectedAvatar === avatar && (
                  <div className="absolute inset-0 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{loading ? '保存中...' : '保存'}</span>
          </button>
        </div>
      </div>
    </div>
  )
} 