'use client'

import { useState, useEffect } from 'react'
import { UserPlus, UserMinus, Smile, UserX, Trophy } from 'lucide-react'

interface Notification {
  id: string
  type: 'user_joined' | 'user_left' | 'emoji_sent' | 'user_kicked' | 'lottery_winner'
  message: string
  timestamp: Date
  emoji?: string
}

interface RealtimeNotificationsProps {
  className?: string
}

export function RealtimeNotifications({ className = '' }: RealtimeNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  // 添加通知
  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date()
    }
    
    setNotifications(prev => [...prev, newNotification])
    
    // 5秒后自动移除通知
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id))
    }, 5000)
  }

  // 获取图标
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'user_joined':
        return <UserPlus className="w-4 h-4 text-green-500" />
      case 'user_left':
        return <UserMinus className="w-4 h-4 text-red-500" />
      case 'user_kicked':
        return <UserX className="w-4 h-4 text-red-600" />
      case 'emoji_sent':
        return <Smile className="w-4 h-4 text-purple-500" />
      case 'lottery_winner':
        return <Trophy className="w-4 h-4 text-yellow-500" />
      default:
        return null
    }
  }

  // 获取通知样式
  const getNotificationStyle = (type: Notification['type']) => {
    switch (type) {
      case 'user_joined':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'user_left':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'user_kicked':
        return 'bg-red-100 border-red-300 text-red-900'
      case 'emoji_sent':
        return 'bg-purple-50 border-purple-200 text-purple-800'
      case 'lottery_winner':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  // 暴露添加通知的方法给全局使用
  useEffect(() => {
    // 将方法挂载到全局对象上
    (window as typeof window & { addRealtimeNotification?: typeof addNotification }).addRealtimeNotification = addNotification
    
    return () => {
      // 清理
      delete (window as typeof window & { addRealtimeNotification?: typeof addNotification }).addRealtimeNotification
    }
  }, [])

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            flex items-center space-x-3 p-3 rounded-lg border shadow-sm
            transform transition-all duration-300 ease-in-out
            animate-in slide-in-from-right-2 fade-in-0
            ${getNotificationStyle(notification.type)}
          `}
        >
          {getNotificationIcon(notification.type)}
          <div className="flex-1">
            <p className="text-sm font-medium flex items-center space-x-2">
              <span>{notification.message}</span>
              {notification.emoji && (
                <span className="text-lg">{notification.emoji}</span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// 全局添加通知的辅助函数
export const addRealtimeNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
  if (typeof window !== 'undefined') {
    const windowWithNotification = window as typeof window & { addRealtimeNotification?: (notification: Omit<Notification, 'id' | 'timestamp'>) => void }
    if (windowWithNotification.addRealtimeNotification) {
      windowWithNotification.addRealtimeNotification(notification)
    }
  }
} 