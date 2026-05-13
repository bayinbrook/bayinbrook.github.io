// 留言板配置文件
// 注意：请在页面上设置 Token（不会存储到文件中）

const CONFIG = {
  // GitHub 仓库信息（无需 Token）
  OWNER: "bayinbrook",
  REPO: "bayinbrook.github.io",

  // 留言数据存储路径
  MESSAGES_PATH: "messages.json",

  // 图片存储目录
  IMAGES_PATH: "images/",

  // GitHub Pages 基础URL (用于访问图片)
  BASE_URL: "https://bayinbrook.github.io/",

  // 每页显示留言数量
  PAGE_SIZE: 20
};

const API_BASE = "https://api.github.com";
