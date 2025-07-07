'use client'

import { useState, useEffect } from 'react'
import { X, Gift, Crown, User, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLogic } from '@/lib/game-logic'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Reward = Database['public']['Tables']['rewards']['Row']

interface RewardViewerProps {
  roomId: string
  users: User[]
  className?: string
}

interface UserRewardSelection {
  user: User
  reward: Reward | null
}

export function RewardViewer({ roomId, users, className = '' }: RewardViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userRewards, setUserRewards] = useState<UserRewardSelection[]>([])
  const [loading, setLoading] = useState(false)

  // 获取奖励数据
  const fetchRewards = async () => {
    try {
      setLoading(true)
      const rewardList = await GameLogic.getRewards(roomId)
      
      // 构建用户奖励选择数据
      const userRewardData: UserRewardSelection[] = users
        .filter(user => user.role === 'player' && user.selected_reward)
        .map(user => ({
          user,
          reward: rewardList.find(r => r.id === user.selected_reward) || null
        }))
        .sort((a, b) => (a.user.order_number || 0) - (b.user.order_number || 0))
      
      setUserRewards(userRewardData)
    } catch (error) {
      console.error('获取奖励数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 当弹窗打开时获取数据
  useEffect(() => {
    if (isOpen) {
      fetchRewards()
    }
  }, [isOpen, roomId])

  const handleToggle = () => {
    setIsOpen(!isOpen)
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

  const getRewardImage = (reward: Reward) => {
    return reward.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${reward.id}`
  }

  // 统计已选择奖励的用户数量
  const selectedCount = users.filter(user => user.role === 'player' && user.selected_reward).length
  const totalPlayers = users.filter(user => user.role === 'player').length

  return (
    <>
      {/* 奖励查看按钮 */}
      <div className={className}>
        <button
          onClick={handleToggle}
          className="w-12 h-12 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-all hover:scale-110 border border-white/30 shadow-lg flex items-center justify-center relative group"
          title="查看奖励选择"
        >
          <Gift className="w-5 h-5 group-hover:scale-110 transition-transform" />
          {/* 选择进度指示器 */}
          {totalPlayers > 0 && (
            <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg animate-pulse">
              {selectedCount}
            </div>
          )}
        </button>
      </div>

      {/* 奖励选择弹窗 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] shadow-2xl relative"
            >
              {/* 固定的关闭按钮 */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors bg-white/80 backdrop-blur-sm shadow-md"
              >
                <X className="w-5 h-5" />
              </button>

              {/* 可滚动的内容区域 */}
              <div className="p-6 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center space-x-3 mb-6 pr-12">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-full p-2">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">奖励选择情况</h3>
                </div>

              {/* 统计信息 */}
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">选择进度</span>
                  <span className="text-sm font-bold text-blue-600">
                    {selectedCount} / {totalPlayers} 人已选择
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: totalPlayers > 0 ? `${(selectedCount / totalPlayers) * 100}%` : '0%' }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  完成度: {totalPlayers > 0 ? Math.round((selectedCount / totalPlayers) * 100) : 0}%
                </div>
              </div>

              {/* 加载状态 */}
              {loading && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-600 mt-4 font-medium">正在加载奖励数据...</p>
                </div>
              )}

              {/* 用户奖励选择列表 */}
              {!loading && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {userRewards.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                        <Gift className="w-10 h-10 text-gray-300" />
                      </div>
                      <p className="text-lg font-medium text-gray-600 mb-2">暂无用户选择奖励</p>
                      <p className="text-sm text-gray-400">等待用户选择心仪的奖励...</p>
                    </div>
                  ) : (
                    userRewards.map((userReward, index) => (
                      <div
                        key={userReward.user.id}
                        className="p-4 bg-gradient-to-r from-white to-gray-50/50 rounded-xl border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-200"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        {/* 第一行：用户信息 */}
                        <div className="flex items-center space-x-4 mb-3">
                          {/* 用户头像 */}
                          <div className="relative flex-shrink-0">
                            <img
                              src={userReward.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userReward.user.id}`}
                              alt={userReward.user.nickname}
                              className="w-12 h-12 rounded-full border-3 border-blue-400 shadow-sm"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userReward.user.id}`
                              }}
                            />
                            {/* 顺序号 */}
                            {userReward.user.order_number && (
                              <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg">
                                {userReward.user.order_number}
                              </div>
                            )}
                          </div>

                          {/* 用户信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-semibold text-gray-800">
                                {userReward.user.nickname}
                              </span>
                              <div className="flex items-center">
                                {getRoleIcon(userReward.user.role)}
                              </div>
                            </div>
                            <p className="text-sm text-gray-500 font-medium">
                              第 {userReward.user.order_number} 名
                            </p>
                          </div>
                        </div>

                        {/* 第二行：奖励信息 */}
                        {userReward.reward && (
                          <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm flex-shrink-0">
                              <img
                                src={getRewardImage(userReward.reward)}
                                alt={userReward.reward.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800 mb-1">
                                {userReward.reward.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {userReward.reward.description}
                              </p>
                            </div>
                            <div className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded-full">
                              已选择
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 刷新按钮 */}
              <div className="mt-6 flex justify-center border-t border-gray-100 pt-4">
                <button
                  onClick={fetchRewards}
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md font-medium flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>刷新中...</span>
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4" />
                      <span>刷新数据</span>
                    </>
                  )}
                </button>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
} 