// 服务端阿里云OSS配置和上传工具
// 只在服务端使用，保护敏感配置信息

export interface OSSConfig {
  region: string
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  endpoint?: string
}

export const getServerOSSConfig = (): OSSConfig => {
  return {
    region: process.env.OSS_REGION || '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
    endpoint: process.env.OSS_ENDPOINT || undefined
  }
}

// 生成唯一的文件名
export const generateServerFileName = (originalName: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split('.').pop()
  return `avatars/${timestamp}-${random}.${extension}`
}

// 验证图片文件
export const validateServerImage = (file: File): { valid: boolean; error?: string } => {
  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: '请选择 JPG、PNG、GIF 或 WebP 格式的图片'
    }
  }

  // 检查文件大小（最大5MB）
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: '图片大小不能超过 5MB'
    }
  }

  return { valid: true }
}

// 服务端上传图片到OSS
export const uploadImageToServerOSS = async (file: Buffer, fileName: string): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    const config = getServerOSSConfig()
    
    // 检查配置是否完整
    if (!config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket) {
      throw new Error('OSS配置不完整，请检查环境变量设置')
    }

    // 动态导入ali-oss
    const OSS = (await import('ali-oss')).default

    const client = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      endpoint: config.endpoint
    })

    // 上传文件
    console.log('🔄 服务端上传文件到OSS...', fileName)
    await client.put(fileName, file)
    
    // 构建访问URL
    const url = `https://${config.bucket}.${config.region}.aliyuncs.com/${fileName}`
    
    console.log('✅ 服务端上传成功:', url)
    
    return {
      success: true,
      url: url
    }
  } catch (error) {
    console.error('❌ 服务端上传失败:', error)
    
    let errorMessage = '上传失败'
    if (error instanceof Error) {
      if (error.message.includes('OSS配置不完整')) {
        errorMessage = 'OSS配置不完整，请联系管理员'
      } else if (error.message.includes('AccessDenied')) {
        errorMessage = 'OSS访问权限不足'
      } else if (error.message.includes('NoSuchBucket')) {
        errorMessage = 'OSS存储桶不存在'
      } else if (error.message.includes('RequestTimeout')) {
        errorMessage = '上传超时，请重试'
      } else {
        errorMessage = `上传失败: ${error.message}`
      }
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

// 检查服务端OSS配置是否可用
export const checkServerOSSConfig = (): { valid: boolean; error?: string } => {
  try {
    const config = getServerOSSConfig()
    
    if (!config.region) {
      return { valid: false, error: '缺少OSS区域配置' }
    }
    
    if (!config.accessKeyId) {
      return { valid: false, error: '缺少OSS访问密钥ID' }
    }
    
    if (!config.accessKeySecret) {
      return { valid: false, error: '缺少OSS访问密钥' }
    }
    
    if (!config.bucket) {
      return { valid: false, error: '缺少OSS存储桶名称' }
    }
    
    return { valid: true }
  } catch {
    return { valid: false, error: 'OSS配置检查失败' }
  }
} 