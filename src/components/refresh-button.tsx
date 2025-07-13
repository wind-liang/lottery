'use client'

import React, { useState } from 'react'

interface RefreshButtonProps {
  onRefresh: () => Promise<void> | void
  className?: string
}

export function RefreshButton({ onRefresh, className = '' }: RefreshButtonProps) {
  const [isRotating, setIsRotating] = useState(false)
  const [showToast, setShowToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const handleRefresh = async () => {
    setIsRotating(true)
    
    try {
      await onRefresh()
      setShowToast({
        type: 'success',
        message: '刷新成功！'
      })
    } catch (error) {
      console.error('刷新失败:', error)
      setShowToast({
        type: 'error',
        message: '刷新失败，请重试'
      })
    } finally {
      // 动画结束后重置状态
      setTimeout(() => {
        setIsRotating(false)
      }, 500)
    }
  }

  // 自动隐藏提示
  React.useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  return (
    <div className="relative">
      {/* 刷新按钮 */}
      <button
        onClick={handleRefresh}
        disabled={isRotating}
        className={`
          fixed bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800
          rounded-full w-12 h-12 flex items-center justify-center
          shadow-lg hover:shadow-xl transition-all duration-200
          border border-gray-200 hover:border-gray-300
          z-40 active:scale-95 disabled:opacity-50
          ${className}
        `}
        title="刷新获取最新状态"
      >
        {/* 提示消息 - 绝对定位在按钮内部 */}
        {showToast && (
          <div 
            className={`
              absolute px-3 py-2 rounded-lg text-sm font-medium shadow-lg z-50 whitespace-nowrap
              bottom-full mb-2 left-1/2 transform -translate-x-1/2
              ${showToast.type === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
              }
            `}
          >
            {showToast.message}
            <div className={`
              absolute top-full left-1/2 transform -translate-x-1/2 
              w-0 h-0 border-l-4 border-r-4 border-transparent
              ${showToast.type === 'success' 
                ? 'border-t-4 border-t-green-500' 
                : 'border-t-4 border-t-red-500'
              }
            `} />
          </div>
        )}
        
        <svg
          className={`w-5 h-5 ${
            isRotating ? 'animate-spin' : 'transition-transform duration-200'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  )
} 