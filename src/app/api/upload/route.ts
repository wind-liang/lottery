import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToServerOSS, generateServerFileName, checkServerOSSConfig } from '@/lib/oss-server'

// 注意：服务端图片压缩需要使用专门的库，这里暂时跳过压缩

export async function POST(request: NextRequest) {
  try {
    console.log('📨 收到图片上传请求')
    
    // 检查OSS配置
    const ossConfig = checkServerOSSConfig()
    if (!ossConfig.valid) {
      return NextResponse.json({
        success: false,
        error: ossConfig.error || 'OSS配置错误'
      }, { status: 500 })
    }

    // 解析formData
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: '没有找到上传的文件'
      }, { status: 400 })
    }

    console.log('📄 接收到文件:', {
      name: file.name,
      type: file.type,
      size: file.size
    })

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: '请选择 JPG、PNG、GIF 或 WebP 格式的图片'
      }, { status: 400 })
    }

    // 验证文件大小
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: '图片大小不能超过 5MB'
      }, { status: 400 })
    }

    // 将文件转换为Buffer（简化处理，跳过压缩）
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // 生成文件名
    const fileName = generateServerFileName(file.name)
    console.log('📁 生成文件名:', fileName)

    // 上传到OSS
    const uploadResult = await uploadImageToServerOSS(fileBuffer, fileName)
    
    if (uploadResult.success) {
      console.log('✅ API上传成功:', uploadResult.url)
      return NextResponse.json({
        success: true,
        url: uploadResult.url
      })
    } else {
      console.error('❌ API上传失败:', uploadResult.error)
      return NextResponse.json({
        success: false,
        error: uploadResult.error
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ API处理错误:', error)
    
    const errorMessage = error instanceof Error ? error.message : '服务器内部错误'
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

// 支持OPTIONS请求（处理CORS预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
} 