'use client'

import React, { useState, useEffect } from 'react'
import { Play, X } from 'lucide-react'
import { GameLogic } from '../lib/game-logic'
import { addRealtimeNotification } from './realtime-notifications'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface GameControlsProps {
  room: Room
  currentUser: User
  users: User[]
  onStageChange: () => void
  onWinnerDrawn?: (winner: { userId: string; nickname: string; orderNumber: number; avatar?: string }) => void
}

interface ConfirmModalProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({ title, message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[54] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="flex space-x-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

export function GameControls({ room, currentUser, users, onStageChange, onWinnerDrawn }: GameControlsProps) {
  const [showConfirmModal, setShowConfirmModal] = useState<{
    title: string
    message: string
    action: () => void
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [allRewardSelectionComplete, setAllRewardSelectionComplete] = useState(false)
  const [lotteryStatus, setLotteryStatus] = useState<'idle' | 'drawing' | 'processing'>('idle')

  const isHost = currentUser.role === 'host'

  // 心跳检测 - 定期检查锁定状态并自动恢复
  useEffect(() => {
    if (!isHost) return

    let heartbeatTimer: NodeJS.Timeout | null = null
    
    const checkLockStatus = async () => {
      try {
        const recovered = await GameLogic.checkAndRecoverLockStatus(room.id)
        if (!recovered) {
          console.log('🔄 [心跳检测] 检测到异常锁定并自动恢复')
          // 触发UI更新
          onStageChange()
        }
      } catch (error) {
        console.error('心跳检测失败:', error)
      }
    }

    // 只在可能出现锁定的阶段进行心跳检测
    if (room.stage === 'waiting' || room.stage === 'lottery') {
      // 每5秒检查一次锁定状态
      heartbeatTimer = setInterval(checkLockStatus, 5000)
    }

    return () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
      }
    }
  }, [isHost, room.id, room.stage, onStageChange])

  // 检查所有人是否选择完毕 - 优化检查逻辑，减少频繁查询
  useEffect(() => {
    let checkTimer: NodeJS.Timeout | null = null
    
    const checkRewardSelectionComplete = async () => {
      if (room.stage === 'reward_selection') {
        try {
          const isComplete = await GameLogic.areAllRewardSelectionComplete(room.id)
          console.log('🔍 [GameControls] 奖励选择完成状态检查:', isComplete)
          setAllRewardSelectionComplete(isComplete)
        } catch (error) {
          console.error('检查奖励选择完成状态失败:', error)
        }
      } else {
        setAllRewardSelectionComplete(false)
      }
    }

    // 使用防抖机制，避免频繁检查
    checkTimer = setTimeout(() => {
      checkRewardSelectionComplete()
    }, 500) // 减少到500ms防抖，提高响应速度

    return () => {
      if (checkTimer) {
        clearTimeout(checkTimer)
      }
    }
  }, [
    room.stage, 
    room.id, 
    // 优化依赖项：只关注有选择权的玩家数量和已选择奖励的玩家数量，避免其他状态变化
    users.filter(u => u.role === 'player' && u.order_number != null).length,
    users.filter(u => u.role === 'player' && u.order_number != null && u.selected_reward != null).length
  ])

  const handleStartLottery = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    setLotteryStatus('drawing')
    
    try {
      // 检查是否可以开始抽奖
      const canStart = await GameLogic.canStartLottery(room.id)
      if (!canStart) {
        // 尝试自动恢复锁定状态
        const recovered = await GameLogic.checkAndRecoverLockStatus(room.id)
        if (!recovered) {
          // 发生了自动恢复，重新检查是否可以开始
          const canStartAfterRecovery = await GameLogic.canStartLottery(room.id)
          if (!canStartAfterRecovery) {
            alert('当前无法开始抽奖，请稍后重试')
            return
          }
        } else {
          alert('当前无法开始抽奖')
          return
        }
      }

      console.log('🎯 [抽奖] 开始锁定抽奖，等待抽奖完成')
      
      // 使用带超时保护的锁定方法（防止异常情况）
      const lockResult = await GameLogic.setLotteryLockedWithTimeout(room.id, 10000) // 10秒超时保护
      if (!lockResult) {
        alert('抽奖锁定失败，请重试')
        return
      }
      
      // 抽取一个参与者
      const drawnUser = await GameLogic.drawRandomParticipant(room.id)
      if (!drawnUser) {
        alert('没有参与者可以抽取')
        // 立即解锁，因为没有进行实际抽奖
        await GameLogic.setLotteryLocked(room.id, false)
        return
      }

      console.log('🎯 [抽奖] 抽中用户:', drawnUser.nickname, '排名:', drawnUser.order_number)

      // 触发获奖通知
      if (onWinnerDrawn && drawnUser.order_number) {
        onWinnerDrawn({
          userId: drawnUser.id,
          nickname: drawnUser.nickname,
          orderNumber: drawnUser.order_number,
          avatar: drawnUser.avatar_url || undefined
        })
      }

      // 抽奖主要逻辑完成，切换到处理状态
      console.log('✅ [抽奖] 抽奖主要流程完成，开始后续处理')
      setLotteryStatus('processing')
      setIsLoading(false)
      
      // 后续数据处理异步进行
      console.log('🔄 [抽奖] 开始后续数据处理...')
      
      try {
        // 检查是否所有参与者都已被抽中
        const allDrawn = await GameLogic.areAllParticipantsDrawn(room.id)
        if (allDrawn) {
          console.log('🎉 [抽奖] 所有人都被抽中，更新到奖励选择阶段')
          // 更新到奖励选择阶段
          await GameLogic.updateRoomStage(room.id, 'reward_selection')
        }

        // 抽奖完成后解锁
        console.log('✅ [抽奖] 数据处理完成，解锁抽奖')
        await GameLogic.setLotteryLocked(room.id, false)

        onStageChange()
      } catch (postProcessError) {
        console.error('抽奖后续处理失败:', postProcessError)
        // 即使后续处理失败，也要确保解锁
        await GameLogic.forceUnlock(room.id)
        onStageChange()
      } finally {
        // 完成所有处理后重置状态
        setLotteryStatus('idle')
      }
      
    } catch (error) {
      console.error('抽奖失败:', error)
      
      // 确定错误类型并提供相应的用户反馈
      let errorMessage = '抽奖失败，请重试'
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = '网络连接异常，请检查网络后重试'
        } else if (error.message.includes('timeout')) {
          errorMessage = '操作超时，请稍后重试'
        } else if (error.message.includes('locked')) {
          errorMessage = '抽奖正在进行中，请等待'
        }
      }
      
      alert(errorMessage)
      
      // 如果出现错误，强制解锁抽奖
      console.log('❌ [抽奖] 出现错误，强制解锁抽奖')
      await GameLogic.forceUnlock(room.id)
      
      // 触发UI更新
      onStageChange()
      
      // 错误情况下重置所有状态
      setIsLoading(false)
      setLotteryStatus('idle')
    }
    // 移除finally块，因为我们已经在成功和失败情况下分别处理了isLoading状态
  }

  const handleResetGame = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    try {
      const resetSuccess = await GameLogic.resetGame(room.id)
      
      if (resetSuccess) {
        // 显示成功提示
        addRealtimeNotification({
          type: 'game_reset',
          message: '🎮 游戏已成功重置，所有数据已清除，可以重新开始游戏'
        })
        
        onStageChange()
      } else {
        // 虽然没有抛出异常，但重置失败
        addRealtimeNotification({
          type: 'game_reset_failed',
          message: '⚠️ 游戏重置失败，请重试'
        })
      }
    } catch (error) {
      console.error('重置游戏失败:', error)
      addRealtimeNotification({
        type: 'game_reset_failed',
        message: '❌ 游戏重置失败，请重试'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmergencyUnlock = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    try {
      console.log('🚨 [紧急解锁] 主持人手动强制解锁抽奖')
      
      // 使用新的强制解锁方法
      const success = await GameLogic.forceUnlock(room.id)
      
      if (success) {
        console.log('✅ [紧急解锁] 强制解锁成功')
        onStageChange()
        alert('抽奖已成功解锁！')
      } else {
        console.error('❌ [紧急解锁] 强制解锁失败')
        alert('解锁失败，请刷新页面后重试')
      }
    } catch (error) {
      console.error('紧急解锁失败:', error)
      alert('解锁失败，请刷新页面后重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartRewardSelection = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    try {
      // 开始奖励选择流程
      const success = await GameLogic.startRewardSelection(room.id)
      if (success) {
        onStageChange()
      } else {
        alert('开始奖励选择失败，请检查是否有玩家参与')
      }
    } catch (error) {
      console.error('开始奖励选择失败:', error)
      alert('开始奖励选择失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartFinalLottery = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    try {
      console.log('🎯 [handleStartFinalLottery] 开始设置绝地翻盘抽奖箱')
      
      // 设置绝地翻盘抽奖箱
      const success = await GameLogic.setupFinalLotteryBox(room.id)
      if (!success) {
        console.error('🎯 [handleStartFinalLottery] 设置绝地翻盘抽奖箱失败，开始诊断...')
        // 调用诊断函数
        await GameLogic.diagnoseFinalLotteryIssue(room.id)
        alert('无法开始绝地翻盘：没有找到有排名的玩家参与。请确保已完成第一轮抽奖并且玩家有排名。')
        return
      }
      
      console.log('🎯 [handleStartFinalLottery] 绝地翻盘抽奖箱设置成功，更新房间阶段')
      await GameLogic.updateRoomStage(room.id, 'final_lottery')
      onStageChange()
    } catch (error) {
      console.error('开始绝地翻盘失败:', error)
      alert('开始绝地翻盘失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinalLotteryDraw = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    try {
      console.log('🎯 [handleFinalLotteryDraw] 开始绝地翻盘抽奖')
      
      // 抽取绝地翻盘获胜者
      const winner = await GameLogic.drawFinalLotteryWinner(room.id)
      if (!winner) {
        console.error('🎯 [handleFinalLotteryDraw] 绝地翻盘抽奖失败，开始诊断...')
        // 调用诊断函数
        await GameLogic.diagnoseFinalLotteryIssue(room.id)
        alert('绝地翻盘抽奖失败：没有找到参与者。请检查抽奖箱是否正确设置。')
        return
      }

      console.log('🎯 [绝地翻盘] 抽中用户:', winner.nickname)
      console.log('🎯 [绝地翻盘] 主持人客户端触发获奖通知')

      // 主持人端立即触发获奖通知
      if (onWinnerDrawn) {
        console.log('🎯 [绝地翻盘] 调用 onWinnerDrawn 回调')
        onWinnerDrawn({
          userId: winner.id,
          nickname: winner.nickname,
          orderNumber: 0, // 绝地翻盘获胜者特殊标识
          avatar: winner.avatar_url || undefined
        })
      } else {
        console.error('🎯 [绝地翻盘] onWinnerDrawn 回调不存在')
      }

      // 等待5秒后进入完结阶段
      setTimeout(async () => {
        await GameLogic.updateRoomStage(room.id, 'finished')
        onStageChange()
      }, 5000)

      onStageChange()
    } catch (error) {
      console.error('❌ [绝地翻盘] 抽奖失败:', error)
      alert('绝地翻盘抽奖失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }



  const confirmAction = (title: string, message: string, action: () => void) => {
    setShowConfirmModal({ title, message, action })
  }

  const executeAction = () => {
    if (showConfirmModal) {
      showConfirmModal.action()
      setShowConfirmModal(null)
    }
  }

  const getPlayerCount = () => {
    return users.filter(user => user.role === 'player').length
  }

  const getAudienceCount = () => {
    return users.filter(user => user.role === 'audience').length
  }

  if (!isHost) {
    return (
      <div className="text-center">
        <p className="text-gray-600 text-sm">等待主持人操作...</p>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-4 border border-gray-300/50">
        <h3 className="text-gray-800 font-medium mb-4 text-center">游戏控制</h3>
        
        <div className="space-y-3">
          {/* 等待阶段 */}
          {room.stage === 'waiting' && (
            <div className="space-y-2">
              <p className="text-gray-700 text-sm text-center">
                当前玩家: {getPlayerCount()} 人
              </p>
              <p className="text-gray-700 text-sm text-center">
                观众人数: {getAudienceCount()} 人
              </p>
              <button
                onClick={() => confirmAction(
                  '开始抽奖',
                  '确定要开始抽奖吗？开始后玩家将无法再参与抽奖。',
                  handleStartLottery
                )}
                disabled={isLoading || room.is_lottery_locked}
                className="w-full px-4 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg font-medium hover:from-yellow-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>
                  {isLoading ? '抽奖中...' : 
                   room.is_lottery_locked ? 
                     (lotteryStatus === 'processing' ? '处理中...' : '抽奖中...') : 
                     '开始抽奖'}
                </span>
              </button>
              
              {/* 紧急解锁按钮 */}
              {room.is_lottery_locked && (
                <button
                  onClick={() => confirmAction(
                    '紧急解锁',
                    '确定要强制解锁抽奖吗？这将立即解除锁定状态。',
                    handleEmergencyUnlock
                  )}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 text-sm flex items-center justify-center space-x-2"
                >
                  <span>🚨</span>
                  <span>
                    {isLoading ? '解锁中...' : '紧急解锁'}
                  </span>
                </button>
              )}
              
              {/* 锁定状态提示 */}
              {room.is_lottery_locked && (
                <div className="text-center text-sm text-gray-600 bg-yellow-50 px-3 py-2 rounded-lg">
                  <span>
                    {lotteryStatus === 'drawing' && '正在抽奖中，请稍候...'}
                    {lotteryStatus === 'processing' && '抽奖完成，正在处理数据...'}
                    {lotteryStatus === 'idle' && '抽奖锁定中，请等待抽奖完成'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 抽奖阶段 */}
          {room.stage === 'lottery' && (
            <div className="space-y-2">
              <button
                onClick={() => confirmAction(
                  '继续抽奖',
                  '确定要继续抽奖吗？',
                  handleStartLottery
                )}
                disabled={isLoading || room.is_lottery_locked}
                className="w-full px-4 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg font-medium hover:from-yellow-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>
                  {isLoading ? '抽奖中...' : 
                   room.is_lottery_locked ? 
                     (lotteryStatus === 'processing' ? '处理中...' : '抽奖中...') : 
                     '继续抽奖'}
                </span>
              </button>
              
              {/* 紧急解锁按钮 */}
              {room.is_lottery_locked && (
                <button
                  onClick={() => confirmAction(
                    '紧急解锁',
                    '确定要强制解锁抽奖吗？这将立即解除锁定状态。',
                    handleEmergencyUnlock
                  )}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 text-sm flex items-center justify-center space-x-2"
                >
                  <span>🚨</span>
                  <span>
                    {isLoading ? '解锁中...' : '紧急解锁'}
                  </span>
                </button>
              )}
              
              {/* 锁定状态提示 */}
              {room.is_lottery_locked && (
                <div className="text-center text-sm text-gray-600 bg-yellow-50 px-3 py-2 rounded-lg">
                  <span>
                    {lotteryStatus === 'drawing' && '正在抽奖中，请稍候...'}
                    {lotteryStatus === 'processing' && '抽奖完成，正在处理数据...'}
                    {lotteryStatus === 'idle' && '抽奖锁定中，请等待抽奖完成'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 奖励选择阶段 */}
          {room.stage === 'reward_selection' && (
            <div className="space-y-2">
              {/* 只有当所有人都没有选择完毕时才显示"开始奖励选择"按钮 */}
              {!allRewardSelectionComplete && !room.current_selector && (
                <button
                  onClick={() => confirmAction(
                    '开始奖励选择',
                    '确定要开始奖励选择流程吗？',
                    handleStartRewardSelection
                  )}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-400 to-green-600 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-700 disabled:opacity-50"
                >
                  {isLoading ? '处理中...' : '开始奖励选择'}
                </button>
              )}
              
              {/* 显示当前选择进度 */}
              {room.current_selector && (
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-blue-800 text-sm font-medium">
                    奖励选择进行中...
                  </p>
                  <p className="text-blue-600 text-xs mt-1">
                    {(() => {
                      const playersWithOrder = users.filter(u => u.role === 'player' && u.order_number != null)
                      const playersWithReward = playersWithOrder.filter(u => u.selected_reward != null)
                      return `${playersWithReward.length}/${playersWithOrder.length} 人已选择`
                    })()}
                  </p>
                </div>
              )}
              
              {/* 当所有人选择完毕时显示不同的状态 */}
              {allRewardSelectionComplete && (
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-green-800 text-sm font-medium">
                    ✅ 所有人已选择完毕
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    可以进入绝地翻盘阶段
                  </p>
                </div>
              )}
              
              <button
                onClick={() => confirmAction(
                  '进入绝地翻盘',
                  '确定要进入绝地翻盘阶段吗？',
                  handleStartFinalLottery
                )}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-gradient-to-r from-red-400 to-red-600 text-white rounded-lg font-medium hover:from-red-500 hover:to-red-700 disabled:opacity-50"
              >
                {isLoading ? '处理中...' : '进入绝地翻盘'}
              </button>
            </div>
          )}

          {/* 绝地翻盘阶段 */}
          {room.stage === 'final_lottery' && (
            <div className="space-y-2">
              <button
                onClick={() => confirmAction(
                  '抽取绝地翻盘奖',
                  '确定要抽取绝地翻盘奖吗？',
                  handleFinalLotteryDraw
                )}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gradient-to-r from-red-400 to-red-600 text-white rounded-lg font-medium hover:from-red-500 hover:to-red-700 disabled:opacity-50"
              >
                {isLoading ? '抽奖中...' : '抽取绝地翻盘奖'}
              </button>
              

            </div>
          )}

          {/* 重置游戏按钮 */}
          <button
            onClick={() => confirmAction(
              '重置游戏',
              '确定要重置游戏吗？这将清除所有抽奖数据、用户排名和奖励选择，游戏将回到等待阶段。',
              handleResetGame
            )}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 disabled:opacity-50"
          >
            {isLoading ? '重置中...' : '重置游戏'}
          </button>


        </div>
      </div>

      {/* 确认弹窗 */}
      {showConfirmModal && (
        <ConfirmModal
          title={showConfirmModal.title}
          message={showConfirmModal.message}
          onConfirm={executeAction}
          onCancel={() => setShowConfirmModal(null)}
        />
      )}
    </div>
  )
} 