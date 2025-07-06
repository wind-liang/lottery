'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

interface UseUserPresenceProps {
  userId: string | null
  roomId: string | null
  enabled?: boolean
}

export function useUserPresence({ userId, roomId, enabled = true }: UseUserPresenceProps) {
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastHeartbeatRef = useRef<number>(0)

  // 更新用户在线状态
  const updateUserStatus = useCallback(async (isOnline: boolean) => {
    if (!userId || !roomId) return

    try {
      console.log('🔄 [Presence] 更新用户状态:', { userId, isOnline })
      
      const { error } = await supabase
        .from('users')
        .update({ 
          is_online: isOnline,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('❌ [Presence] 更新用户状态失败:', error)
      } else {
        console.log('✅ [Presence] 用户状态更新成功:', isOnline ? '在线' : '离线')
      }
    } catch (error) {
      console.error('❌ [Presence] 更新用户状态异常:', error)
    }
  }, [userId, roomId])

  // 发送心跳
  const sendHeartbeat = useCallback(async () => {
    if (!userId || !roomId) return

    const now = Date.now()
    
    // 避免过于频繁的心跳
    if (now - lastHeartbeatRef.current < 5000) {
      return
    }

    lastHeartbeatRef.current = now

    try {
      console.log('💓 [Presence] 发送心跳...')
      
      const { error } = await supabase
        .from('users')
        .update({ 
          is_online: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('❌ [Presence] 心跳发送失败:', error)
      } else {
        console.log('✅ [Presence] 心跳发送成功')
      }
    } catch (error) {
      console.error('❌ [Presence] 心跳发送异常:', error)
    }
  }, [userId, roomId])

  // 设置用户为在线状态
  const setUserOnline = useCallback(async () => {
    await updateUserStatus(true)
  }, [updateUserStatus])

  // 设置用户为离线状态
  const setUserOffline = useCallback(async () => {
    await updateUserStatus(false)
  }, [updateUserStatus])

  // 开始心跳检测
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    console.log('💓 [Presence] 开始心跳检测...')
    
    // 立即发送一次心跳
    sendHeartbeat()
    
    // 设置定时心跳（每15秒）
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000)
  }, [sendHeartbeat])

  // 停止心跳检测
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      console.log('💓 [Presence] 停止心跳检测')
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // 页面可见性变化处理
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      console.log('👀 [Presence] 页面变为可见，恢复心跳')
      startHeartbeat()
    } else {
      console.log('👀 [Presence] 页面变为隐藏，停止心跳')
      stopHeartbeat()
    }
  }, [startHeartbeat, stopHeartbeat])

  // 页面卸载处理
  const handleBeforeUnload = useCallback(() => {
    console.log('👋 [Presence] 页面即将卸载，设置用户离线')
    // 使用同步方式设置用户离线
    if (userId && roomId) {
      navigator.sendBeacon('/api/user-offline', JSON.stringify({ userId }))
    }
  }, [userId, roomId])

  // 网络状态变化处理
  const handleOnline = useCallback(() => {
    console.log('🌐 [Presence] 网络恢复，恢复心跳')
    startHeartbeat()
  }, [startHeartbeat])

  const handleOffline = useCallback(() => {
    console.log('🌐 [Presence] 网络断开，停止心跳')
    stopHeartbeat()
  }, [stopHeartbeat])

  useEffect(() => {
    if (!enabled || !userId || !roomId) return

    console.log('🚀 [Presence] 初始化用户状态管理...')

    // 设置用户在线并开始心跳
    setUserOnline()
    startHeartbeat()

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 监听页面卸载
    window.addEventListener('beforeunload', handleBeforeUnload)

    // 监听网络状态
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 监听鼠标活动（用户活跃检测）
    const handleUserActivity = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }

    // 限制活跃检测的频率
    let activityTimeout: NodeJS.Timeout | null = null
    const throttledActivity = () => {
      if (activityTimeout) return
      activityTimeout = setTimeout(() => {
        handleUserActivity()
        activityTimeout = null
      }, 10000) // 10秒内最多触发一次
    }

    document.addEventListener('mousemove', throttledActivity)
    document.addEventListener('keypress', throttledActivity)

    return () => {
      console.log('🔌 [Presence] 清理用户状态管理...')
      
      // 设置用户离线
      setUserOffline()
      
      // 停止心跳
      stopHeartbeat()
      
      // 清理事件监听
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('mousemove', throttledActivity)
      document.removeEventListener('keypress', throttledActivity)
      
      if (activityTimeout) {
        clearTimeout(activityTimeout)
      }
    }
  }, [enabled, userId, roomId, setUserOnline, setUserOffline, startHeartbeat, stopHeartbeat, handleVisibilityChange, handleBeforeUnload, handleOnline, handleOffline, sendHeartbeat])

  return {
    setUserOnline,
    setUserOffline,
    startHeartbeat,
    stopHeartbeat
  }
} 