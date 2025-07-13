'use client'

import { useState } from 'react'

interface RefreshButtonProps {
  onRefresh: () => void
  className?: string
}

export function RefreshButton({ onRefresh, className = '' }: RefreshButtonProps) {
  const [isRotating, setIsRotating] = useState(false)

  const handleRefresh = () => {
    setIsRotating(true)
    onRefresh()
  }

  return (
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
  )
} 