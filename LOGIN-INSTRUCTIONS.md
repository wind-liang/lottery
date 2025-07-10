# 婚礼抽奖系统 - 密码登录系统

## 系统改动说明

系统已从原来的随机生成用户改为密码登录系统。现在用户需要使用预设密码才能进入系统。

## 数据库迁移

### 必需步骤：执行数据库迁移
在使用新系统前，**必须**先执行以下SQL语句到Supabase数据库：

```sql
-- 添加password字段到users表
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;

-- 清空现有用户数据（如果需要）
-- DELETE FROM users;

-- 插入预定义用户数据
INSERT INTO users (nickname, password, avatar_url, role, is_online) VALUES
('四岗', 'sigang6291', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
('超超', 'chaochao4878', 'https://windliangblog.oss-cn-beijing.aliyuncs.com/WechatIMG1290.jpg', 'audience', false),
-- ... 其他用户数据（见database-migration.sql文件）
ON CONFLICT (password) DO NOTHING;
```

完整的SQL语句请查看 `database-migration.sql` 文件。

## 预设用户账号

系统内置了以下用户账号：

### 真实用户
- 四岗 - 密码: `sigang6291`
- 超超 - 密码: `chaochao4878`
- 凯 - 密码: `kai6351`
- 黑鸭 - 密码: `heiya2250`
- 阿男 - 密码: `anan1644`
- 佳哥 - 密码: `jiage3397`
- 帅皇 - 密码: `shuaihuang1809`
- 东哥 - 密码: `dongge6549`
- 凡王 - 密码: `fanwang8768`
- 丁丁 - 密码: `dingding2364`
- 二亮 - 密码: `erliang1669`
- 鹏哥 - 密码: `pengge5373`
- 学亮 - 密码: `xueliang1665`
- 鱼子 - 密码: `yuzirry8232`
- 丹子 - 密码: `danzibyt2576`

### 测试用户
- 恭喜发财1 - 密码: `gongxifacai1`
- 恭喜发财2 - 密码: `gongxifacai2`
- ... 恭喜发财3-24 (密码格式: `gongxifacai[数字]`)

## 使用方法

1. 打开网站 http://localhost:3000
2. 输入上述任一密码
3. 点击"进入抽奖"按钮
4. 系统会自动登录对应的用户

## 主要改动

### 移除的功能
- ❌ 随机用户生成
- ❌ 用户设置界面（不再允许修改昵称和头像）
- ❌ 设置按钮

### 新增的功能
- ✅ 密码登录界面
- ✅ 预设用户数据
- ✅ 自动登录记忆功能

### 技术改动
- 数据库users表新增password字段
- 删除了GameLogic中的generateNickname和generateAvatarUrl函数
- 删除了UserSettings组件
- 重构了主页面的用户认证逻辑
- 更新了TypeScript类型定义

## 注意事项

1. **必须先执行数据库迁移**，否则系统无法正常工作
2. 用户无法再修改昵称和头像，所有信息都是预设的
3. 系统会记住用户的登录状态，下次访问时会自动登录
4. 如需重新登录其他账号，请清除浏览器localStorage或使用无痕模式

## 测试建议

1. 执行数据库迁移后启动应用
2. 尝试使用不同的密码登录
3. 验证登录后的用户信息是否正确
4. 测试抽奖功能是否正常工作
5. 验证实时通信功能是否正常 