// 客户端图片上传工具
// 通过API接口上传图片，避免跨域问题

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

// 压缩图片（客户端处理）
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

// 上传图片到服务器
export const uploadImageToAPI = async (
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  try {
    console.log('🔄 开始上传图片到API...', file.name)
    
    // 验证图片
    const validation = validateImage(file)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    // 压缩图片
    console.log('🔄 压缩图片中...')
    const compressedFile = await compressImage(file, 400, 0.8)
    console.log('✅ 图片压缩完成', {
      原始大小: (file.size / 1024).toFixed(2) + 'KB',
      压缩后大小: (compressedFile.size / 1024).toFixed(2) + 'KB'
    })

    // 创建FormData
    const formData = new FormData()
    formData.append('file', compressedFile)

    // 创建XMLHttpRequest以支持进度监控
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      
      // 进度监控
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100)
          console.log(`📊 上传进度: ${percent}%`)
          
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent
          })
        }
      })
      
      // 响应处理
      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText)
          
          if (xhr.status === 200 && response.success) {
            console.log('✅ 图片上传成功:', response.url)
            resolve({
              success: true,
              url: response.url
            })
          } else {
            console.error('❌ 图片上传失败:', response.error)
            resolve({
              success: false,
              error: response.error || '上传失败'
            })
          }
        } catch (error) {
          console.error('❌ 解析响应失败:', error)
          resolve({
            success: false,
            error: '服务器响应解析失败'
          })
        }
      })
      
      // 错误处理
      xhr.addEventListener('error', () => {
        console.error('❌ 网络请求失败')
        resolve({
          success: false,
          error: '网络请求失败'
        })
      })
      
      // 超时处理
      xhr.addEventListener('timeout', () => {
        console.error('❌ 请求超时')
        resolve({
          success: false,
          error: '上传超时，请重试'
        })
      })
      
      // 配置请求
      xhr.timeout = 30000 // 30秒超时
      xhr.open('POST', '/api/upload')
      xhr.send(formData)
    })

  } catch (error) {
    console.error('❌ 图片上传失败:', error)
    
    let errorMessage = '上传失败'
    if (error instanceof Error) {
      errorMessage = `上传失败: ${error.message}`
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

// 检查上传功能是否可用
export const checkUploadAvailable = async (): Promise<{ available: boolean; error?: string }> => {
  try {
    // 调用检查API
    const response = await fetch('/api/upload/check')
    
    if (response.ok) {
      const data = await response.json()
      return {
        available: data.available,
        error: data.error
      }
    } else {
      return { available: false, error: '上传服务不可用' }
    }
  } catch {
    return { available: false, error: '无法连接到上传服务' }
  }
} 