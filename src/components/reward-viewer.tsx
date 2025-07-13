'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Gift, Crown, User, Users, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLogic } from '@/lib/game-logic'
import { supabase } from '@/lib/supabase'
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
  isFinalLotteryWinner?: boolean
}

export function RewardViewer({ roomId, users, className = '' }: RewardViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userRewards, setUserRewards] = useState<UserRewardSelection[]>([])
  const [loading, setLoading] = useState(false)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [rewardCache, setRewardCache] = useState<Reward[]>([])
  const [lastFetchTime, setLastFetchTime] = useState(0)

  // 获取奖励数据 - 优化版本
  const fetchRewards = async () => {
    try {
      setLoading(true)
      
      // 缓存策略：如果距离上次获取不足2秒，且有缓存数据，则使用缓存
      const now = Date.now()
      if (now - lastFetchTime < 2000 && rewardCache.length > 0) {
        console.log('🚀 [RewardViewer] 使用缓存数据，跳过数据库查询')
        await buildUserRewards(rewardCache)
        setLoading(false)
        return
      }
      
      // 获取奖励列表
      const rewardList = await GameLogic.getRewards(roomId)
      
      // 更新缓存
      setRewardCache(rewardList)
      setLastFetchTime(now)
      
      // 稳定的绝地翻盘获胜者查询 - 不依赖于选择状态的实时变化
      let finalLotteryWinner = null
      try {
        const { data: finalWinner, error: finalError } = await supabase
          .from('final_lottery_participants')
          .select(`
            *,
            users (*)
          `)
          .eq('room_id', roomId)
          .eq('is_drawn', true)
          .single()
        
        if (finalError && finalError.code !== 'PGRST116') {
          console.error('获取绝地翻盘获胜者失败:', finalError)
        } else {
          finalLotteryWinner = finalWinner
        }
      } catch (error) {
        console.error('查询绝地翻盘获胜者异常:', error)
      }

      await buildUserRewards(rewardList, finalLotteryWinner)
      
    } catch (error) {
      console.error('获取奖励数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 构建用户奖励数据的辅助函数
  const buildUserRewards = useCallback(async (rewardList: Reward[], finalLotteryWinner?: { users: User } | null) => {
    // 更新参与者数量
    const hasSelectedRewards = users.some(user => user.role === 'player' && user.selected_reward)
    if (hasSelectedRewards) {
      const { data: participantsCountData, error: participantsError } = await supabase
        .from('lottery_participants')
        .select('id')
        .eq('room_id', roomId)
      
      if (participantsError) {
        console.error('获取参与抽奖人数失败:', participantsError)
        setTotalParticipants(0)
      } else {
        setTotalParticipants(participantsCountData?.length || 0)
      }
    }

    // 如果没有传入绝地翻盘获胜者，则查询
    let winner = finalLotteryWinner
    if (!winner) {
      // 稳定的绝地翻盘获胜者查询 - 不依赖于选择状态的实时变化
      try {
        const { data: finalWinner, error: finalError } = await supabase
          .from('final_lottery_participants')
          .select(`
            *,
            users (*)
          `)
          .eq('room_id', roomId)
          .eq('is_drawn', true)
          .single()
        
        if (finalError && finalError.code !== 'PGRST116') {
          console.error('获取绝地翻盘获胜者失败:', finalError)
        } else {
          winner = finalWinner
        }
      } catch (error) {
        console.error('查询绝地翻盘获胜者异常:', error)
      }
    }

    console.log('🏆 [RewardViewer] 绝地翻盘获胜者:', winner?.users?.nickname || '无')
    
    // 构建有奖励选择的用户数据
    const normalUserRewards: UserRewardSelection[] = users
      .filter(user => user.role === 'player' && user.selected_reward)
      .map(user => ({
        user,
        reward: rewardList.find(r => r.id === user.selected_reward) || null,
        isFinalLotteryWinner: false
      }))
      .sort((a, b) => (a.user.order_number || 0) - (b.user.order_number || 0))
    
    // 添加绝地翻盘获胜者（如果存在）
    let allUserRewards = [...normalUserRewards]
    if (winner?.users) {
      const finalWinnerData: UserRewardSelection = {
        user: winner.users as User,
        reward: {
          id: 'final-lottery-special',
          name: '绝地翻盘大奖',
          description: '恭喜获得绝地翻盘大奖！',
          image_url: null,
          room_id: roomId,
          order_index: 999,
          selected_by: winner.users.id,
          created_at: new Date().toISOString()
        } as Reward,
        isFinalLotteryWinner: true
      }
      allUserRewards = [...allUserRewards, finalWinnerData]
    }
    
    setUserRewards(allUserRewards)
  }, [users, roomId])

  // 当弹窗打开时获取数据
  useEffect(() => {
    if (isOpen) {
      fetchRewards()
    }
  }, [isOpen, roomId])

  // 监听用户数据变化，实时更新奖励选择进度 - 添加防抖机制
  useEffect(() => {
    // 如果弹窗已经打开且有奖励缓存，则基于最新用户数据重新构建奖励选择情况
    if (isOpen && rewardCache.length > 0) {
      console.log('🔄 [RewardViewer] 用户数据变化，重新构建奖励选择情况')
      
      // 添加防抖机制，避免频繁更新导致闪烁
      const debounceTimer = setTimeout(() => {
        buildUserRewards(rewardCache)
      }, 300)
      
      return () => clearTimeout(debounceTimer)
    }
  }, [users, isOpen, rewardCache, buildUserRewards])

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

  const getRewardImage = (reward: Reward, isFinalLotteryWinner?: boolean) => {
    if (isFinalLotteryWinner) {
      return `https://api.dicebear.com/7.x/shapes/svg?seed=final-lottery-${reward.id}`
    }
    return reward.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${reward.id}`
  }

  // 获取红包奖励金额 - 复用与获奖通知弹窗一致的逻辑
  const getRedPacketReward = (userReward: UserRewardSelection) => {
    // 绝地翻盘获胜者的奖励
    if (userReward.isFinalLotteryWinner) return 300
    
    // 根据排名给予红包奖励
    const rewardMap: { [key: number]: number } = {
      1: 88,
      2: 66,
      3: 50,
      4: 30
    }
    
    return rewardMap[userReward.user.order_number || 0] || null
  }

  // 统计已选择奖励的用户数量和绝地翻盘获胜者 - 使用 useMemo 优化
  const selectedCount = useMemo(() => 
    users.filter(user => user.role === 'player' && user.selected_reward).length, 
    [users]
  )
  
  const hasFinalLotteryWinner = useMemo(() => 
    userRewards.some(ur => ur.isFinalLotteryWinner), 
    [userRewards]
  )
  
  const displayCount = useMemo(() => 
    selectedCount + (hasFinalLotteryWinner ? 1 : 0), 
    [selectedCount, hasFinalLotteryWinner]
  )
  
  // 修复进度显示：如果 totalParticipants 为 0 但 selectedCount 不为 0，则将 totalParticipants 设置为 selectedCount
  const adjustedTotalParticipants = useMemo(() => 
    totalParticipants === 0 && selectedCount > 0 ? selectedCount : totalParticipants, 
    [totalParticipants, selectedCount]
  )

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
          {(adjustedTotalParticipants > 0 || hasFinalLotteryWinner) && (
            <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg animate-pulse">
              {displayCount}
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
                    {selectedCount} / {adjustedTotalParticipants} 人已选择{hasFinalLotteryWinner ? ' + 1 绝地翻盘' : ''}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: adjustedTotalParticipants > 0 ? `${(selectedCount / adjustedTotalParticipants) * 100}%` : '0%' }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  完成度: {adjustedTotalParticipants > 0 ? Math.round((selectedCount / adjustedTotalParticipants) * 100) : 0}%
                  {hasFinalLotteryWinner && ' (+ 绝地翻盘)'}
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
                        className={`p-4 rounded-xl border transition-all duration-200 ${
                          userReward.isFinalLotteryWinner
                            ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 hover:shadow-lg hover:border-red-300'
                            : 'bg-gradient-to-r from-white to-gray-50/50 border-gray-100 hover:shadow-md hover:border-blue-200'
                        }`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        {/* 第一行：用户信息 */}
                        <div className="flex items-center space-x-4 mb-3">
                          {/* 用户头像 */}
                          <div className="relative flex-shrink-0">
                            <img
                              src={userReward.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userReward.user.id}`}
                              alt={userReward.user.nickname}
                              className={`w-12 h-12 rounded-full border-3 shadow-sm ${
                                userReward.isFinalLotteryWinner ? 'border-red-400' : 'border-blue-400'
                              }`}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userReward.user.id}`
                              }}
                            />
                            {/* 顺序号或翻盘标识 */}
                            <div className={`absolute -bottom-1 -right-1 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg ${
                              userReward.isFinalLotteryWinner 
                                ? 'bg-gradient-to-r from-red-500 to-red-600' 
                                : 'bg-gradient-to-r from-red-500 to-pink-500'
                            }`}>
                              {userReward.isFinalLotteryWinner ? '翻' : userReward.user.order_number}
                            </div>
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
                              {userReward.isFinalLotteryWinner && (
                                <Zap className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <p className="text-sm text-gray-500 font-medium">
                              {userReward.isFinalLotteryWinner ? '绝地翻盘获胜者' : `第 ${userReward.user.order_number} 名`}
                            </p>
                          </div>
                        </div>

                        {/* 第二行：奖励信息 */}
                        {userReward.reward && (
                          <div className={`flex items-center space-x-3 p-3 rounded-lg border ${
                            userReward.isFinalLotteryWinner
                              ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200'
                              : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-100'
                          }`}>
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm flex-shrink-0">
                              {userReward.isFinalLotteryWinner ? (
                                <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                                  <Zap className="w-5 h-5 text-white" />
                                </div>
                              ) : (
                                <img
                                  src={getRewardImage(userReward.reward, userReward.isFinalLotteryWinner)}
                                  alt={userReward.reward.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800 mb-1">
                                {userReward.reward.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {userReward.reward.description}
                              </p>
                            </div>
                            <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                              userReward.isFinalLotteryWinner
                                ? 'text-red-600 bg-red-100'
                                : 'text-blue-600 bg-blue-100'
                            }`}>
                              {userReward.isFinalLotteryWinner ? '翻盘获胜' : '已选择'}
                            </div>
                          </div>
                        )}

                        {/* 第三行：红包奖励信息 */}
                        {getRedPacketReward(userReward) && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center justify-center space-x-2">
                              <span className="text-lg">🧧</span>
                              <span className="text-sm font-bold text-red-700">
                                额外红包奖励 {getRedPacketReward(userReward)} 元
                              </span>
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