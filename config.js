# 留言板配置文件
# 请根据您的GitHub信息修改以下配置

const CONFIG = {
  // GitHub Personal Access Token (需要 repo 权限)
  TOKEN: "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",
  
  // GitHub 仓库信息
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
