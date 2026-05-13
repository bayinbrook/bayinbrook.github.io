# GitHub 留言板

一个使用纯前端 + GitHub API 存储的留言板系统，无需后端服务器！

## 功能特性

- ✅ 发表留言（昵称、邮箱、内容）
- ✅ 上传图片（最多5张，自动上传到 GitHub）
- ✅ 留言分页浏览
- ✅ Gravatar 头像支持
- ✅ 响应式设计
- ✅ 图片点击放大查看
- ✅ 实时时间显示（刚刚、几分钟前等）

## 快速开始

### 1. 配置 GitHub 访问

1. 在 GitHub 创建 Personal Access Token (PAT):
   - 进入 GitHub Settings → Developer settings → Personal access tokens
   - 点击 "Generate new token (classic)"
   - 勾选 `repo` 权限（用于读写仓库）

2. 修改 `config.js` 中的配置：
   ```javascript
   const CONFIG = {
     TOKEN: "your-github-pat-token",
     OWNER: "your-username",
     REPO: "your-repo-name",
     MESSAGES_PATH: "messages.json",
     IMAGES_PATH: "images/",
     BASE_URL: "https://your-username.github.io/"
   };
   ```

### 2. 创建存储文件

在 GitHub 仓库中创建空的 `messages.json` 文件：

```json
[]
```

或者让程序自动创建（首次提交留言时会自动创建）。

### 3. 上传文件

将以下文件上传到你的 GitHub 仓库：
- `index.html`
- `style.css`
- `app.js`
- `config.js`

### 4. 启用 GitHub Pages

1. 进入仓库 Settings → Pages
2. Source 选择 `main` 分支和根目录
3. 点击 Save

## 项目结构

```
guestbook/
├── index.html    # 主页面
├── style.css     # 样式文件
├── app.js        # 核心逻辑
├── config.js     # 配置文件（需要修改）
└── README.md     # 说明文档
```

## 工作原理

1. **留言存储**: 使用 GitHub API 读写仓库中的 `messages.json` 文件
2. **图片上传**: 将图片转为 Base64，通过 GitHub Blobs API 存储到 `images/` 目录
3. **头像**: 使用 Gravatar 服务，通过邮箱哈希获取头像

## 注意事项

- GitHub PAT 权限需要 `repo` 权限
- 图片总大小建议控制在 1MB 以内
- 建议在 GitHub 仓库中创建 `.gitignore` 忽略 `images/` 目录的追踪
- 首次使用可能需要等待 GitHub Pages 构建完成

## 自定义

### 修改样式

编辑 `style.css` 文件，修改 CSS 变量即可改变主题色：

```css
:root {
  --primary: #4a90d9;
  --primary-dark: #3a7bc8;
  /* ... */
}
```

### 修改每页留言数

编辑 `config.js`：

```javascript
PAGE_SIZE: 20  // 改为你的数字
```

## License

MIT
