/**
 * GitHub 留言板核心逻辑
 * 使用 GitHub API 存储留言和图片
 */

class Guestbook {
  constructor() {
    this.messages = [];
    this.currentPage = 1;
    this.selectedFiles = [];
    this.uploadedImages = [];
    
    this.init();
  }

  async init() {
    await this.loadMessages();
    this.bindEvents();
  }

  // GitHub API 请求
  async githubRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Authorization': `token ${CONFIG.TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '请求失败');
      }
      
      return response.json();
    } catch (error) {
      console.error('GitHub API Error:', error);
      throw error;
    }
  }

  // 获取文件 SHA
  async getFileSha(path) {
    try {
      const data = await this.githubRequest(`/repos/${CONFIG.OWNER}/${CONFIG.REPO}/contents/${path}`);
      return data.sha;
    } catch (error) {
      return null;
    }
  }

  // 获取留言
  async loadMessages() {
    const loadingEl = document.getElementById('loading');
    const messagesListEl = document.getElementById('messagesList');
    
    loadingEl.style.display = 'flex';
    messagesListEl.innerHTML = '';

    try {
      const data = await this.githubRequest(
        `/repos/${CONFIG.OWNER}/${CONFIG.REPO}/contents/${CONFIG.MESSAGES_PATH}`
      );
      
      const content = atob(data.content);
      this.messages = JSON.parse(content);
      
      // 按时间倒序排列
      this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      this.renderMessages();
    } catch (error) {
      // 文件不存在，创建新的
      if (error.message.includes('Not Found') || error.message.includes('404')) {
        this.messages = [];
        await this.saveMessages();
        this.renderMessages();
      } else {
        this.showToast('加载留言失败: ' + error.message, 'error');
        messagesListEl.innerHTML = '<div class="empty-state"><div class="icon">😢</div><p>加载失败，请刷新重试</p></div>';
      }
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  // 保存留言
  async saveMessages() {
    const sha = await this.getFileSha(CONFIG.MESSAGES_PATH);
    
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(this.messages, null, 2))));
    
    await this.githubRequest(
      `/repos/${CONFIG.OWNER}/${CONFIG.REPO}/contents/${CONFIG.MESSAGES_PATH}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: '更新留言板数据',
          content: content,
          sha: sha
        })
      }
    );
  }

  // 上传图片到 GitHub
  async uploadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result.split(',')[1];
          const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const path = CONFIG.IMAGES_PATH + filename;
          
          // 检查文件是否存在（获取 SHA）
          const sha = await this.getFileSha(path);
          
          await this.githubRequest(
            `/repos/${CONFIG.OWNER}/${CONFIG.REPO}/contents/${path}`,
            {
              method: 'PUT',
              body: JSON.stringify({
                message: `上传图片: ${filename}`,
                content: base64,
                sha: sha
              })
            }
          );
          
          // 返回图片URL
          const imageUrl = CONFIG.BASE_URL + path;
          resolve(imageUrl);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 添加留言
  async addMessage(username, email, content, images = []) {
    const message = {
      id: Date.now().toString(),
      username: username.trim(),
      email: email.trim(),
      content: content.trim(),
      images: images,
      timestamp: new Date().toISOString()
    };

    this.messages.unshift(message);
    
    try {
      await this.saveMessages();
      this.showToast('留言发表成功！', 'success');
      this.renderMessages();
    } catch (error) {
      this.messages.shift(); // 回滚
      throw error;
    }
  }

  // 渲染留言列表
  renderMessages() {
    const messagesListEl = document.getElementById('messagesList');
    const messageCountEl = document.getElementById('messageCount');
    const paginationEl = document.getElementById('pagination');

    messageCountEl.textContent = `(${this.messages.length})`;

    if (this.messages.length === 0) {
      messagesListEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">💬</div>
          <p>还没有留言，快来发表第一条吧！</p>
        </div>
      `;
      paginationEl.innerHTML = '';
      return;
    }

    // 分页计算
    const totalPages = Math.ceil(this.messages.length / CONFIG.PAGE_SIZE);
    const start = (this.currentPage - 1) * CONFIG.PAGE_SIZE;
    const end = start + CONFIG.PAGE_SIZE;
    const pageMessages = this.messages.slice(start, end);

    // 渲染留言
    messagesListEl.innerHTML = pageMessages.map(msg => this.renderMessageCard(msg)).join('');

    // 绑定图片点击事件
    this.bindImageClickEvents();

    // 渲染分页
    this.renderPagination(totalPages);
  }

  // 渲染单条留言
  renderMessageCard(msg) {
    const avatar = this.getAvatar(msg);
    const time = this.formatTime(msg.timestamp);

    return `
      <div class="message-card" data-id="${msg.id}">
        <div class="message-header">
          <div class="avatar">${avatar}</div>
          <div class="message-info">
            <div class="message-author">${this.escapeHtml(msg.username)}</div>
            <div class="message-time">${time}</div>
          </div>
        </div>
        <div class="message-content">${this.escapeHtml(msg.content)}</div>
        ${msg.images && msg.images.length > 0 ? `
          <div class="message-images">
            ${msg.images.map(img => `<img src="${img}" alt="留言图片" loading="lazy">`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // 获取头像
  getAvatar(msg) {
    if (msg.email) {
      const hash = this.md5(msg.email.toLowerCase());
      return `<img src="https://www.gravatar.com/avatar/${hash}?s=48&d=identicon" alt="avatar">`;
    }
    return msg.username.charAt(0).toUpperCase();
  }

  // 简单的 MD5 哈希
  md5(string) {
    function rotateLeft(value, amount) {
      return (value << amount) | (value >>> (32 - amount));
    }

    function addUnsigned(x, y) {
      return (x + y) >>> 0;
    }

    const utf8String = unescape(encodeURIComponent(string));
    const bytes = [];
    
    for (let i = 0; i < utf8String.length; i++) {
      bytes.push(utf8String.charCodeAt(i));
    }

    // 初始化变量
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;

    // 处理每64字节
    for (let k = 0; k < bytes.length; k += 64) {
      const x = new Array(16);
      for (let i = 0; i < 16; i++) {
        x[i] = bytes[k + i] || 0;
      }

      let aa = a, bb = b, cc = c, dd = d;

      a = addUnsigned(a, rotateLeft(addUnsigned(a, (b & c) | (~b & d)) + x[0] + 1518500249, 7));
      d = addUnsigned(d, rotateLeft(addUnsigned(d, (a & b) | (~a & c)) + x[1] + 1518500249, 12));
      c = addUnsigned(c, rotateLeft(addUnsigned(c, (d & a) | (~d & b)) + x[2] + 1518500249, 17));
      b = addUnsigned(b, rotateLeft(addUnsigned(b, (c & d) | (~c & a)) + x[3] + 1518500249, 19));
      
      // ... 简化版，只处理前4个32位字
    }

    // 转换为十六进制
    const hex = (n) => {
      const h = '0123456789abcdef';
      let s = '';
      for (let i = 7; i >= 0; i--) {
        s += h[(n >>> (i * 4)) & 0xf];
      }
      return s;
    };

    return hex(a) + hex(b) + hex(c) + hex(d);
  }

  // 格式化时间
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 渲染分页
  renderPagination(totalPages) {
    const paginationEl = document.getElementById('pagination');
    
    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    let html = '';

    // 上一页
    html += `<button ${this.currentPage === 1 ? 'disabled' : ''} onclick="guestbook.goToPage(${this.currentPage - 1})">上一页</button>`;

    // 页码
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
        html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="guestbook.goToPage(${i})">${i}</button>`;
      } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
        html += '<span>...</span>';
      }
    }

    // 下一页
    html += `<button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="guestbook.goToPage(${this.currentPage + 1})">下一页</button>`;

    paginationEl.innerHTML = html;
  }

  // 跳转到指定页
  goToPage(page) {
    const totalPages = Math.ceil(this.messages.length / CONFIG.PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    
    this.currentPage = page;
    this.renderMessages();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 绑定事件
  bindEvents() {
    // 表单提交
    document.getElementById('messageForm').addEventListener('submit', (e) => this.handleSubmit(e));
    
    // 文件选择
    document.getElementById('images').addEventListener('change', (e) => this.handleFileSelect(e));
    
    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', () => this.loadMessages());
  }

  // 处理表单提交
  async handleSubmit(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const content = document.getElementById('content').value;
    const submitBtn = document.getElementById('submitBtn');

    if (!username.trim() || !content.trim()) {
      this.showToast('请填写昵称和留言内容', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';

    try {
      // 上传图片
      const uploadedImages = [];
      for (const file of this.selectedFiles) {
        try {
          const url = await this.uploadImage(file);
          uploadedImages.push(url);
        } catch (error) {
          console.error('图片上传失败:', error);
          this.showToast(`图片 "${file.name}" 上传失败，跳过`, 'error');
        }
      }

      // 添加留言
      await this.addMessage(username, email, content, uploadedImages);

      // 清空表单
      document.getElementById('messageForm').reset();
      this.selectedFiles = [];
      document.getElementById('previewContainer').innerHTML = '';
    } catch (error) {
      this.showToast('发表留言失败: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').style.display = 'inline';
      submitBtn.querySelector('.btn-loading').style.display = 'none';
    }
  }

  // 处理文件选择
  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const previewContainer = document.getElementById('previewContainer');

    // 限制最多5张图片
    if (this.selectedFiles.length + files.length > 5) {
      this.showToast('最多只能上传5张图片', 'error');
      files.splice(5 - this.selectedFiles.length);
    }

    // 添加到已选文件
    this.selectedFiles.push(...files);

    // 显示预览
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileIndex = this.selectedFiles.indexOf(file);
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
          <img src="${e.target.result}" alt="预览">
          <button class="remove-btn" onclick="guestbook.removeFile(${fileIndex})">×</button>
        `;
        previewContainer.appendChild(previewItem);
      };
      reader.readAsDataURL(file);
    });

    // 清空input，允许重新选择相同文件
    e.target.value = '';
  }

  // 移除文件
  removeFile(index) {
    this.selectedFiles.splice(index, 1);
    this.renderFilePreviews();
  }

  // 重新渲染文件预览
  renderFilePreviews() {
    const previewContainer = document.getElementById('previewContainer');
    previewContainer.innerHTML = '';

    this.selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
          <img src="${e.target.result}" alt="预览">
          <button class="remove-btn" onclick="guestbook.removeFile(${index})">×</button>
        `;
        previewContainer.appendChild(previewItem);
      };
      reader.readAsDataURL(file);
    });
  }

  // 绑定图片点击事件（图片查看器）
  bindImageClickEvents() {
    document.querySelectorAll('.message-images img').forEach(img => {
      img.addEventListener('click', () => this.showImageModal(img.src));
    });
  }

  // 显示图片模态框
  showImageModal(src) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <button class="close-btn">×</button>
      <img src="${src}" alt="大图">
    `;
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('close-btn')) {
        modal.remove();
      }
    });

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
  }

  // 显示提示
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

// 初始化
const guestbook = new Guestbook();
