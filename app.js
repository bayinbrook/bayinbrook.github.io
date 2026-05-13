/**
 * GitHub 留言板 - 使用 GitHub Gist 存储
 * 无需 Token，留言存储在 GitHub Gist 中
 */

class Guestbook {
  constructor() {
    this.messages = [];
    this.currentPage = 1;
    this.selectedFiles = [];
    this.gistId = null; // 存储留言列表的 Gist ID

    this.init();
  }

  async init() {
    await this.loadMessages();
    this.bindEvents();
  }

  // GitHub Gist API 请求
  async gistRequest(endpoint, options = {}) {
    const url = `https://api.github.com${endpoint}`;
    const headers = {
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
      console.error('GitHub Gist API Error:', error);
      throw error;
    }
  }

  // 加载留言
  async loadMessages() {
    const loadingEl = document.getElementById('loading');
    const messagesListEl = document.getElementById('messagesList');

    loadingEl.style.display = 'flex';
    messagesListEl.innerHTML = '';

    try {
      // 获取所有用户的公开 Gist
      const gists = await this.gistRequest(`/users/${CONFIG.GIST_OWNER}/gists`);

      // 过滤出留言 Gist（描述以 "留言-" 开头）
      const messageGists = gists.filter(gist =>
        gist.description && gist.description.startsWith('留言-')
      );

      // 加载每条留言的内容
      this.messages = [];
      for (const gist of messageGists) {
        try {
          const gistData = await this.gistRequest(`/gists/${gist.id}`);
          const files = Object.values(gistData.files);
          if (files.length > 0) {
            const content = files[0].content;
            const message = JSON.parse(content);
            message.gistId = gist.id;
            this.messages.push(message);
          }
        } catch (e) {
          console.warn('Failed to load gist:', gist.id, e);
        }
      }

      // 按时间倒序
      this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      this.renderMessages();
    } catch (error) {
      this.showToast('加载留言失败: ' + error.message, 'error');
      messagesListEl.innerHTML = '<div class="empty-state"><div class="icon">😢</div><p>加载失败，请刷新重试</p></div>';
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  // 将文件转为 base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 创建留言 Gist
  async addMessage(username, email, content) {
    // 图片转为 base64
    const images = [];
    for (const file of this.selectedFiles) {
      const base64 = await this.fileToBase64(file);
      images.push(base64);
    }

    const message = {
      username: username.trim(),
      email: email.trim(),
      content: content.trim(),
      images: images,
      timestamp: new Date().toISOString()
    };

    // 创建 Gist
    const gist = await this.gistRequest('/gists', {
      method: 'POST',
      body: JSON.stringify({
        description: `留言-${username}`,
        public: true,
        files: {
          'message.json': {
            content: JSON.stringify(message, null, 2)
          }
        }
      })
    });

    message.gistId = gist.id;

    // 添加到列表开头
    this.messages.unshift(message);
    this.renderMessages();
    this.showToast('留言发表成功！', 'success');
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

    // 分页
    const totalPages = Math.ceil(this.messages.length / CONFIG.PAGE_SIZE);
    const start = (this.currentPage - 1) * CONFIG.PAGE_SIZE;
    const end = start + CONFIG.PAGE_SIZE;
    const pageMessages = this.messages.slice(start, end);

    messagesListEl.innerHTML = pageMessages.map(msg => this.renderMessageCard(msg)).join('');

    this.bindImageClickEvents();
    this.renderPagination(totalPages);
  }

  // 渲染单条留言
  renderMessageCard(msg) {
    const avatar = this.getAvatar(msg);
    const time = this.formatTime(msg.timestamp);

    return `
      <div class="message-card" data-id="${msg.gistId || msg.id}">
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

  // MD5
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
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let k = 0; k < bytes.length; k += 64) {
      const x = new Array(16);
      for (let i = 0; i < 16; i++) {
        x[i] = bytes[k + i] || 0;
      }
      a = addUnsigned(a, rotateLeft(addUnsigned(a, (b & c) | (~b & d)) + x[0] + 1518500249, 7));
      d = addUnsigned(d, rotateLeft(addUnsigned(d, (a & b) | (~a & c)) + x[1] + 1518500249, 12));
      c = addUnsigned(c, rotateLeft(addUnsigned(c, (d & a) | (~d & b)) + x[2] + 1518500249, 17));
      b = addUnsigned(b, rotateLeft(addUnsigned(b, (c & d) | (~c & a)) + x[3] + 1518500249, 19));
    }
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
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 分页
  renderPagination(totalPages) {
    const paginationEl = document.getElementById('pagination');
    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }
    let html = '';
    html += `<button ${this.currentPage === 1 ? 'disabled' : ''} onclick="guestbook.goToPage(${this.currentPage - 1})">上一页</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
        html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="guestbook.goToPage(${i})">${i}</button>`;
      } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
        html += '<span>...</span>';
      }
    }
    html += `<button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="guestbook.goToPage(${this.currentPage + 1})">下一页</button>`;
    paginationEl.innerHTML = html;
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.messages.length / CONFIG.PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    this.currentPage = page;
    this.renderMessages();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 绑定事件
  bindEvents() {
    document.getElementById('messageForm').addEventListener('submit', (e) => this.handleSubmit(e));
    document.getElementById('images').addEventListener('change', (e) => this.handleFileSelect(e));
    document.getElementById('refreshBtn').addEventListener('click', () => this.loadMessages());
  }

  // 表单提交
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
      await this.addMessage(username, email, content);
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

  // 文件选择
  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const previewContainer = document.getElementById('previewContainer');

    if (this.selectedFiles.length + files.length > 5) {
      this.showToast('最多只能上传5张图片', 'error');
      files.splice(5 - this.selectedFiles.length);
    }

    this.selectedFiles.push(...files);

    files.forEach((file) => {
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

    e.target.value = '';
  }

  removeFile(index) {
    this.selectedFiles.splice(index, 1);
    this.renderFilePreviews();
  }

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

  // 图片查看器
  bindImageClickEvents() {
    document.querySelectorAll('.message-images img').forEach(img => {
      img.addEventListener('click', () => this.showImageModal(img.src));
    });
  }

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

  // Toast
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
}

const guestbook = new Guestbook();
