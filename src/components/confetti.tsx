'use client'

import { useEffect, useState } from 'react'

interface ConfettiProps {
  isActive: boolean
  particleCount?: number
  className?: string
}

export function Confetti({ isActive, particleCount = 20, className = '' }: ConfettiProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [animationKey, setAnimationKey] = useState(0)
  
  const colors = [
    '#ff6b6b', '#4ecdc4', '#f9ca24', '#6c5ce7', '#fd79a8', '#00b894'
  ]

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
    
    // 设置循环定时器：每次撒花持续4秒，然后间隔5秒再次开始
    const cycleInterval = setInterval(() => {
      console.log('🎉 开始新一轮撒花')
      setShowConfetti(false)
      
      // 短暂延迟后重新开始，确保动画重置
      setTimeout(() => {
        setShowConfetti(true)
        setAnimationKey(prev => prev + 1)
      }, 100)
    }, 9000) // 4秒撒花 + 5秒间隔 = 9秒循环
    
    return () => {
      clearInterval(cycleInterval)
      setShowConfetti(false)
    }
  }, [isActive])

  if (!isActive || !showConfetti) return null

  return (
    <div className={`fixed inset-0 pointer-events-none z-40 overflow-hidden ${className}`} key={animationKey}>
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) translateX(0);
          }
          100% {
            transform: translateY(100vh) translateX(var(--drift, 0));
          }
        }
        
        .confetti-particle {
          position: absolute;
          animation: confetti-fall var(--duration, 2.5s) var(--delay, 0s) linear;
        }
      `}</style>
      
      {/* 彩带效果 */}
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={`ribbon-${i}`}
          className="confetti-particle"
          style={{
            left: `${(i + 1) * 18 + Math.random() * 8 - 4}%`,
            width: '3px',
            height: '25px',
            backgroundColor: colors[i % colors.length],
            borderRadius: '1px',
            '--duration': `${3 + Math.random() * 1}s`,
            '--delay': `${Math.random() * 0.5}s`,
            '--drift': `${Math.random() * 40 - 20}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* 圆形粒子 */}
      {Array.from({ length: particleCount }, (_, i) => (
        <div
          key={`particle-${i}`}
          className="confetti-particle"
          style={{
            left: `${Math.random() * 100}%`,
            width: '8px',
            height: '8px',
            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            borderRadius: '50%',
            '--duration': `${3 + Math.random() * 1}s`,
            '--delay': `${Math.random() * 0.8}s`,
            '--drift': `${Math.random() * 40 - 20}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* 星星效果 */}
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={`star-${i}`}
          className="confetti-particle text-yellow-400"
          style={{
            left: `${Math.random() * 80 + 10}%`,
            fontSize: '16px',
            '--duration': `${3 + Math.random() * 1}s`,
            '--delay': `${Math.random() * 0.8}s`,
            '--drift': `${Math.random() * 40 - 20}px`,
          } as React.CSSProperties}
        >
          ⭐
        </div>
      ))}

      {/* 心形效果 */}
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={`heart-${i}`}
          className="confetti-particle text-pink-500"
          style={{
            left: `${Math.random() * 80 + 10}%`,
            fontSize: '14px',
            '--duration': `${3.2 + Math.random() * 1}s`,
            '--delay': `${Math.random() * 0.8}s`,
            '--drift': `${Math.random() * 40 - 20}px`,
          } as React.CSSProperties}
        >
          💖
        </div>
      ))}
    </div>
  )
} 