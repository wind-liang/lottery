'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { GameLogic } from '@/lib/game-logic'
import { Crown, Clock, Check } from 'lucide-react'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']
type Reward = Database['public']['Tables']['rewards']['Row']

interface RewardSelectionProps {
  room: Room
  currentUser: User
  users: User[]
  onStageChange: () => void
}

export function RewardSelection({ room, currentUser, users, onStageChange }: RewardSelectionProps) {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [selectedReward, setSelectedReward] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [showConfirm, setShowConfirm] = useState(false)
  
  // 使用 ref 保存最新的 handleRandomSelection 函数
  const handleRandomSelectionRef = useRef<() => Promise<void>>(async () => {})
  
  // 从房间状态获取当前选择者
  const currentSelector = room.current_selector ? users.find(u => u.id === room.current_selector) : null
  const selectionInProgress = !!room.current_selector

  // 获取主持人列表
  const hosts = users
    .filter(user => user.role === 'host' && user.is_online)
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
    .slice(0, 2)

  // 移除了 sortedPlayers 变量，因为现在直接使用 GameLogic.getNextSelector 来获取下一个选择者

  // 移除了 getCurrentSelector 函数，因为现在从房间状态获取当前选择者

  const fetchRewards = useCallback(async () => {
    try {
      const rewardList = await GameLogic.getRewards(room.id)
      setRewards(rewardList)
    } catch (error) {
      console.error('获取奖励列表失败:', error)
    }
  }, [room.id])

  const handleRandomSelection = useCallback(async () => {
    if (!currentSelector) return
    
    const availableRewards = rewards.filter(r => !r.selected_by)
    if (availableRewards.length === 0) return
    
    const randomReward = availableRewards[Math.floor(Math.random() * availableRewards.length)]
    
    try {
      console.log('🎲 [随机选择] 为用户随机选择奖励:', currentSelector.nickname, randomReward.name)
      await GameLogic.selectReward(currentSelector.id, randomReward.id)
      
      // 等待一下确保数据库更新完成
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // 获取下一个选择者（直接从数据库查询最新状态）
      const nextSelector = await GameLogic.getNextSelector(room.id)
      
      await fetchRewards()
      onStageChange()
      
      if (nextSelector) {
        console.log('⏭️ [随机选择] 轮转到下一个用户:', nextSelector.nickname)
        // 更新房间的当前选择者
        await supabase
          .from('rooms')
          .update({ 
            current_selector: nextSelector.id,
            selection_timeout: new Date(Date.now() + 30000).toISOString()
          })
          .eq('id', room.id)
        
        onStageChange()
      } else {
        console.log('🎉 [随机选择] 所有人都选择完毕，进入下一阶段')
        // 所有人都选择完毕，清除当前选择者，进入下一阶段
        await supabase
          .from('rooms')
          .update({ 
            current_selector: null,
            selection_timeout: null
          })
          .eq('id', room.id)
        
        // 进入绝地翻盘阶段
        await GameLogic.updateRoomStage(room.id, 'final_lottery')
        onStageChange()
      }
    } catch (error) {
      console.error('随机选择失败:', error)
    }
  }, [currentSelector?.id, rewards, fetchRewards, onStageChange, room.id])

  // 更新 ref 中的函数引用
  useEffect(() => {
    handleRandomSelectionRef.current = handleRandomSelection
  }, [handleRandomSelection])

  // 加载奖励列表
  useEffect(() => {
    fetchRewards()
  }, [room.id])

  // 倒计时 - 当选择者变化时重置
  useEffect(() => {
    if (selectionInProgress && currentSelector) {
      console.log('🕐 [倒计时] 选择者变化，重置倒计时:', currentSelector.nickname)
      setTimeLeft(30)
      setSelectedReward(null) // 清除选择状态
    } else if (!selectionInProgress) {
      // 如果选择流程结束，也重置倒计时
      console.log('🕐 [倒计时] 选择流程结束，重置倒计时')
      setTimeLeft(30)
      setSelectedReward(null)
    }
  }, [selectionInProgress, currentSelector?.id])

  // 倒计时执行
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    
    if (selectionInProgress && currentSelector && currentSelector.id === currentUser.id) {
      console.log('🕐 [倒计时] 开始倒计时，当前选择者:', currentSelector.nickname)
      
      timer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1
          console.log('🕐 [倒计时] 倒计时更新:', newTime)
          if (newTime <= 0) {
            // 时间到了，随机选择一个奖励
            console.log('⏰ [倒计时] 时间到，随机选择奖励')
            handleRandomSelectionRef.current()
            return 30
          }
          return newTime
        })
      }, 1000)
    } else {
      console.log('🚫 [倒计时] 不满足倒计时条件:', {
        selectionInProgress,
        currentSelector: currentSelector?.nickname,
        isMyTurn: currentSelector?.id === currentUser.id
      })
    }

    return () => {
      if (timer) {
        console.log('🧹 [倒计时] 清理定时器')
        clearInterval(timer)
      }
    }
  }, [selectionInProgress, currentSelector?.id, currentUser.id])



  const handleRewardSelect = (rewardId: string) => {
    console.log('🎯 [奖励选择] 点击奖励:', rewardId)
    console.log('🎯 [奖励选择] 当前选择者:', currentSelector?.nickname)
    console.log('🎯 [奖励选择] 当前用户:', currentUser.nickname)
    console.log('🎯 [奖励选择] 是否我的回合:', currentSelector?.id === currentUser.id)
    
    if (currentSelector?.id !== currentUser.id) {
      console.log('🚫 [奖励选择] 不是你的回合')
      return
    }
    
    const selectedRewardData = rewards.find(r => r.id === rewardId)
    if (selectedRewardData?.selected_by) {
      console.log('🚫 [奖励选择] 奖励已被选择:', selectedRewardData.selected_by)
      return
    }
    
    console.log('✅ [奖励选择] 选择奖励成功:', rewardId)
    setSelectedReward(rewardId)
  }

  const handleConfirmSelection = () => {
    console.log('🔄 [确认选择] 显示确认弹窗，选中的奖励:', selectedReward)
    if (!selectedReward) {
      console.error('🔄 [确认选择] 没有选中的奖励')
      return
    }
    setShowConfirm(true)
    console.log('🔄 [确认选择] 确认弹窗已显示')
  }

  const handleConfirmYes = async () => {
    console.log('🎯 [确认按钮] 点击确认按钮')
    
    if (!selectedReward || !currentSelector) {
      console.error('🎯 [确认按钮] 缺少必要参数:', {
        selectedReward,
        currentSelector: currentSelector?.nickname || 'null'
      })
      return
    }
    
    try {
      console.log('🔄 [奖励选择] 开始选择流程:', {
        currentSelector: currentSelector.nickname,
        selectedReward,
        currentSelectorId: currentSelector.id
      })
      
      const success = await GameLogic.selectReward(currentSelector.id, selectedReward)
      if (success) {
        console.log('✅ [奖励选择] 用户选择成功:', currentSelector.nickname)
        setShowConfirm(false)
        setSelectedReward(null)
        
        // 等待一下确保数据库更新完成
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // 获取下一个选择者（直接从数据库查询最新状态）
        console.log('🔍 [奖励选择] 查找下一个选择者...')
        const nextSelector = await GameLogic.getNextSelector(room.id)
        
        // 刷新奖励列表和用户列表
        await fetchRewards()
        onStageChange()
        
        console.log('🔍 [奖励选择] 查找结果:', nextSelector ? {
          id: nextSelector.id,
          nickname: nextSelector.nickname,
          orderNumber: nextSelector.order_number,
          selectedReward: nextSelector.selected_reward
        } : '没有找到下一个选择者')
        
        if (nextSelector) {
          console.log('⏭️ [奖励选择] 轮转到下一个用户:', nextSelector.nickname, 'Order:', nextSelector.order_number)
          // 更新房间的当前选择者
          const { error } = await supabase
            .from('rooms')
            .update({ 
              current_selector: nextSelector.id,
              selection_timeout: new Date(Date.now() + 30000).toISOString()
            })
            .eq('id', room.id)
          
          if (error) {
            console.error('❌ [奖励选择] 更新房间选择者失败:', error)
          } else {
            console.log('✅ [奖励选择] 房间选择者更新成功')
          }
          
          onStageChange()
        } else {
          console.log('🎉 [奖励选择] 所有人都选择完毕，进入下一阶段')
          
          // 验证所有玩家的选择状态
          const { data: allPlayers } = await supabase
            .from('users')
            .select('id, nickname, order_number, selected_reward')
            .eq('room_id', room.id)
            .eq('role', 'player')
            .not('order_number', 'is', null)
            .order('order_number', { ascending: true })
          
          console.log('🔍 [奖励选择] 所有玩家状态:', allPlayers?.map(p => ({
            nickname: p.nickname,
            order: p.order_number,
            hasSelected: !!p.selected_reward,
            selectedReward: p.selected_reward
          })))
          
          // 所有人都选择完毕，清除当前选择者，进入下一阶段
          await supabase
            .from('rooms')
            .update({ 
              current_selector: null,
              selection_timeout: null
            })
            .eq('id', room.id)
          
          // 进入绝地翻盘阶段
          await GameLogic.updateRoomStage(room.id, 'final_lottery')
          onStageChange()
        }
      } else {
        console.error('❌ [奖励选择] 选择奖励失败')
        alert('选择奖励失败，请重试')
      }
    } catch (error) {
      console.error('确认选择失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`确认选择失败: ${errorMessage}`)
    } finally {
      console.log('🏁 [奖励选择] 选择流程结束')
    }
  }



  const getRewardImage = (reward: Reward) => {
    return reward.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${reward.id}`
  }

  const isMyTurn = currentSelector?.id === currentUser.id
  const canSelectReward = isMyTurn && selectionInProgress

  return (
    <div className="space-y-6">
      {/* 主持人头像 - 左上角纵向排列 */}
      <div className="absolute top-4 left-4 space-y-2">
        {hosts.map((host, index) => (
          <motion.div
            key={host.id}
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            <div className="w-12 h-12 rounded-full border-3 border-yellow-400 shadow-lg">
              <img
                src={host.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${host.id}`}
                alt={host.nickname}
                className="w-full h-full object-cover rounded-full"
              />
              <div className="absolute -top-1 -right-1 bg-white rounded-full p-1">
                <Crown className="w-3 h-3 text-yellow-400" />
              </div>
            </div>
            <p className="text-xs text-center text-white mt-1 max-w-16 truncate">
              {host.nickname}
            </p>
          </motion.div>
        ))}
      </div>



      {/* 当前选择者信息 - 只在选择流程开始后显示 */}
      {selectionInProgress && currentSelector && (
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            {/* 左侧显示当前选择者头像 - 根据PRD要求 */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full border-2 border-blue-400">
                <img
                  src={currentSelector.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentSelector.id}`}
                  alt={currentSelector.nickname}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <p className="text-white font-medium">
                  {isMyTurn ? '轮到你选择了' : `${currentSelector.nickname} 正在选择`}
                </p>
                <p className="text-white/70 text-sm">
                  第 {currentSelector.order_number} 名
                </p>
              </div>
            </div>
            
            {isMyTurn && (
              <div className="flex items-center space-x-2 text-white">
                <Clock className="w-4 h-4" />
                <span className="font-bold text-lg">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 奖励列表 - 只有在选择流程开始后才显示 */}
      {selectionInProgress ? (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white text-center">奖励选择</h3>
          
          {/* 横向滚动的奖励列表 */}
          <div className="overflow-x-auto pb-4">
            <div className="flex space-x-4 min-w-max">
              {rewards.map((reward) => (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`
                    bg-white/10 backdrop-blur-sm rounded-2xl p-4 border-2 transition-all duration-300 flex-shrink-0 w-48
                    ${selectedReward === reward.id ? 'border-blue-400 bg-blue-400/20' : 'border-white/20'}
                    ${reward.selected_by ? 'opacity-50' : ''}
                    ${canSelectReward && !reward.selected_by ? 'cursor-pointer hover:border-blue-300' : ''}
                  `}
                  onClick={() => handleRewardSelect(reward.id)}
                >
                  <div className="flex flex-col items-center space-y-3">
                    {/* 奖励图片 */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/20">
                      <img
                        src={getRewardImage(reward)}
                        alt={reward.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* 奖励信息 */}
                    <div className="text-center">
                      <h4 className="text-white font-medium text-sm">{reward.name}</h4>
                      <p className="text-white/70 text-xs mt-1">{reward.description}</p>
                    </div>
                    
                    {/* 选择状态 */}
                    <div className="flex items-center justify-center">
                      {reward.selected_by ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full border-2 border-green-400 bg-green-400/20">
                            <img
                              src={users.find(u => u.id === reward.selected_by)?.avatar_url || ''}
                              alt=""
                              className="w-full h-full object-cover rounded-full"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* 单选框 - 仅玩家可见 */}
                          {currentUser.role === 'player' && (
                            <div className={`
                              w-6 h-6 rounded-full border-2 border-white/50 flex items-center justify-center
                              ${selectedReward === reward.id ? 'bg-blue-400 border-blue-400' : ''}
                            `}>
                              {selectedReward === reward.id && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* 等待主持人开始选择的状态 - 保持抽奖箱UI */
        <div className="flex justify-center mb-8">
          <motion.div
            className="relative w-32 h-32 z-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* 箱子主体 */}
            <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl border-4 border-yellow-300 shadow-lg relative overflow-visible">
              {/* 箱子装饰 */}
              <div className="absolute inset-2 border-2 border-yellow-200 rounded-lg"></div>
              
              {/* 礼物图标 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
            </div>

            {/* 箱子盖子 */}
            <div className="absolute -top-2 left-2 right-2 h-4 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-t-xl border-2 border-yellow-200" />
          </motion.div>
        </div>
      )}

      {/* 控制按钮 - 只显示玩家选择时的确认按钮 */}
      {isMyTurn && selectedReward && (
        <div className="space-y-3">
          <button
            onClick={() => {
              console.log('🖱️ [确认选择按钮] 被点击')
              handleConfirmSelection()
            }}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-lg font-medium hover:from-blue-500 hover:to-blue-700"
          >
            确认选择
          </button>
        </div>
      )}

      {/* 确认弹窗 */}
      <AnimatePresence>
        {showConfirm && selectedReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full"
            >
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  确认选择奖励
                </h3>
                
                {(() => {
                  const reward = rewards.find(r => r.id === selectedReward)
                  return reward ? (
                    <div className="space-y-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 mx-auto">
                        <img
                          src={getRewardImage(reward)}
                          alt={reward.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800">{reward.name}</h4>
                        <p className="text-gray-600 text-sm">{reward.description}</p>
                      </div>
                    </div>
                  ) : null
                })()}
                
                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => {
                      console.log('🖱️ [确认弹窗] 取消按钮被点击')
                      setShowConfirm(false)
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                  >
                    取消
                  </button>
                  <button
                    onClick={(e) => {
                      console.log('🖱️ [确认弹窗] 确认按钮被点击')
                      e.preventDefault()
                      e.stopPropagation()
                      handleConfirmYes()
                    }}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    确认
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 