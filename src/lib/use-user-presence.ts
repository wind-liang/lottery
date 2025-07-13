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
  const lastOnlineStatusRef = useRef<boolean | null>(null) // 跟踪上次的在线状态

  // 更新用户在线状态 - 只有在状态真正变化时才更新数据库
  const updateUserStatus = useCallback(async (isOnline: boolean) => {
    if (!userId || !roomId) return

    // 如果状态没有变化，避免不必要的数据库更新
    if (lastOnlineStatusRef.current === isOnline) {
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          is_online: isOnline
        })
        .eq('id', userId)

      if (error) {
        console.error('❌ [Presence] 更新用户状态失败:', error)
      } else {
        lastOnlineStatusRef.current = isOnline
      }
    } catch (error) {
      console.error('❌ [Presence] 更新用户状态异常:', error)
    }
  }, [userId, roomId])

  // 发送心跳 - 使用优化后的状态更新
  const sendHeartbeat = useCallback(async () => {
    if (!userId || !roomId) return

    const now = Date.now()
    
    // 避免过于频繁的心跳 - 增加到30秒
    if (now - lastHeartbeatRef.current < 30000) {
      return
    }

    lastHeartbeatRef.current = now

    // 使用优化后的状态更新函数，只有在状态变化时才更新数据库
    await updateUserStatus(true)
  }, [userId, roomId, updateUserStatus])

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

    // 立即发送一次心跳
    sendHeartbeat()
    
    // 设置定时心跳（每2分钟）- 大幅降低频率，减少数据库负载
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 120000)
  }, [sendHeartbeat])

  // 停止心跳检测
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // 页面可见性变化处理
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      startHeartbeat()
    } else {
      stopHeartbeat()
    }
  }, [startHeartbeat, stopHeartbeat])

  // 页面卸载处理
  const handleBeforeUnload = useCallback(() => {
    // 使用同步方式设置用户离线
    if (userId && roomId) {
      navigator.sendBeacon('/api/user-offline', JSON.stringify({ userId }))
    }
  }, [userId, roomId])

  // 网络状态变化处理
  const handleOnline = useCallback(() => {
    startHeartbeat()
  }, [startHeartbeat])

  const handleOffline = useCallback(() => {
    stopHeartbeat()
  }, [stopHeartbeat])

  useEffect(() => {
    if (!enabled || !userId || !roomId) return

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

    // 限制活跃检测的频率 - 大幅降低触发频率
    let activityTimeout: NodeJS.Timeout | null = null
    const throttledActivity = () => {
      if (activityTimeout) return
      activityTimeout = setTimeout(() => {
        handleUserActivity()
        activityTimeout = null
      }, 60000) // 60秒内最多触发一次，大幅减少频率
    }

    document.addEventListener('mousemove', throttledActivity)
    document.addEventListener('keypress', throttledActivity)

    return () => {
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