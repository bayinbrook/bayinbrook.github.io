const https = require('https');

const TOKEN = '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';
const OWNER = 'bayinbrook';
const REPO = 'bayinbrook.github.io';

function githubRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const content = data ? JSON.stringify(data) : '';
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Guestbook'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(content);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(content);
    req.end();
  });
}

async function createFile(path, content, message) {
  // 先检查文件是否存在
  try {
    await githubRequest('GET', `/repos/${OWNER}/${REPO}/contents/${path}`);
    console.log(`${path} 已存在`);
    return;
  } catch (e) {
    if (e.status !== 404) {
      console.log(`${path} 检查失败:`, e.message || e);
      return;
    }
  }

  // 创建文件
  const encoded = Buffer.from(content).toString('base64');
  const result = await githubRequest('PUT', `/repos/${OWNER}/${REPO}/contents/${path}`, {
    message: message,
    content: encoded
  });

  if (result.commit) {
    console.log(`${path} 创建成功!`);
  } else {
    console.log(`${path} 创建失败:`, result.message);
  }
}

async function main() {
  console.log('开始初始化 GitHub 留言板...\n');
  
  // 创建 messages.json
  await createFile('messages.json', '[]', '初始化留言板数据');
  
  // 创建 images/.gitkeep
  await createFile('images/.gitkeep', '', '创建图片目录');
  
  console.log('\n完成！现在请将 index.html, style.css, app.js, config.js 上传到仓库。');
}

main().catch(console.error);
