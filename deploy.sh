#!/bin/bash
# 部署留言板到 GitHub

REPO="bayinbrook.github.io"
BRANCH="main"
TOKEN="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"

# 创建 messages.json
echo "创建 messages.json..."
curl -X PUT "https://api.github.com/repos/bayinbrook/$REPO/contents/messages.json" \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "初始化留言板数据",
    "content": "W10="
  }'

echo ""
echo "创建 images 目录..."

# 创建 images/.gitkeep
curl -X PUT "https://api.github.com/repos/bayinbrook/$REPO/contents/images/.gitkeep" \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "创建图片目录",
    "content": ""
  }'

echo ""
echo "完成！现在可以将 index.html, style.css, app.js, config.js 上传到仓库了。"
