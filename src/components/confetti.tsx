'use client'

import { useEffect, useState } from 'react'

interface ConfettiProps {
  isActive: boolean
  particleCount?: number
  className?: string
}

export function Confetti({ isActive, particleCount = 25, className = '' }: ConfettiProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [animationKey, setAnimationKey] = useState(0)
  
  const colors = ['#ff6b6b', '#4ecdc4', '#f9ca24', '#6c5ce7', '#fd79a8', '#00b894']

  // 控制撒花循环逻辑
  useEffect(() => {
    if (!isActive) {
      setShowConfetti(false)
      return
    }

    console.log('🎉 撒花效果开始循环')
    
    // 立即开始第一次撒花
    setShowConfetti(true)
    setAnimationKey(prev => prev + 1)
    
    // 设置循环定时器：第一次撒花结束后立即开始下一次撒花
    const cycleInterval = setInterval(() => {
      console.log('🎉 开始新一轮撒花')
      setShowConfetti(false)
      
      // 短暂延迟后重新开始，确保动画重置
      setTimeout(() => {
        setShowConfetti(true)
        setAnimationKey(prev => prev + 1)
      }, 100)
    }, 6300) // 最长动画时间(5.2s) + 最长延迟(1.05s) + 缓冲时间(0.05s) = 6.3秒循环
    
    return () => {
      clearInterval(cycleInterval)
      setShowConfetti(false)
    }
  }, [isActive])

  if (!isActive || !showConfetti) return null

  return (
    <div className={`fixed inset-0 pointer-events-none z-40 overflow-hidden ${className}`} key={animationKey}>
      <style jsx>{`
        @keyframes fall1 {
          0% { transform: translateY(-100vh) translateX(0); }
          100% { transform: translateY(100vh) translateX(10px); }
        }
        @keyframes fall2 {
          0% { transform: translateY(-100vh) translateX(0); }
          100% { transform: translateY(100vh) translateX(-10px); }
        }
        @keyframes fall3 {
          0% { transform: translateY(-100vh) translateX(0); }
          100% { transform: translateY(100vh) translateX(15px); }
        }
        @keyframes fall4 {
          0% { transform: translateY(-100vh) translateX(0); }
          100% { transform: translateY(100vh) translateX(-15px); }
        }
        @keyframes fall5 {
          0% { transform: translateY(-100vh) translateX(0); }
          100% { transform: translateY(100vh) translateX(5px); }
        }
        @keyframes fall6 {
          0% { transform: translateY(-100vh) translateX(0); }
          100% { transform: translateY(100vh) translateX(-8px); }
        }
        @keyframes fall7 {
          0% { transform: translateY(-100vh) translateX(0); }
          100% { transform: translateY(100vh) translateX(12px); }
        }
        @keyframes fall8 {
          0% { transform: translateY(-100vh) translateX(0); }
          100% { transform: translateY(100vh) translateX(-12px); }
        }
        
        .particle1 { animation: fall1 4.2s linear; }
        .particle2 { animation: fall2 4.6s linear; }
        .particle3 { animation: fall3 5.0s linear; }
        .particle4 { animation: fall4 3.8s linear; }
        .particle5 { animation: fall5 4.4s linear; }
        .particle6 { animation: fall6 5.2s linear; }
        .particle7 { animation: fall7 4.8s linear; }
        .particle8 { animation: fall8 4.0s linear; }
        
        .delay1 { animation-delay: 0s; }
        .delay2 { animation-delay: 0.15s; }
        .delay3 { animation-delay: 0.3s; }
        .delay4 { animation-delay: 0.45s; }
        .delay5 { animation-delay: 0.6s; }
        .delay6 { animation-delay: 0.75s; }
        .delay7 { animation-delay: 0.9s; }
        .delay8 { animation-delay: 1.05s; }
        
        .confetti-item {
          position: absolute;
          will-change: transform;
        }
      `}</style>
      
      {/* 彩带效果 */}
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={`ribbon-${i}`}
          className={`confetti-item particle${(i % 8) + 1} delay${(i % 8) + 1}`}
          style={{
            left: `${8 + i * 12}%`,
            width: '3px',
            height: '20px',
            backgroundColor: colors[i % colors.length],
            borderRadius: '1px',
          }}
        />
      ))}

      {/* 圆形粒子 */}
      {Array.from({ length: particleCount }, (_, i) => (
        <div
          key={`particle-${i}`}
          className={`confetti-item particle${(i % 8) + 1} delay${((i * 2) % 8) + 1}`}
          style={{
            left: `${5 + (i * 4) % 90}%`,
            width: '6px',
            height: '6px',
            backgroundColor: colors[i % colors.length],
            borderRadius: '50%',
          }}
        />
      ))}

      {/* 星星效果 */}
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={`star-${i}`}
          className={`confetti-item particle${((i * 3) % 8) + 1} delay${((i * 3 + 1) % 8) + 1} text-yellow-400`}
          style={{
            left: `${10 + i * 15}%`,
            fontSize: '14px',
          }}
        >
          ⭐
        </div>
      ))}

      {/* 心形效果 */}
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={`heart-${i}`}
          className={`confetti-item particle${((i * 5) % 8) + 1} delay${((i * 7) % 8) + 1} text-pink-500`}
          style={{
            left: `${15 + i * 18}%`,
            fontSize: '12px',
          }}
        >
          💖
        </div>
      ))}
    </div>
  )
} 