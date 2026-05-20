# 今晚吃什么 · 家庭晚餐助手

AI 驱动的家庭每周晚餐菜谱规划工具。

---

## 文件结构说明

```
dinner-planner/
├── api/
│   └── chat.js          ← 后端中转（保护 API Key，部署到 Vercel 后自动生效）
├── src/
│   ├── main.jsx         ← React 入口，不需要修改
│   └── App.jsx          ← 主界面代码
├── index.html           ← 网页入口，不需要修改
├── package.json         ← 项目依赖配置
├── vite.config.js       ← 构建工具配置
├── vercel.json          ← Vercel 路由配置
└── README.md            ← 本说明文件
```

---

## 部署步骤

### 第一步：安装 Node.js
前往 https://nodejs.org 下载安装（选 LTS 版本）

### 第二步：注册 GitHub 账号
前往 https://github.com 注册（免费）

### 第三步：上传代码到 GitHub
1. 登录 GitHub，点右上角 + → New repository
2. 仓库名填 dinner-planner，点 Create repository
3. 打开电脑终端（Mac 用 Terminal，Windows 用 cmd），运行：

```bash
cd 你存放这个文件夹的路径
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/你的用户名/dinner-planner.git
git push -u origin main
```

如不熟悉命令行，可下载 GitHub Desktop（图形界面）代替。

### 第四步：注册 Vercel 并部署
1. 前往 https://vercel.com，点 Sign Up → Continue with GitHub
2. 登录后点 Add New Project
3. 找到 dinner-planner 仓库，点 Import
4. 所有设置保持默认，点 Deploy
5. 等待约 1 分钟，部署完成 ✅

### 第五步：配置 API Key（必须）
1. 前往 https://console.anthropic.com 获取你的 API Key
2. 在 Vercel 项目页面，点顶部 Settings → 左侧 Environment Variables
3. 点 Add New，填写：
   - Name：ANTHROPIC_API_KEY
   - Value：你的 API Key（sk-ant-... 开头）
4. 点 Save
5. 回到 Deployments 页面，点 Redeploy 让配置生效

### 第六步：手机添加到主屏幕
Vercel 会给你一个类似 dinner-planner.vercel.app 的网址

- iPhone：用 Safari 打开 → 点底部分享按钮 → 添加到主屏幕
- Android：用 Chrome 打开 → 点右上角菜单 → 添加到主屏幕

---

## 本地开发（可选）

如果想在电脑上先预览效果：

```bash
# 安装依赖
npm install

# 创建本地环境变量文件
echo "ANTHROPIC_API_KEY=你的APIKey" > .env.local

# 启动开发服务器
npm run dev
```

浏览器打开 http://localhost:5173 即可预览。

---

## 常见问题

**Q：生成菜单时报错怎么办？**
检查 Vercel 后台的 ANTHROPIC_API_KEY 是否填写正确，注意不要有多余空格。

**Q：API Key 去哪里申请？**
前往 https://console.anthropic.com，注册后在 API Keys 页面创建。

**Q：会产生费用吗？**
Vercel 免费版对个人使用完全够用。Anthropic API 按使用量计费，每次生成菜单大约消耗 0.01-0.03 美元。
