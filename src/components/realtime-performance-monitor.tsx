'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Activity, Clock, Database, Signal, TrendingUp } from 'lucide-react'

interface PerformanceMetrics {
  messageLatency: number[]
  reconnectCount: number
  messagesPerSecond: number
  dbQueryCount: number
  dbQueryLatency: number[]
  memoryUsage: number
  connectionUptime: number
  lastUpdated: Date
}

interface PerformanceMonitorProps {
  enabled?: boolean
  maxDataPoints?: number
  className?: string
}

export function RealtimePerformanceMonitor({ 
  enabled = true, 
  maxDataPoints = 50,
  className = '' 
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    messageLatency: [],
    reconnectCount: 0,
    messagesPerSecond: 0,
    dbQueryCount: 0,
    dbQueryLatency: [],
    memoryUsage: 0,
    connectionUptime: 0,
    lastUpdated: new Date()
  })
  
  const [isExpanded, setIsExpanded] = useState(false)
  const startTimeRef = useRef<number>(Date.now())
  const messageCountRef = useRef<number>(0)
  const lastMessageTimeRef = useRef<number>(Date.now())

  // 记录消息延迟
  const recordMessageLatency = useCallback((latency: number) => {
    setMetrics(prev => ({
      ...prev,
      messageLatency: [...prev.messageLatency.slice(-maxDataPoints + 1), latency],
      lastUpdated: new Date()
    }))
  }, [maxDataPoints])

  // 记录数据库查询
  const recordDBQuery = useCallback((latency: number) => {
    setMetrics(prev => ({
      ...prev,
      dbQueryCount: prev.dbQueryCount + 1,
      dbQueryLatency: [...prev.dbQueryLatency.slice(-maxDataPoints + 1), latency],
      lastUpdated: new Date()
    }))
  }, [maxDataPoints])

  // 记录重连事件
  const recordReconnect = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      reconnectCount: prev.reconnectCount + 1,
      lastUpdated: new Date()
    }))
  }, [])

  // 记录消息接收
  const recordMessage = useCallback(() => {
    const now = Date.now()
    messageCountRef.current += 1
    
    // 计算每秒消息数（滑动窗口）
    const timeDiff = (now - lastMessageTimeRef.current) / 1000
    if (timeDiff >= 1) {
      const messagesPerSecond = messageCountRef.current / timeDiff
      setMetrics(prev => ({
        ...prev,
        messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
        lastUpdated: new Date()
      }))
      
      messageCountRef.current = 0
      lastMessageTimeRef.current = now
    }
  }, [])

  // 监控内存使用
  const updateMemoryUsage = useCallback(() => {
    try {
      const memInfo = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      if (memInfo) {
        setMetrics(prev => ({
          ...prev,
          memoryUsage: Math.round(memInfo.usedJSHeapSize / 1024 / 1024 * 100) / 100, // MB
          lastUpdated: new Date()
        }))
      }
    } catch {
      // 忽略内存监控错误
    }
  }, [])

  // 更新连接时长
  const updateConnectionUptime = useCallback(() => {
    const uptime = Math.round((Date.now() - startTimeRef.current) / 1000)
    setMetrics(prev => ({
      ...prev,
      connectionUptime: uptime,
      lastUpdated: new Date()
    }))
  }, [])

  // 主要监控逻辑
  useEffect(() => {
    if (!enabled) return

    // 定期更新指标
    const interval = setInterval(() => {
      updateMemoryUsage()
      updateConnectionUptime()
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [enabled, updateMemoryUsage, updateConnectionUptime])

  // 暴露监控函数到全局
  useEffect(() => {
    if (enabled) {
      const windowObj = window as unknown as { realtimePerformanceMonitor?: object }
      windowObj.realtimePerformanceMonitor = {
        recordMessageLatency,
        recordDBQuery,
        recordReconnect,
        recordMessage
      }
    }

    return () => {
      const windowObj = window as unknown as { realtimePerformanceMonitor?: object }
      if (windowObj.realtimePerformanceMonitor) {
        delete windowObj.realtimePerformanceMonitor
      }
    }
  }, [enabled, recordMessageLatency, recordDBQuery, recordReconnect, recordMessage])

  // 计算统计信息
  const getStats = () => {
    const { messageLatency, dbQueryLatency } = metrics
    
    return {
      avgMessageLatency: messageLatency.length > 0 
        ? Math.round(messageLatency.reduce((a, b) => a + b, 0) / messageLatency.length * 100) / 100
        : 0,
      avgDBLatency: dbQueryLatency.length > 0
        ? Math.round(dbQueryLatency.reduce((a, b) => a + b, 0) / dbQueryLatency.length * 100) / 100
        : 0,
      maxMessageLatency: messageLatency.length > 0 ? Math.max(...messageLatency) : 0,
      minMessageLatency: messageLatency.length > 0 ? Math.min(...messageLatency) : 0
    }
  }

  const stats = getStats()

  // 格式化时间
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  if (!enabled) return null

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {/* 头部 */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Activity className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="text-sm font-medium text-gray-900">实时通信性能</h3>
            <p className="text-xs text-gray-500">
              延迟: {stats.avgMessageLatency}ms | 消息: {metrics.messagesPerSecond}/s
            </p>
          </div>
        </div>
        <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 详细信息 */}
      {isExpanded && (
        <div className="border-t p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 消息延迟 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-gray-700">消息延迟</span>
              </div>
              <div className="text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>平均:</span>
                  <span className="font-medium">{stats.avgMessageLatency}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>最大:</span>
                  <span className="font-medium">{stats.maxMessageLatency}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>最小:</span>
                  <span className="font-medium">{stats.minMessageLatency}ms</span>
                </div>
              </div>
            </div>

            {/* 消息速率 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Signal className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700">消息速率</span>
              </div>
              <div className="text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>当前:</span>
                  <span className="font-medium">{metrics.messagesPerSecond}/s</span>
                </div>
                <div className="flex justify-between">
                  <span>重连:</span>
                  <span className="font-medium">{metrics.reconnectCount}</span>
                </div>
              </div>
            </div>

            {/* 数据库性能 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-700">数据库</span>
              </div>
              <div className="text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>查询数:</span>
                  <span className="font-medium">{metrics.dbQueryCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>平均延迟:</span>
                  <span className="font-medium">{stats.avgDBLatency}ms</span>
                </div>
              </div>
            </div>

            {/* 系统资源 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">系统资源</span>
              </div>
              <div className="text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>内存:</span>
                  <span className="font-medium">{metrics.memoryUsage}MB</span>
                </div>
                <div className="flex justify-between">
                  <span>运行时间:</span>
                  <span className="font-medium">{formatUptime(metrics.connectionUptime)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 更新时间 */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              最后更新: {metrics.lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// 用于集成到现有Hook中的性能监控工具
export const realtimePerformanceTracker = {
  recordMessageLatency: (latency: number) => {
    const windowObj = window as unknown as { realtimePerformanceMonitor?: { recordMessageLatency?: (latency: number) => void } }
    if (windowObj.realtimePerformanceMonitor?.recordMessageLatency) {
      windowObj.realtimePerformanceMonitor.recordMessageLatency(latency)
    }
  },
  
  recordDBQuery: (latency: number) => {
    const windowObj = window as unknown as { realtimePerformanceMonitor?: { recordDBQuery?: (latency: number) => void } }
    if (windowObj.realtimePerformanceMonitor?.recordDBQuery) {
      windowObj.realtimePerformanceMonitor.recordDBQuery(latency)
    }
  },
  
  recordReconnect: () => {
    const windowObj = window as unknown as { realtimePerformanceMonitor?: { recordReconnect?: () => void } }
    if (windowObj.realtimePerformanceMonitor?.recordReconnect) {
      windowObj.realtimePerformanceMonitor.recordReconnect()
    }
  },
  
  recordMessage: () => {
    const windowObj = window as unknown as { realtimePerformanceMonitor?: { recordMessage?: () => void } }
    if (windowObj.realtimePerformanceMonitor?.recordMessage) {
      windowObj.realtimePerformanceMonitor.recordMessage()
    }
  }
} 