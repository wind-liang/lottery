'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from './supabase'

interface UseUserPresenceOptimizedProps {
  userId: string | null
  roomId: string | null
  enabled?: boolean
}

// 连接状态枚举
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting'
}

export function useUserPresenceOptimized({ 
  userId, 
  roomId, 
  enabled = true 
}: UseUserPresenceOptimizedProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastHeartbeatRef = useRef<number>(0)
  const lastOnlineStatusRef = useRef<boolean | null>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 5
  
  // 自适应心跳间隔（基于用户活跃度）
  const [heartbeatInterval, setHeartbeatInterval] = useState(30000) // 默认30秒
  const lastActivityRef = useRef<number>(Date.now())
  
  // 网络状态检测
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  
  // 智能心跳间隔调整
  const adjustHeartbeatInterval = useCallback(() => {
    const timeSinceLastActivity = Date.now() - lastActivityRef.current
    
    if (timeSinceLastActivity < 60000) { // 1分钟内有活动
      setHeartbeatInterval(15000) // 15秒
    } else if (timeSinceLastActivity < 300000) { // 5分钟内有活动
      setHeartbeatInterval(30000) // 30秒
    } else {
      setHeartbeatInterval(60000) // 1分钟
    }
  }, [])

  // 更新用户在线状态（带重试机制）
  const updateUserStatus = useCallback(async (isOnline: boolean, retries = 0): Promise<boolean> => {
    if (!userId || !roomId) return false

    // 如果状态没有变化，避免不必要的数据库更新
    if (lastOnlineStatusRef.current === isOnline) {
      return true
    }

    try {
      setConnectionState(retries > 0 ? ConnectionState.RECONNECTING : ConnectionState.CONNECTING)
      
      const { error } = await supabase
        .from('users')
        .update({ 
          is_online: isOnline,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        throw error
      }

      lastOnlineStatusRef.current = isOnline
      setConnectionState(ConnectionState.CONNECTED)
      retryCountRef.current = 0
      return true
    } catch (error) {
      console.error('❌ [Presence] 更新用户状态失败:', error)
      
      if (retries < maxRetries) {
        const delay = Math.pow(2, retries) * 1000 // 指数退避
        console.log(`🔄 [Presence] ${delay}ms后重试更新状态 (${retries + 1}/${maxRetries})`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return updateUserStatus(isOnline, retries + 1)
      }
      
      setConnectionState(ConnectionState.DISCONNECTED)
      return false
    }
  }, [userId, roomId, maxRetries])

  // 批量心跳发送（减少数据库负载）
  const sendHeartbeat = useCallback(async () => {
    if (!userId || !roomId || !isOnline) return

    const now = Date.now()
    
    // 检查是否需要发送心跳
    if (now - lastHeartbeatRef.current < heartbeatInterval - 1000) {
      return
    }

    lastHeartbeatRef.current = now
    
    // 调整心跳间隔
    adjustHeartbeatInterval()
    
    const success = await updateUserStatus(true)
    if (!success) {
      console.log('⚠️ [Presence] 心跳发送失败，将在下次重试')
    }
  }, [userId, roomId, isOnline, heartbeatInterval, adjustHeartbeatInterval, updateUserStatus])

  // 记录用户活动
  const recordUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  // 智能活动检测（防抖）
  const throttledActivityHandler = useCallback(() => {
    recordUserActivity()
    
    // 如果用户重新活跃，立即发送心跳
    if (document.visibilityState === 'visible' && isOnline) {
      sendHeartbeat()
    }
  }, [recordUserActivity, sendHeartbeat, isOnline])

  // 页面可见性变化处理
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      recordUserActivity()
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      startHeartbeat()
    } else {
      stopHeartbeat()
    }
  }, [recordUserActivity])

  // 网络状态变化处理
  const handleOnline = useCallback(() => {
    setIsOnline(true)
    setConnectionState(ConnectionState.CONNECTING)
    recordUserActivity()
    startHeartbeat()
  }, [recordUserActivity])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
    setConnectionState(ConnectionState.DISCONNECTED)
    stopHeartbeat()
  }, [])

  // 页面卸载处理（带重试）
  const handleBeforeUnload = useCallback(() => {
    if (userId && roomId) {
      // 尝试同步设置离线状态
      try {
        navigator.sendBeacon('/api/user-offline', JSON.stringify({ userId }))
      } catch (error) {
        console.error('❌ [Presence] 页面卸载时设置离线状态失败:', error)
      }
    }
  }, [userId, roomId])

  // 开始心跳检测
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    // 立即发送一次心跳
    sendHeartbeat()
    
    // 设置动态间隔心跳
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat()
    }, heartbeatInterval)
  }, [sendHeartbeat, heartbeatInterval])

  // 停止心跳检测
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // 手动设置在线状态
  const setUserOnline = useCallback(async () => {
    recordUserActivity()
    await updateUserStatus(true)
  }, [recordUserActivity, updateUserStatus])

  // 手动设置离线状态
  const setUserOffline = useCallback(async () => {
    await updateUserStatus(false)
  }, [updateUserStatus])

  // 重新连接
  const reconnect = useCallback(async () => {
    if (!isOnline) return
    
    retryCountRef.current = 0
    setConnectionState(ConnectionState.CONNECTING)
    await setUserOnline()
    startHeartbeat()
  }, [isOnline, setUserOnline, startHeartbeat])

  // 主要effect：设置事件监听和初始化
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

    // 节流的用户活动检测
    let activityTimeout: NodeJS.Timeout | null = null
    const throttledActivity = () => {
      if (activityTimeout) return
      activityTimeout = setTimeout(() => {
        throttledActivityHandler()
        activityTimeout = null
      }, 10000) // 10秒内最多触发一次
    }

    document.addEventListener('mousemove', throttledActivity)
    document.addEventListener('keypress', throttledActivity)
    document.addEventListener('click', throttledActivity)
    document.addEventListener('scroll', throttledActivity)

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
      document.removeEventListener('click', throttledActivity)
      document.removeEventListener('scroll', throttledActivity)
      
      if (activityTimeout) {
        clearTimeout(activityTimeout)
      }
    }
  }, [enabled, userId, roomId, setUserOnline, setUserOffline, startHeartbeat, stopHeartbeat, 
      handleVisibilityChange, handleBeforeUnload, handleOnline, handleOffline, throttledActivityHandler])

  // 动态调整心跳间隔
  useEffect(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      startHeartbeat()
    }
  }, [heartbeatInterval, startHeartbeat])

  return {
    connectionState,
    isOnline,
    heartbeatInterval,
    setUserOnline,
    setUserOffline,
    startHeartbeat,
    stopHeartbeat,
    reconnect
  }
} 