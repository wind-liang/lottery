import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 })
    }

    console.log('🔄 [API] 设置用户离线状态:', userId)

    // 更新用户离线状态
    const { error } = await supabase
      .from('users')
      .update({ 
        is_online: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      console.error('❌ [API] 设置用户离线状态失败:', error)
      return NextResponse.json({ error: '更新用户状态失败' }, { status: 500 })
    }

    console.log('✅ [API] 用户离线状态设置成功')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ [API] 处理用户离线状态异常:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
} 