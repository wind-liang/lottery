# 婚礼抽奖系统设置指南

## 第一步：初始化项目

项目已经初始化完成，包含以下功能：

- ✅ Next.js 14 项目结构
- ✅ TypeScript 配置
- ✅ Tailwind CSS 样式
- ✅ Supabase 客户端配置
- ✅ 基础 UI 组件
- ✅ 游戏逻辑框架

## 第二步：设置 Supabase

### 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com)
2. 创建新项目
3. 记录项目 URL 和 API 密钥

### 2. 创建数据库

在 Supabase 的 SQL 编辑器中运行 `supabase-schema.sql` 文件中的 SQL 语句。

### 3. 启用实时功能

在 Supabase Dashboard 中：
1. 进入 Database > Replication
2. 启用以下表的实时功能：
   - `users`
   - `rooms`
   - `lottery_participants`
   - `rewards`
   - `emojis`

## 第三步：配置环境变量

1. 复制 `env.example` 为 `.env.local`
2. 填入你的 Supabase 配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_HOST_PASSWORD=wedding2024
NEXT_PUBLIC_APP_NAME=婚礼抽奖系统
```

## 第四步：运行项目

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

项目将在 http://localhost:3000 启动。

## 第五步：测试功能

### 基础测试流程：

1. **打开多个浏览器标签页**模拟多用户
2. **测试用户角色切换**：
   - 点击自己的头像
   - 输入主持人密码（默认：wedding2024）
   - 成为主持人
3. **测试玩家设置**：
   - 主持人点击其他用户头像
   - 设置为玩家身份
4. **测试抽奖功能**：
   - 玩家点击"参与抽奖"
   - 主持人点击"开始抽奖"
   - 观察抽奖动画和结果
5. **测试表情功能**：
   - 点击右下角表情按钮
   - 选择表情发送

## 当前状态

### 已完成功能：
- [x] 项目初始化
- [x] 数据库设计
- [x] 基础 UI 组件
- [x] 用户身份管理
- [x] 抽奖箱功能
- [x] 表情系统
- [x] 实时同步

### 待完成功能：
- [ ] 奖励选择阶段
- [ ] 绝地翻盘阶段
- [ ] 完结阶段
- [ ] 动画效果优化
- [ ] 断线重连
- [ ] 移动端优化

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

## 常见问题

### Q: 无法连接到 Supabase？
A: 检查 `.env.local` 文件中的 URL 和 API 密钥是否正确。

### Q: 实时功能不工作？
A: 确保在 Supabase Dashboard 中启用了相关表的实时功能。

### Q: 主持人密码不正确？
A: 检查 `NEXT_PUBLIC_HOST_PASSWORD` 环境变量设置。

### Q: 页面显示错误？
A: 打开浏览器控制台查看具体错误信息。

## 技术支持

如需帮助，请检查：
1. 浏览器控制台错误
2. Supabase 项目日志
3. 网络连接状态

---

下一步请按照此指南设置项目并进行测试。测试完成后，我们将继续开发剩余功能。 