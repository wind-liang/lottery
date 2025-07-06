import { NextResponse } from 'next/server'
import { checkServerOSSConfig } from '@/lib/oss-server'

export async function GET() {
  try {
    const ossConfig = checkServerOSSConfig()
    
    return NextResponse.json({
      available: ossConfig.valid,
      error: ossConfig.error
    })
  } catch (error) {
    console.error('检查上传配置失败:', error)
    
    return NextResponse.json({
      available: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
} 