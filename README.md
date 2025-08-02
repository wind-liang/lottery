# 婚礼抽奖系统

这是一个基于 Next.js 和 Supabase 的移动端婚礼抽奖应用。

> 项目全程通过 Cursor 用自然语言开发，[过程记录](https://zhuanlan.zhihu.com/p/1934967911946101121)。

## 功能特点

- 🎲 多阶段抽奖流程
- 👥 用户身份管理（观众、主持人、玩家）
- 🎁 奖励选择系统
- 🎊 绝地翻盘机制
- 😊 表情交互
- 📱 移动端优化
- 🔄 实时同步

## 技术栈

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (数据库 & 实时通信)
- Framer Motion (动画)
- Lucide React (图标)

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd lottery2
```

### 2. 安装依赖

```bash
npm install
```

### 3. 环境变量配置

创建 `.env.local` 文件，并添加以下环境变量：

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# 主持人密码
NEXT_PUBLIC_HOST_PASSWORD=wedding2024

# 应用配置
NEXT_PUBLIC_APP_NAME=婚礼抽奖系统
```

### 4. 设置 Supabase 数据库

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 复制项目 URL 和匿名密钥到 `.env.local`
3. 在 Supabase SQL 编辑器中运行数据库脚本（稍后提供）

### 5. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

## 项目结构

```
src/
├── app/                 # App Router 页面
├── components/          # React 组件
├── lib/                 # 工具函数和配置
├── hooks/              # 自定义 React Hooks
├── types/              # TypeScript 类型定义
└── styles/             # 样式文件
```

## 游戏流程

1. **等待阶段**: 用户进入房间，选择身份
2. **抽奖阶段**: 确定参与者的抽奖顺序
3. **奖励选择阶段**: 按顺序选择奖励
4. **绝地翻盘阶段**: 最后5名参与终极抽奖
5. **完结阶段**: 庆祝动画和结果展示

## 开发说明

项目采用渐进式开发模式，每个功能模块独立开发和测试。

当前开发状态：
- [x] 项目初始化
- [ ] Supabase 配置
- [ ] 数据库设计
- [ ] 用户认证
- [ ] 实时通信
- [ ] UI 组件
- [ ] 游戏逻辑

## 许可证

MIT
