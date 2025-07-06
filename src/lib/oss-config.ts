// 阿里云OSS配置文件
// 请在环境变量中配置以下参数

export interface OSSConfig {
  region: string
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  endpoint?: string
}

export const getOSSConfig = (): OSSConfig => {
  return {
    region: process.env.NEXT_PUBLIC_OSS_REGION || '',
    accessKeyId: process.env.NEXT_PUBLIC_OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.NEXT_PUBLIC_OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.NEXT_PUBLIC_OSS_BUCKET || '',
    endpoint: process.env.NEXT_PUBLIC_OSS_ENDPOINT || undefined
  }
}

// 生成唯一的文件名
export const generateFileName = (file: File): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const extension = file.name.split('.').pop()
  return `avatars/${timestamp}-${random}.${extension}`
}

// 验证图片文件
export const validateImage = (file: File): { valid: boolean; error?: string } => {
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

// 压缩图片
export const compressImage = (file: File, maxWidth: number = 400, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // 计算压缩后的尺寸
      let { width, height } = img
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      if (height > maxWidth) {
        width = (width * maxWidth) / height
        height = maxWidth
      }

      canvas.width = width
      canvas.height = height

      // 绘制图片
      ctx?.drawImage(img, 0, 0, width, height)

      // 转换为Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            reject(new Error('图片压缩失败'))
          }
        },
        file.type,
        quality
      )
    }

    img.onerror = () => {
      reject(new Error('图片加载失败'))
    }

    img.src = URL.createObjectURL(file)
  })
} 