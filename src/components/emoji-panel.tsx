'use client'

import { useState, useEffect } from 'react'
import { Smile, WifiOff, RefreshCw } from 'lucide-react'
import { GameLogic } from '@/lib/game-logic'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']

interface EmojiPanelProps {
  currentUser: User
  roomId: string
  onEmojiSent?: () => void
}

const emojis = [
  '😊', '😄', '😍', '🥰', '😘', '😎', 
  '🤗', '😂', '🤣', '😭', '😅', '😉',
  '👍', '👏', '🙌', '💪', '✊', '🤝',
  '❤️', '💕', '💖', '💝', '🌟', '✨',
  '🎉', '🎊', '🎈', '🎁', '🏆', '🥇'
]

export function EmojiPanel({ currentUser, roomId, onEmojiSent }: EmojiPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDisabled, setIsDisabled] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && isDisabled && !isSending) {
      setIsDisabled(false)
    }
  }, [countdown, isDisabled, isSending])

  // 清除错误提示
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
        setRetryCount(0)
      }, 5000) // 5秒后自动清除错误提示
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleEmojiClick = async (emoji: string) => {
    if (isDisabled || isSending) return

    // 检查网络状态
    if (!isOnline) {
      setError('网络连接已断开，请检查网络后重试')
      return
    }

    try {
      setIsSending(true)
      setIsDisabled(true)
      setIsOpen(false)
      setError(null)
      setRetryCount(0)

      console.log('🎭 准备发送表情:', {
        emoji,
        userId: currentUser.id,
        roomId,
        userNickname: currentUser.nickname
      })

      const success = await GameLogic.sendEmoji(currentUser.id, roomId, emoji)
      
      if (success) {
        console.log('🎭 表情发送成功')
        setCountdown(5) // 成功后设置5秒倒计时
        
        // 发送成功后立即刷新用户数据
        if (onEmojiSent) {
          console.log('🔄 表情发送成功，触发数据刷新')
          onEmojiSent()
        }
      } else {
        throw new Error('表情发送失败，请稍后重试')
      }
    } catch (error) {
      console.error('发送表情失败:', error)
      setIsDisabled(false)
      setCountdown(0)
      
      // 设置用户友好的错误信息
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('发送表情失败，请稍后重试')
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    setRetryCount(prev => prev + 1)
    // 可以在这里重新尝试发送上一个表情，但为了简化，我们只是清除错误
  }

  const getStatusIcon = () => {
    if (isSending) return <RefreshCw className="w-6 h-6 animate-spin" />
    if (!isOnline) return <WifiOff className="w-6 h-6" />
    return <Smile className="w-6 h-6" />
  }

  const getStatusColor = () => {
    if (isSending) return 'text-blue-600'
    if (!isOnline) return 'text-red-600'
    if (error) return 'text-red-600'
    return 'text-purple-600'
  }

  const getButtonColor = () => {
    if (!isOnline) return 'bg-red-50 hover:bg-red-100'
    if (isSending) return 'bg-blue-50'
    return 'bg-white hover:bg-gray-50'
  }

  return (
    <div className="fixed bottom-4 right-4 z-[55]">
      {/* 网络状态提示 */}
      {!isOnline && (
        <div className="absolute bottom-16 right-0 bg-red-500 text-white text-sm rounded-lg px-4 py-3 shadow-lg mb-2 w-48 z-[55]">
          <div className="flex items-center">
            <WifiOff className="w-4 h-4 mr-3" />
            <span>网络连接已断开</span>
          </div>
        </div>
      )}

      {/* 发送状态提示 */}
      {isSending && (
        <div className="absolute bottom-16 right-0 bg-blue-500 text-white text-sm rounded-lg px-4 py-3 shadow-lg mb-2 w-48 z-[55]">
          <div className="flex items-center">
            <RefreshCw className="w-4 h-4 mr-3 animate-spin" />
            <span>正在发送表情...</span>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && !isSending && (
        <div className="absolute bottom-16 right-0 bg-red-500 text-white text-sm rounded-lg px-4 py-3 shadow-lg mb-2 w-72 z-[55]">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-medium">发送失败</div>
              <div className="text-xs text-red-100 mt-1">{error}</div>
              {retryCount > 0 && (
                <div className="text-xs text-red-100 mt-1">已重试 {retryCount} 次</div>
              )}
            </div>
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={handleRetry}
                className="text-red-200 hover:text-white p-1 rounded"
                title="重试"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={() => setError(null)}
                className="text-red-200 hover:text-white p-1 rounded"
                title="关闭"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 表情面板 */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-lg p-4 w-64 max-h-48 overflow-y-auto z-[55]">
          <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
            <span>选择表情</span>
            {!isOnline && (
              <div className="flex items-center text-red-500">
                <WifiOff className="w-3 h-3 mr-1" />
                <span>离线</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {emojis.map((emoji, index) => (
              <button
                key={index}
                onClick={() => handleEmojiClick(emoji)}
                disabled={isDisabled || isSending || !isOnline}
                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!isOnline ? '网络连接已断开' : isSending ? '正在发送...' : ''}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 表情按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDisabled && !isSending}
        className={`w-12 h-12 ${getButtonColor()} rounded-full shadow-lg flex items-center justify-center ${getStatusColor()} transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative`}
        title={!isOnline ? '网络连接已断开' : isSending ? '正在发送表情...' : '发送表情'}
      >
        {getStatusIcon()}
        
        {/* 倒计时显示 */}
        {countdown > 0 && !isSending && (
          <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
            {countdown}
          </div>
        )}
        
        {/* 发送中指示器 */}
        {isSending && (
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
            <RefreshCw className="w-3 h-3 animate-spin" />
          </div>
        )}
        
        {/* 错误指示器 */}
        {error && !isSending && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
            !
          </div>
        )}
      </button>
    </div>
  )
} 