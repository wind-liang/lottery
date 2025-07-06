'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, Check, AlertCircle } from 'lucide-react'
import { uploadImageToAPI, checkUploadAvailable } from '@/lib/upload-client'
import type { UploadProgress } from '@/lib/upload-client'

interface ImageUploadProps {
  onUploadSuccess: (url: string) => void
  onUploadError: (error: string) => void
  className?: string
}

export function ImageUpload({ onUploadSuccess, onUploadError, className = '' }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [uploadAvailable, setUploadAvailable] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 检查上传功能是否可用
  useEffect(() => {
    const checkAvailability = async () => {
      const result = await checkUploadAvailable()
      setUploadAvailable(result.available)
      if (!result.available) {
        setUploadError(result.error || '上传功能不可用')
      }
    }
    
    checkAvailability()
  }, [])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('请选择 JPG、PNG、GIF 或 WebP 格式的图片')
      return
    }

    // 检查文件大小
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setError('图片大小不能超过 5MB')
      return
    }

    setSelectedFile(file)
    setError(null)

    // 创建预览URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    if (!uploadAvailable) {
      setError(uploadError || '上传功能不可用')
      onUploadError(uploadError || '上传功能不可用')
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const result = await uploadImageToAPI(selectedFile, (progress: UploadProgress) => {
        setUploadProgress(progress.percent)
      })

      if (result.success && result.url) {
        console.log('✅ 图片上传成功:', result.url)
        onUploadSuccess(result.url)
        handleClear()
      } else {
        setError(result.error || '上传失败')
        onUploadError(result.error || '上传失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败'
      setError(errorMessage)
      onUploadError(errorMessage)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setError(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 上传功能检查 */}
      {!uploadAvailable && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              {uploadError}
            </p>
          </div>
        </div>
      )}

      {/* 文件选择区域 */}
      {!selectedFile && (
        <div
          onClick={handleClick}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">点击选择图片</p>
          <p className="text-sm text-gray-500">
            支持 JPG、PNG、GIF、WebP 格式，最大 5MB
          </p>
        </div>
      )}

      {/* 预览区域 */}
      {selectedFile && previewUrl && (
        <div className="space-y-4">
          <div className="relative inline-block">
            <img
              src={previewUrl}
              alt="预览"
              className="w-32 h-32 object-cover rounded-lg border border-gray-200"
            />
            <button
              onClick={handleClear}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-sm text-gray-600">
            <p>文件名: {selectedFile.name}</p>
            <p>大小: {(selectedFile.size / 1024).toFixed(2)} KB</p>
          </div>

          {/* 上传进度 */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>上传中...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex space-x-2">
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadAvailable}
              className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>上传中...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>上传图片</span>
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 