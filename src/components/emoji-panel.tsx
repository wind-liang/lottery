'use client'

import { useState, useEffect } from 'react'
import { Smile } from 'lucide-react'
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
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setIsDisabled(false)
    }
  }, [countdown])

  const handleEmojiClick = async (emoji: string) => {
    if (isDisabled) return

    try {
      setIsDisabled(true)
      setCountdown(5)
      setIsOpen(false)

      console.log('🎭 准备发送表情:', {
        emoji,
        userId: currentUser.id,
        roomId,
        userNickname: currentUser.nickname
      })

      const result = await GameLogic.sendEmoji(currentUser.id, roomId, emoji)
      console.log('🎭 表情发送结果:', result)
      
      // 发送成功后立即刷新用户数据
      if (result && onEmojiSent) {
        console.log('🔄 表情发送成功，触发数据刷新')
        onEmojiSent()
      }
    } catch (error) {
      console.error('发送表情失败:', error)
      setIsDisabled(false)
      setCountdown(0)
    }
  }

  return (
    <div className="fixed bottom-4 right-4">
      {/* 表情面板 */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-lg p-4 w-64 max-h-48 overflow-y-auto">
          <div className="grid grid-cols-6 gap-2">
            {emojis.map((emoji, index) => (
              <button
                key={index}
                onClick={() => handleEmojiClick(emoji)}
                disabled={isDisabled}
                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        disabled={isDisabled}
        className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-purple-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
      >
        <Smile className="w-6 h-6" />
        
        {/* 倒计时显示 */}
        {countdown > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
            {countdown}
          </div>
        )}
      </button>
    </div>
  )
} 