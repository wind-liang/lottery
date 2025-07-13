'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Star, Crown, Zap } from 'lucide-react'

interface LotteryWinnerNotificationProps {
  winner: {
    userId: string
    nickname: string
    orderNumber: number
    avatar?: string
  } | null
  currentUserId: string
  onClose: () => void
}

export function LotteryWinnerNotification({ 
  winner, 
  currentUserId, 
  onClose 
}: LotteryWinnerNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (winner) {
      console.log('🏆 [WinnerNotification] 显示获奖通知:', winner.nickname, winner.orderNumber === 0 ? '绝地翻盘' : `第${winner.orderNumber}名`)
      
      // 延迟显示，确保状态同步
      setTimeout(() => {
        setIsVisible(true)
      }, 50) // 50ms延迟，确保渲染稳定
      
      // 根据是否是绝地翻盘设置不同的显示时间
      const isFinalLottery = winner.orderNumber === 0 // 绝地翻盘标识
      const displayTime = isFinalLottery ? 12000 : 8000 // 绝地翻盘12秒，普通抽奖8秒（增加绝地翻盘显示时间）
      
      const timer = setTimeout(() => {
        console.log('🏆 [WinnerNotification] 自动隐藏获奖通知')
        setIsVisible(false)
        setTimeout(() => {
          onClose()
        }, 300) // 等待动画完成后调用onClose
      }, displayTime)

      return () => {
        clearTimeout(timer)
      }
    } else {
      // 当 winner 为 null 时，立即隐藏弹窗
      console.log('🏆 [WinnerNotification] 隐藏获奖通知')
      setIsVisible(false)
    }
  }, [winner, onClose]) // 添加 onClose 依赖，确保函数引用变化时重新设置

  // 移除这个早期返回，让 AnimatePresence 处理动画

  const isCurrentUser = winner?.userId === currentUserId
  const isFinalLottery = winner?.orderNumber === 0 // 绝地翻盘标识
  
  const message = winner ? (
    isFinalLottery 
      ? (isCurrentUser ? `恭喜你绝地翻盘！` : `恭喜${winner.nickname}绝地翻盘！`)
      : (isCurrentUser 
        ? `恭喜你获得了第${winner.orderNumber}名！`
        : `恭喜${winner.nickname}获得了第${winner.orderNumber}名！`)
  ) : ''

  const getIcon = () => {
    if (!winner) return null
    if (isFinalLottery) {
      return <Zap className="w-16 h-16 text-red-400" />
    }
    switch (winner.orderNumber) {
      case 1:
        return <Crown className="w-16 h-16 text-yellow-500" />
      case 2:
        return <Trophy className="w-16 h-16 text-gray-400" />
      case 3:
        return <Trophy className="w-16 h-16 text-orange-600" />
      default:
        return <Star className="w-16 h-16 text-purple-500" />
    }
  }

  const getBackgroundColor = () => {
    if (!winner) return 'from-purple-400 to-purple-600'
    if (isFinalLottery) {
      return 'from-red-500 to-red-700'
    }
    switch (winner.orderNumber) {
      case 1:
        return 'from-yellow-400 to-yellow-600'
      case 2:
        return 'from-gray-300 to-gray-500'
      case 3:
        return 'from-orange-400 to-orange-600'
      default:
        return 'from-purple-400 to-purple-600'
    }
  }

  const getRedPacketReward = () => {
    if (!winner) return null
    
    // 绝地翻盘获胜者的奖励
    if (isFinalLottery) return 300
    
    const rewardMap: { [key: number]: number } = {
      1: 88,
      2: 66,
      3: 50,
      4: 30
    }
    
    return rewardMap[winner.orderNumber] || null
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              duration: 0.3
            }}
            className={`
              relative p-8 rounded-3xl shadow-2xl border-4 border-white/20 text-center
              bg-gradient-to-br ${getBackgroundColor()}
              max-w-sm w-full mx-4
            `}
          >
            {/* 装饰光效 */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 to-transparent"></div>
            
            {/* 星星装饰 */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl">
              {[...Array(12)].map((_, i) => (
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
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>

            {/* 主要内容 */}
            <div className="relative z-10">
              {/* 用户头像 */}
              <div className="mb-4">
                <div className="relative inline-block">
                  <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden mx-auto">
                    <img
                      src={winner?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${winner?.userId || 'default'}`}
                      alt={winner?.nickname || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* 排名徽章 */}
                  <div className="absolute -top-2 -right-2 bg-white text-black font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                    {isFinalLottery ? '翻盘' : (winner?.orderNumber || 0)}
                  </div>
                </div>
              </div>

              {/* 图标 */}
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0] 
                }}
                transition={{ 
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 0.5
                }}
                className="mb-4"
              >
                {getIcon()}
              </motion.div>

              {/* 获奖消息 */}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-white mb-2"
              >
                {isCurrentUser ? '🎉 恭喜你！' : '🎉 恭喜！'}
              </motion.h2>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xl text-white/90 font-medium"
              >
                {message}
              </motion.p>

              {/* 红包奖励信息 */}
              {getRedPacketReward() && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-3 p-3 bg-red-500/30 border-2 border-red-400/50 rounded-xl shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.2) 100%)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)'
                  }}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-2xl">🧧</span>
                    <span className="text-lg font-bold text-white drop-shadow-lg">
                      额外奖励 {getRedPacketReward()} 元红包
                    </span>
                  </div>
                </motion.div>
              )}

              {/* 动态文字效果 */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                className="mt-4 text-white/80 text-sm"
              >
                {isFinalLottery 
                  ? (isCurrentUser ? '你成功实现了绝地翻盘！' : `${winner?.nickname || ''}成功实现了绝地翻盘！`)
                  :  '名次将作为下一阶段选择礼物的顺序'
                }
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 