'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, X, Crown } from 'lucide-react'
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

  // 获取主持人列表（最多两个，按加入时间排序，保持固定顺序）
  const hosts = users
    .filter(user => user.role === 'host' && user.is_online)
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
    .slice(0, 2)

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
    canParticipate,
    hosts: hosts.length
  })

  return (
    <div className="relative mb-8">
      {/* 主持人头像和抽奖箱布局 */}
      <div className="flex items-center justify-center space-x-8">
        {/* 左侧主持人头像 */}
        <div className="flex-1 flex justify-end">
          {hosts[0] && (
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-16 h-16 rounded-full border-4 border-yellow-400 shadow-yellow-400/50 shadow-lg relative">
                <img
                  src={hosts[0].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${hosts[0].id}`}
                  alt={hosts[0].nickname}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${hosts[0].id}`
                  }}
                />
                {/* 表情显示 */}
                {hosts[0].current_emoji && hosts[0].emoji_expires_at && new Date(hosts[0].emoji_expires_at) > new Date() && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 flex items-center justify-center z-50">
                    <span className="text-5xl animate-bounce">
                      {hosts[0].current_emoji}
                    </span>
                  </div>
                )}
                {/* 主持人图标 */}
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 border border-gray-200">
                  <Crown className="w-3 h-3 text-yellow-400" />
                </div>
                {/* 在线状态指示器 */}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
              <p className="text-xs text-center mt-1 text-gray-800 truncate max-w-20">
                {hosts[0].nickname}
              </p>
            </motion.div>
          )}
        </div>

        {/* 抽奖箱 */}
        <motion.div
          className="relative w-32 h-32 cursor-pointer z-10"
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

        {/* 右侧主持人头像 */}
        <div className="flex-1 flex justify-start">
          {hosts[1] && (
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-16 h-16 rounded-full border-4 border-yellow-400 shadow-yellow-400/50 shadow-lg relative">
                <img
                  src={hosts[1].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${hosts[1].id}`}
                  alt={hosts[1].nickname}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${hosts[1].id}`
                  }}
                />
                {/* 表情显示 */}
                {hosts[1].current_emoji && hosts[1].emoji_expires_at && new Date(hosts[1].emoji_expires_at) > new Date() && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 flex items-center justify-center z-50">
                    <span className="text-5xl animate-bounce">
                      {hosts[1].current_emoji}
                    </span>
                  </div>
                )}
                {/* 主持人图标 */}
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 border border-gray-200">
                  <Crown className="w-3 h-3 text-yellow-400" />
                </div>
                {/* 在线状态指示器 */}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
              <p className="text-xs text-center mt-1 text-gray-800 truncate max-w-20">
                {hosts[1].nickname}
              </p>
            </motion.div>
          )}
        </div>
      </div>

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