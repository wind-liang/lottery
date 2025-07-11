'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']

interface LoginFormProps {
  onLoginSuccess: (user: User) => void
  onError: (error: string) => void
}

export function LoginForm({ onLoginSuccess, onError }: LoginFormProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password.trim()) {
      onError('请输入密码')
      return
    }

    setLoading(true)
    
    try {
      console.log('🔐 尝试登录，密码:', password)
      
      // 通过密码查找用户
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('password', password.trim())
        .single()

      if (error) {
        console.error('❌ 登录查询失败:', error)
        if (error.code === 'PGRST116') {
          onError('密码错误，请检查后重试')
        } else {
          onError('登录失败，请重试')
        }
        return
      }

      if (!user) {
        onError('密码错误，请检查后重试')
        return
      }

      console.log('✅ 登录成功:', user.nickname)
      
      // 将用户设置为在线状态
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ 
          is_online: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('⚠️ 更新在线状态失败:', updateError)
        // 即使更新失败也继续登录流程
        onLoginSuccess(user)
      } else {
        onLoginSuccess(updatedUser)
      }

      // 存储用户ID到localStorage用于自动登录
      localStorage.setItem('lottery_user_id', user.id)
      
    } catch (error) {
      console.error('❌ 登录异常:', error)
      onError('登录时发生错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center px-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">婚礼抽奖</h1>
          <p className="text-white/80">请输入您的专属密码</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
              登录密码
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent"
              placeholder="请输入您的密码"
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg border border-white/30 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>登录中...</span>
              </>
            ) : (
              <span>进入抽奖</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
} 