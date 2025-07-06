# 阿里云 OSS 配置指南

本应用支持上传自定义头像到阿里云 OSS 存储服务。通过 Next.js API 代理上传，避免跨域问题并保护敏感配置。

## 配置步骤

### 1. 创建阿里云 OSS 存储桶

1. 登录阿里云控制台
2. 进入对象存储 OSS 服务
3. 创建新的存储桶（Bucket）
4. 设置存储桶权限为 **公共读**（用于头像访问）

### 2. 获取访问凭证

1. 进入 RAM 访问控制
2. 创建用户并获取 AccessKey ID 和 AccessKey Secret
3. 为用户添加 OSS 相关权限

### 3. 配置环境变量

在 `.env.local` 文件中添加以下配置：

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# 主持人密码
NEXT_PUBLIC_HOST_PASSWORD=wedding2024

# 阿里云 OSS 配置 (服务端使用，不暴露到前端)
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=你的AccessKey_ID
OSS_ACCESS_KEY_SECRET=你的AccessKey_Secret
OSS_BUCKET=你的存储桶名称
OSS_ENDPOINT=你的端点地址
```

### 4. 参数说明

- **OSS_REGION**: OSS 区域，如 `oss-cn-hangzhou`
- **OSS_ACCESS_KEY_ID**: 访问密钥 ID
- **OSS_ACCESS_KEY_SECRET**: 访问密钥
- **OSS_BUCKET**: 存储桶名称
- **OSS_ENDPOINT**: OSS 端点（可选）

**注意**：OSS 配置现在使用服务端环境变量（没有 `NEXT_PUBLIC_` 前缀），保护敏感信息不暴露到前端。

### 5. 技术实现

#### 新的架构优势
- ✅ **避免跨域问题**：通过 Next.js API 代理上传
- ✅ **保护敏感信息**：OSS 凭证只在服务端使用
- ✅ **更好的安全性**：前端无法直接访问 OSS 配置
- ✅ **统一错误处理**：服务端统一处理上传错误

#### 上传流程
1. 前端选择图片并压缩
2. 通过 `/api/upload` 接口上传到服务器
3. 服务器验证文件并上传到阿里云 OSS
4. 返回图片访问URL给前端

### 6. 注意事项

- 确保存储桶权限设置为公共读，否则头像无法正常显示
- 建议为 OSS 用户设置最小权限，只允许对特定存储桶进行读写操作
- 前端会自动压缩图片到 400px 以内，格式支持 JPG、PNG、GIF、WebP
- 单个文件大小限制为 5MB
- 上传通过服务端代理，无跨域问题

## 功能说明

配置完成后，用户可以：

1. 在个人设置中选择"上传头像"选项卡
2. 选择本地图片文件
3. 实时预览和压缩图片
4. 查看上传进度
5. 通过 API 安全上传到阿里云 OSS
6. 上传成功后自动设置为头像

## API 接口

### 上传接口
- **路径**: `POST /api/upload`
- **参数**: FormData 包含 `file` 字段
- **返回**: `{ success: boolean, url?: string, error?: string }`

### 检查接口  
- **路径**: `GET /api/upload/check`
- **返回**: `{ available: boolean, error?: string }`

## 故障排查

如果上传失败，请检查：

1. 环境变量是否正确配置（注意移除了 `NEXT_PUBLIC_` 前缀）
2. 访问凭证是否有效
3. 存储桶权限是否正确
4. 网络连接是否正常
5. 图片格式和大小是否符合要求
6. 服务器日志中的具体错误信息

## 可选功能

如果不配置 OSS，用户仍然可以：

- 使用预设的头像选项
- 生成随机头像
- 自定义昵称

头像上传功能是完全可选的，不会影响核心抽奖功能的使用。 