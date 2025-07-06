'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface LotteryBoxProps {
  roomId: string
  stage: Room['stage']
  currentUser: User
  users: User[]
}

export function LotteryBox({ roomId, stage, currentUser, users }: LotteryBoxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [participants, setParticipants] = useState<User[]>([])
  const [isShaking] = useState(false)

  // 获取抽奖参与者
  useEffect(() => {
    fetchParticipants()
  }, [roomId, users])

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('lottery_participants')
        .select(`
          *,
          users (*)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      const participantUsers = data?.map(p => p.users as User).filter(Boolean) || []
      setParticipants(participantUsers)
    } catch (error) {
      console.error('获取参与者失败:', error)
    }
  }

  const toggleBox = () => {
    setIsOpen(!isOpen)
  }

  const handleParticipate = async () => {
    if (currentUser.role !== 'player') {
      console.log('❌ 用户角色不是玩家，无法参与抽奖:', currentUser.role)
      return
    }

    try {
      console.log('🎯 玩家参与抽奖:', currentUser.nickname)
      const { error } = await supabase
        .from('lottery_participants')
        .insert({
          room_id: roomId,
          user_id: currentUser.id
        })

      if (error) throw error
      console.log('✅ 成功参与抽奖')
      await fetchParticipants()
    } catch (error) {
      console.error('❌ 参与抽奖失败:', error)
    }
  }

  const isParticipating = participants.some(p => p.id === currentUser.id)
  const canParticipate = currentUser.role === 'player' && stage === 'waiting' && !isParticipating
  
  // 调试信息
  console.log('🎯 [抽奖箱] 状态检查:', {
    currentUserRole: currentUser.role,
    stage,
    isParticipating,
    canParticipate
  })

  return (
    <div className="relative mb-8">
      {/* 抽奖箱 */}
      <motion.div
        className="relative mx-auto w-32 h-32 cursor-pointer z-10"
        onClick={toggleBox}
        animate={isShaking ? { rotate: [-2, 2, -2, 2, 0] } : {}}
        transition={{ duration: 0.5 }}
      >
        {/* 箱子主体 */}
        <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl border-4 border-yellow-300 shadow-lg relative overflow-visible">
          {/* 箱子装饰 */}
          <div className="absolute inset-2 border-2 border-yellow-200 rounded-lg"></div>
          
          {/* 礼物图标 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Gift className="w-12 h-12 text-white" />
          </div>

          {/* 参与者数量指示器 */}
          {participants.length > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold z-20">
              {participants.length}
            </div>
          )}
        </div>

        {/* 箱子盖子 */}
        <motion.div
          className="absolute -top-2 left-2 right-2 h-4 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-t-xl border-2 border-yellow-200"
          animate={isOpen ? { rotateX: -45, y: -10 } : { rotateX: 0, y: 0 }}
          style={{ transformOrigin: 'bottom' }}
        />
      </motion.div>

      {/* 参与抽奖按钮 */}
      {canParticipate && (
        <div className="text-center mt-4">
          <button
            onClick={handleParticipate}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            参与抽奖
          </button>
        </div>
      )}

      {/* 抽奖箱弹窗 */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">抽奖箱</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {participants.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无参与者</p>
            ) : (
              <div className="space-y-3">
                {participants.map((participant, index) => (
                  <div
                    key={participant.id}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <img
                      src={participant.avatar_url || ''}
                      alt={participant.nickname}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{participant.nickname}</p>
                      <p className="text-sm text-gray-500">第 {index + 1} 个参与</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
} 