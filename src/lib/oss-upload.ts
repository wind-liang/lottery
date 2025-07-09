// 阿里云OSS上传工具函数
import { getOSSConfig, generateFileName, validateImage, compressImage } from './oss-config'

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

// 动态导入OSS客户端
const createOSSClient = async () => {
  const config = getOSSConfig()
  
  // 检查配置是否完整
  if (!config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket) {
    throw new Error('OSS配置不完整，请检查环境变量设置')
  }

  // 动态导入ali-oss，只在客户端运行时加载
  const OSS = (await import('ali-oss')).default

  return new OSS({
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    endpoint: config.endpoint
  })
}

// 上传图片到OSS
export const uploadImageToOSS = async (
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  try {
    // 验证图片
    const validation = validateImage(file)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    // 压缩图片
    const compressedFile = await compressImage(file, 400, 0.8)

    // 生成文件名
    const fileName = generateFileName(compressedFile)

    // 创建OSS客户端（动态导入）
    const client = await createOSSClient()

    // 上传文件
    await client.multipartUpload(fileName, compressedFile, {
      progress: (p: number) => {
        const percent = Math.round(p * 100)
        
        if (onProgress) {
          onProgress({
            loaded: 0,
            total: compressedFile.size,
            percent
          })
        }
      }
    })

    // 构建访问URL
    const config = getOSSConfig()
    const url = `https://${config.bucket}.${config.region}.aliyuncs.com/${fileName}`
    
    return {
      success: true,
      url: url
    }
  } catch (error) {
    console.error('❌ 图片上传失败:', error)
    
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

// 删除OSS上的图片
export const deleteImageFromOSS = async (url: string): Promise<boolean> => {
  try {
    const client = await createOSSClient()
    const config = getOSSConfig()
    
    // 从URL中提取文件名
    const fileName = url.replace(`https://${config.bucket}.${config.region}.aliyuncs.com/`, '')
    
    await client.delete(fileName)
    return true
  } catch (error) {
    console.error('❌ 图片删除失败:', error)
    return false
  }
}

// 检查OSS配置是否可用
export const checkOSSConfig = (): { valid: boolean; error?: string } => {
  try {
    const config = getOSSConfig()
    
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