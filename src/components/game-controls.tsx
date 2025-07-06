'use client'

import { useState } from 'react'
import { Play, RotateCcw, X } from 'lucide-react'
import { GameLogic } from '@/lib/game-logic'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface GameControlsProps {
  room: Room
  currentUser: User
  users: User[]
  onStageChange: () => void
}

interface ConfirmModalProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({ title, message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
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

export function GameControls({ room, currentUser, users, onStageChange }: GameControlsProps) {
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
    try {
      // 检查是否可以开始抽奖
      const canStart = await GameLogic.canStartLottery(room.id)
      if (!canStart) {
        alert('当前无法开始抽奖')
        return
      }

      // 锁定抽奖3秒
      await GameLogic.setLotteryLocked(room.id, true)
      
      // 抽取一个参与者
      const drawnUser = await GameLogic.drawRandomParticipant(room.id)
      if (!drawnUser) {
        alert('没有参与者可以抽取')
        return
      }

      // 检查是否所有参与者都已被抽中
      const allDrawn = await GameLogic.areAllParticipantsDrawn(room.id)
      if (allDrawn) {
        // 更新到奖励选择阶段
        await GameLogic.updateRoomStage(room.id, 'reward_selection')
      }

      // 3秒后解锁抽奖
      setTimeout(async () => {
        await GameLogic.setLotteryLocked(room.id, false)
      }, 3000)

      onStageChange()
    } catch (error) {
      console.error('抽奖失败:', error)
      alert('抽奖失败，请重试')
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

  const handleStartRewardSelection = async () => {
    if (!isHost) return
    
    setIsLoading(true)
    try {
      await GameLogic.updateRoomStage(room.id, 'reward_selection')
      onStageChange()
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
      await GameLogic.updateRoomStage(room.id, 'final_lottery')
      onStageChange()
    } catch (error) {
      console.error('开始绝地翻盘失败:', error)
      alert('开始绝地翻盘失败，请重试')
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

  const getParticipantCount = () => {
    // 这里应该从抽奖参与者表中获取，暂时用玩家数量代替
    return getPlayerCount()
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
                参与抽奖: {getParticipantCount()} 人
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
              
              <button
                onClick={() => confirmAction(
                  '开始选择奖励',
                  '确定要开始奖励选择阶段吗？',
                  handleStartRewardSelection
                )}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50"
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
                  '开始绝地翻盘',
                  '确定要开始绝地翻盘阶段吗？',
                  handleStartFinalLottery
                )}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gradient-to-r from-red-400 to-red-600 text-white rounded-lg font-medium hover:from-red-500 hover:to-red-700 disabled:opacity-50"
              >
                {isLoading ? '处理中...' : '开始绝地翻盘'}
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
                  handleStartLottery
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
              '确定要重置游戏吗？所有数据将被清除，这个操作不可撤销。',
              handleResetGame
            )}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isLoading ? '重置中...' : '重置游戏'}</span>
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