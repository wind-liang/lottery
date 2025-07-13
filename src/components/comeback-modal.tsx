'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingUp, Crown, Trophy, Star, Zap } from 'lucide-react'
import { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']

interface ComebackModalProps {
  isVisible: boolean
  lastFivePlayers: User[]
  onClose: () => void
  onComplete: () => void
}

export function ComebackModal({ 
  isVisible, 
  lastFivePlayers, 
  onClose, 
  onComplete 
}: ComebackModalProps) {
  const [countdown, setCountdown] = useState(10)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const onCompleteRef = useRef(onComplete)

  // 更新 onComplete 引用
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    console.log('🎯 [ComebackModal] useEffect 触发，isVisible:', isVisible, 'lastFivePlayersCount:', lastFivePlayers.length)
    
    // 清理之前的计时器
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    if (isVisible && lastFivePlayers.length > 0) {
      console.log('🎯 [ComebackModal] 开始倒计时')
      setCountdown(10)
      
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          const newValue = prev - 1
          console.log('🎯 [ComebackModal] 倒计时更新:', prev, '->', newValue)
          
          if (newValue <= 0) {
            console.log('🎯 [ComebackModal] 倒计时结束，进入绝地翻盘阶段')
            if (timerRef.current) {
              clearInterval(timerRef.current)
              timerRef.current = null
            }
            // 使用 setTimeout 确保在渲染周期完成后再调用回调
            setTimeout(() => {
              onCompleteRef.current()
            }, 0)
            return 0
          }
          return newValue
        })
      }, 1000)
    } else if (!isVisible) {
      // 当弹窗隐藏时，重置倒计时
      console.log('🎯 [ComebackModal] 弹窗隐藏，重置倒计时')
      setCountdown(10)
    }

    return () => {
      if (timerRef.current) {
        console.log('🎯 [ComebackModal] 清理倒计时定时器')
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isVisible, lastFivePlayers.length])

  const getPlayerIcon = (orderNumber: number) => {
    switch (orderNumber) {
      case -1:
        return <Zap className="w-4 h-4 text-red-500" />
      case 1:
        return <Crown className="w-4 h-4 text-yellow-500" />
      case 2:
        return <Trophy className="w-4 h-4 text-gray-400" />
      case 3:
        return <Trophy className="w-4 h-4 text-orange-600" />
      default:
        return <Star className="w-4 h-4 text-purple-500" />
    }
  }

  const getWinningChance = (index: number) => {
    // 根据排名计算权重：最后一名5次，倒数第二名4次，依此类推
    // index 是在 lastFivePlayers 数组中的索引，0 表示最后一名
    const totalPlayers = lastFivePlayers.length
    const playerWeight = totalPlayers - index // 最后一名(index=0)权重最高
    const totalWeight = lastFivePlayers.reduce((sum, _, i) => sum + (totalPlayers - i), 0)
    return Math.round((playerWeight / totalWeight) * 100)
  }



  console.log('🎯 [ComebackModal] 渲染状态:', {
    isVisible,
    lastFivePlayersCount: lastFivePlayers.length,
    countdown
  })

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              duration: 0.5
            }}
            className="relative p-8 rounded-3xl shadow-2xl border-4 border-red-400/50 text-center bg-gradient-to-br from-red-500 to-red-700 max-w-lg w-full mx-4"
          >
            {/* 装饰光效 */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 to-transparent"></div>
            
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-red-200 z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* 星星装饰 */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-white rounded-full opacity-60"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>

            {/* 倒计时 - 放在左上角，避免遮挡标题 */}
            <motion.div
              className="absolute top-3 left-3 bg-white/30 backdrop-blur-sm rounded-full px-3 py-1 z-20 border border-white/50"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <span className="text-white font-bold text-sm">{countdown}s</span>
            </motion.div>

            {/* 主要内容 */}
            <div className="relative z-10">
              {/* 标题 */}
              <motion.h2 
                className="text-4xl font-bold text-white mb-2"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                绝地翻盘阶段
              </motion.h2>
              
              <motion.p 
                className="text-xl text-white/90 mb-6"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                排名越后，翻盘概率越高！
              </motion.p>

              {/* 参与者信息 */}
              <motion.div
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  翻盘参与者
                </h3>
                
                <div className="space-y-3">
                  {lastFivePlayers.map((player, index) => (
                    <motion.div
                      key={player.id}
                      className="flex items-center justify-between bg-white/10 rounded-xl p-3"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                    >
                      <div className="flex items-center space-x-3">
                        {/* 头像 */}
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full border-2 border-white/50">
                            <img
                              src={player.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.id}`}
                              alt={player.nickname}
                              className="w-full h-full object-cover rounded-full"
                            />
                          </div>
                          {/* 排名标识 */}
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-800">{player.order_number === -1 ? '🏆' : player.order_number}</span>
                          </div>
                        </div>
                        
                        {/* 用户信息 */}
                        <div className="text-left">
                          <p className="text-white font-medium">{player.nickname}</p>
                          <p className="text-white/70 text-sm flex items-center">
                            {getPlayerIcon(player.order_number || 0)}
                            <span className="ml-1">{player.order_number === -1 ? '🏆 绝地翻盘获胜者' : `第${player.order_number}名`}</span>
                          </p>
                        </div>
                      </div>
                      
                      {/* 中奖概率 */}
                      <div className="text-right">
                        <div className="text-xl font-bold text-yellow-300">
                          {getWinningChance(index)}%
                        </div>
                        <div className="text-white/70 text-sm">
                          中奖概率
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* 规则说明 */}
              <motion.div
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <h4 className="text-lg font-semibold text-white mb-2">翻盘规则</h4>
                <div className="text-white/90 text-sm space-y-1">
                  <p>最后一名将获得 5 倍中奖机会</p>
                  <p>倒数第二名将获得 4 倍中奖机会</p>
                  <p>以此类推，排名越后机会越多</p>
                  <p>翻盘奖将从所有机会中随机抽取</p>
                </div>
                
                {/* 红包奖励信息 */}
                <div className="mt-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl">
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-lg">🧧</span>
                    <h5 className="text-white font-semibold ml-2">红包奖励</h5>
                  </div>
                  <div className="text-white/90 text-sm">
                    <p className="font-medium text-yellow-300 text-center">绝地翻盘获胜者：300元红包</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 