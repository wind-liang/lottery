'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react'

interface ConnectionStatusProps {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  isOnline: boolean
  heartbeatInterval: number
  onReconnect?: () => void
  className?: string
}

export function ConnectionStatus({ 
  connectionState, 
  isOnline, 
  heartbeatInterval,
  onReconnect,
  className = '' 
}: ConnectionStatusProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null)

  // 模拟心跳更新
  useEffect(() => {
    if (connectionState === 'connected') {
      const interval = setInterval(() => {
        setLastHeartbeat(new Date())
      }, heartbeatInterval)
      
      return () => clearInterval(interval)
    }
  }, [connectionState, heartbeatInterval])

  // 获取状态图标和样式
  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'text-green-500',
          bgColor: 'bg-green-50 border-green-200',
          label: '已连接',
          description: '实时通信正常'
        }
      case 'connecting':
        return {
          icon: <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50 border-blue-200',
          label: '连接中',
          description: '正在建立连接...'
        }
      case 'reconnecting':
        return {
          icon: <RotateCcw className="w-4 h-4 animate-spin" />,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50 border-yellow-200',
          label: '重连中',
          description: '正在尝试重新连接...'
        }
      default:
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-red-500',
          bgColor: 'bg-red-50 border-red-200',
          label: '连接断开',
          description: '实时通信已断开'
        }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <div className={`relative ${className}`}>
      {/* 主要状态指示器 */}
      <div 
        className={`
          flex items-center space-x-2 px-3 py-2 rounded-lg border cursor-pointer
          transition-all duration-200 hover:shadow-sm
          ${statusConfig.bgColor}
        `}
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* 网络状态图标 */}
        <div className="flex items-center space-x-1">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-gray-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <div className={statusConfig.color}>
            {statusConfig.icon}
          </div>
        </div>

        {/* 状态文本 */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {statusConfig.description}
          </p>
        </div>

        {/* 展开/收起指示器 */}
        <div className={`transform transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 详细信息面板 */}
      {showDetails && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border shadow-lg z-50 p-4">
          <div className="space-y-3">
            {/* 连接状态详情 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">连接状态</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">状态:</span>
                  <span className={statusConfig.color}>{statusConfig.label}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">网络:</span>
                  <span className={isOnline ? 'text-green-500' : 'text-red-500'}>
                    {isOnline ? '在线' : '离线'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">心跳间隔:</span>
                  <span className="text-gray-700">{heartbeatInterval / 1000}秒</span>
                </div>
                {lastHeartbeat && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">最后心跳:</span>
                    <span className="text-gray-700">{lastHeartbeat.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 连接提示 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">状态说明</h4>
              <div className="text-xs text-gray-600 space-y-1">
                {connectionState === 'connected' && (
                  <div>
                    <p>✅ 实时通信正常工作</p>
                    <p>✅ 数据同步及时</p>
                    <p>✅ 用户状态实时更新</p>
                  </div>
                )}
                {connectionState === 'connecting' && (
                  <div>
                    <p>🔄 正在建立实时连接</p>
                    <p>⏳ 请稍候...</p>
                  </div>
                )}
                {connectionState === 'reconnecting' && (
                  <div>
                    <p>🔄 检测到连接问题</p>
                    <p>🔄 正在尝试重新连接</p>
                    <p>⏳ 请保持网络连接</p>
                  </div>
                )}
                {connectionState === 'disconnected' && (
                  <div>
                    <p>❌ 实时通信已断开</p>
                    <p>📶 请检查网络连接</p>
                    <p>🔄 可尝试手动重连</p>
                  </div>
                )}
              </div>
            </div>

            {/* 重连按钮 */}
            {(connectionState === 'disconnected' || connectionState === 'reconnecting') && onReconnect && (
              <div className="pt-2 border-t">
                <button
                  onClick={onReconnect}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
                  disabled={connectionState === 'reconnecting'}
                >
                  <RotateCcw className={`w-4 h-4 ${connectionState === 'reconnecting' ? 'animate-spin' : ''}`} />
                  <span>{connectionState === 'reconnecting' ? '重连中...' : '重新连接'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 简化版连接状态指示器（用于导航栏等空间有限的地方）
export function ConnectionStatusMini({ 
  connectionState, 
  isOnline, 
  className = '' 
}: Pick<ConnectionStatusProps, 'connectionState' | 'isOnline' | 'className'>) {
  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500'
    
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
      case 'reconnecting':
        return 'bg-yellow-500'
      default:
        return 'bg-red-500'
    }
  }

  const getStatusLabel = () => {
    if (!isOnline) return '网络离线'
    
    switch (connectionState) {
      case 'connected':
        return '实时连接正常'
      case 'connecting':
        return '正在连接...'
      case 'reconnecting':
        return '重连中...'
      default:
        return '连接断开'
    }
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`} title={getStatusLabel()}>
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-xs text-gray-500">
        {connectionState === 'connected' && isOnline ? '实时' : '离线'}
      </span>
    </div>
  )
} 