'use client'

import { useState } from 'react'
import { Play, RotateCcw, X } from 'lucide-react'
import { GameLogic } from '@/lib/game-logic'
import { supabase } from '@/lib/supabase'
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

  const isHost = currentUser.role === 'host'

  const handleStartLottery = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    let lockTimer: NodeJS.Timeout | null = null
    
    try {
      // 检查是否可以开始抽奖
      const canStart = await GameLogic.canStartLottery(room.id)
      if (!canStart) {
        alert('当前无法开始抽奖')
        return
      }

      console.log('🎯 [抽奖] 开始锁定抽奖3秒')
      // 锁定抽奖3秒
      await GameLogic.setLotteryLocked(room.id, true)
      
      // 设置3秒后解锁抽奖的定时器
      lockTimer = setTimeout(async () => {
        console.log('⏰ [抽奖] 3秒锁定时间到，解锁抽奖')
        await GameLogic.setLotteryLocked(room.id, false)
      }, 3000)
      
      // 抽取一个参与者
      const drawnUser = await GameLogic.drawRandomParticipant(room.id)
      if (!drawnUser) {
        alert('没有参与者可以抽取')
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

      // 检查是否所有参与者都已被抽中
      const allDrawn = await GameLogic.areAllParticipantsDrawn(room.id)
      if (allDrawn) {
        // 更新到奖励选择阶段
        await GameLogic.updateRoomStage(room.id, 'reward_selection')
      }

      onStageChange()
    } catch (error) {
      console.error('抽奖失败:', error)
      alert('抽奖失败，请重试')
      
      // 如果出现错误，立即解锁抽奖
      console.log('❌ [抽奖] 出现错误，立即解锁抽奖')
      await GameLogic.setLotteryLocked(room.id, false)
      
      // 清除定时器，避免重复解锁
      if (lockTimer) {
        clearTimeout(lockTimer)
        lockTimer = null
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetGame = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    try {
      await GameLogic.resetGame(room.id)
      onStageChange()
    } catch (error) {
      console.error('重置游戏失败:', error)
      alert('重置游戏失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmergencyUnlock = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    try {
      console.log('🚨 [紧急解锁] 主持人手动解锁抽奖')
      await GameLogic.setLotteryLocked(room.id, false)
      onStageChange()
      alert('抽奖已解锁')
    } catch (error) {
      console.error('紧急解锁失败:', error)
      alert('紧急解锁失败，请重试')
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

      // 触发获奖通知（绝地翻盘获胜者不需要order_number）
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

      // 手动广播机制：向用户表添加一个临时字段来触发所有客户端的实时监听
      console.log('🎯 [绝地翻盘] 启动手动广播机制...')
      try {
        // 更新获奖者的一个字段来触发实时监听（所有客户端都在监听用户表）
        await supabase
          .from('users')
          .update({ 
            current_emoji: '🏆', // 临时设置一个表情
            emoji_expires_at: new Date(Date.now() + 1000).toISOString() // 1秒后过期
          })
          .eq('id', winner.id)
        
        console.log('🎯 [绝地翻盘] 手动广播成功')
      } catch (broadcastError) {
        console.error('🎯 [绝地翻盘] 手动广播失败:', broadcastError)
      }

      // 等待一下确保数据库更新和实时监听有时间处理
      console.log('🎯 [绝地翻盘] 等待实时监听处理...')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 等待5秒后进入完结阶段
      setTimeout(async () => {
        await GameLogic.updateRoomStage(room.id, 'finished')
        onStageChange()
      }, 5000)

      onStageChange()
    } catch (error) {
      console.error('绝地翻盘抽奖失败:', error)
      alert('绝地翻盘抽奖失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  // 测试实时监听的函数
  const handleTestRealtimeListener = async () => {
    if (!isHost) return
    
    console.log('🧪 [测试] 开始测试实时监听')
    
    try {
      // 先查找任何绝地翻盘参与者（不论是否已被抽中）
      const { data: participant } = await supabase
        .from('final_lottery_participants')
        .select('*')
        .eq('room_id', room.id)
        .limit(1)
        .single()
      
      if (!participant) {
        alert('没有找到绝地翻盘参与者进行测试')
        return
      }
      
      console.log('🧪 [测试] 找到测试参与者:', participant)
      
      // 先重置状态（设为未抽中）
      console.log('🧪 [测试] 重置参与者状态...')
      await supabase
        .from('final_lottery_participants')
        .update({ is_drawn: false, drawn_at: null })
        .eq('id', participant.id)
      
      // 等待一下确保数据库更新完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 然后设置为已抽中，触发实时监听
      console.log('🧪 [测试] 触发实时监听...')
      const { error } = await supabase
        .from('final_lottery_participants')
        .update({ is_drawn: true, drawn_at: new Date().toISOString() })
        .eq('id', participant.id)
      
      if (error) {
        console.error('🧪 [测试] 更新失败:', error)
        alert('测试更新失败')
        return
      }
      
      console.log('🧪 [测试] 数据库更新成功，等待实时监听响应...')
      
    } catch (error) {
      console.error('🧪 [测试] 测试失败:', error)
      alert('测试失败: ' + String(error))
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
        <p className="text-white/70 text-sm">等待主持人操作...</p>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
        <h3 className="text-white font-medium mb-4 text-center">游戏控制</h3>
        
        <div className="space-y-3">
          {/* 等待阶段 */}
          {room.stage === 'waiting' && (
            <div className="space-y-2">
              <p className="text-white/80 text-sm text-center">
                当前玩家: {getPlayerCount()} 人
              </p>
              <p className="text-white/80 text-sm text-center">
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
                <span>{isLoading ? '抽奖中...' : room.is_lottery_locked ? '抽奖锁定中...' : '开始抽奖'}</span>
              </button>
              
              {/* 紧急解锁按钮 */}
              {room.is_lottery_locked && (
                <button
                  onClick={() => confirmAction(
                    '紧急解锁',
                    '确定要强制解锁抽奖吗？',
                    handleEmergencyUnlock
                  )}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 text-sm"
                >
                  🚨 紧急解锁
                </button>
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
                <span>{isLoading ? '抽奖中...' : room.is_lottery_locked ? '抽奖锁定中...' : '继续抽奖'}</span>
              </button>
              
              {/* 紧急解锁按钮 */}
              {room.is_lottery_locked && (
                <button
                  onClick={() => confirmAction(
                    '紧急解锁',
                    '确定要强制解锁抽奖吗？',
                    handleEmergencyUnlock
                  )}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 text-sm"
                >
                  🚨 紧急解锁
                </button>
              )}
              
              <button
                onClick={() => confirmAction(
                  '开始选择奖励',
                  '确定要开始奖励选择阶段吗？',
                  handleStartRewardSelection
                )}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-gradient-to-r from-green-400 to-green-600 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-700 disabled:opacity-50"
              >
                {isLoading ? '处理中...' : '开始选择奖励'}
              </button>
            </div>
          )}

          {/* 奖励选择阶段 */}
          {room.stage === 'reward_selection' && (
            <div className="space-y-2">
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
              
              {/* 测试实时监听按钮 */}
              <button
                onClick={handleTestRealtimeListener}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 text-sm flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-3 h-3" />
                <span>🧪 测试实时监听</span>
              </button>
            </div>
          )}

          {/* 重置游戏按钮 */}
          <button
            onClick={() => confirmAction(
              '重置游戏',
              '确定要重置游戏吗？所有数据将被清除。',
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