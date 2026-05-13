/**
 * GitHub 留言板
 * 留言存储：GitHub Issues（自动同步到 messages.json）
 * 图片存储：base64 编码在 JSON 中
 */

class Guestbook {
  constructor() {
    this.messages = [];
    this.currentPage = 1;
    this.selectedFiles = [];
    this.labels = ['留言'];

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
      'Accept': 'application/vnd.github.v3+json',
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

  // 加载留言（优先从 JSON 文件，fallback 到 Issues）
  async loadMessages() {
    const loadingEl = document.getElementById('loading');
    const messagesListEl = document.getElementById('messagesList');

    loadingEl.style.display = 'flex';
    messagesListEl.innerHTML = '';

    try {
      // 优先从 messages.json 加载（由 GitHub Action 同步）
      const data = await this.githubRequest(
        `/repos/${CONFIG.OWNER}/${CONFIG.REPO}/contents/messages.json`
      );

      const content = atob(data.content);
      this.messages = JSON.parse(content);

      // 按时间倒序
      this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      this.renderMessages();
    } catch (error) {
      // 如果 JSON 不存在，尝试从 Issues 加载
      console.log('messages.json not found, loading from Issues...');
      await this.loadFromIssues();
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  // 从 Issues 加载留言（备用）
  async loadFromIssues() {
    try {
      const issues = await this.githubRequest(
        `/repos/${CONFIG.OWNER}/${CONFIG.REPO}/issues?labels=留言&state=all&per_page=100`
      );

      const messageIssues = issues.filter(issue => !issue.pull_request);
      this.messages = messageIssues.map(issue => this.parseIssueToMessage(issue));

      this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      this.renderMessages();
    } catch (error) {
      this.showToast('加载留言失败', 'error');
      document.getElementById('messagesList').innerHTML =
        '<div class="empty-state"><div class="icon">😢</div><p>加载失败，请刷新重试</p></div>';
    }
  }

  // 解析 Issue 为留言对象
  parseIssueToMessage(issue) {
    try {
      const data = JSON.parse(issue.body);
      return {
        id: issue.id.toString(),
        issueNumber: issue.number,
        username: data.username || '匿名',
        email: data.email || '',
        content: data.content || '',
        images: data.images || [],
        timestamp: data.timestamp || issue.created_at
      };
    } catch (e) {
      return {
        id: issue.id.toString(),
        issueNumber: issue.number,
        username: issue.user?.login || '匿名',
        email: '',
        content: issue.body || issue.title,
        images: [],
        timestamp: issue.created_at
      };
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

  // 提交留言
  async addMessage(username, email, content) {
    // 图片转为 base64
    const images = [];
    for (const file of this.selectedFiles) {
      const base64 = await this.fileToBase64(file);
      images.push(base64);
    }

    const data = {
      username: username.trim(),
      email: email.trim(),
      content: content.trim(),
      images: images,
      timestamp: new Date().toISOString()
    };

    // 创建 Issue
    await this.githubRequest(
      `/repos/${CONFIG.OWNER}/${CONFIG.REPO}/issues`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: `留言 by ${username}`,
          body: JSON.stringify(data, null, 2),
          labels: this.labels
        })
      }
    );

    // 触发 GitHub Action 同步
    await this.triggerSync();

    // 重新加载
    await this.loadMessages();
    this.showToast('留言发表成功！', 'success');
  }

  // 触发 GitHub Action 同步
  async triggerSync() {
    try {
      await this.githubRequest(
        `/repos/${CONFIG.OWNER}/${CONFIG.REPO}/actions/workflows/sync-messages.yml/dispatches`,
        {
          method: 'POST',
          body: JSON.stringify({
            ref: 'main',
            inputs: { sync_all: 'true' }
          })
        }
      );
      console.log('Sync workflow triggered');
    } catch (error) {
      // 如果触发失败，忽略（用户刷新后也会更新）
      console.log('Sync trigger skipped, will refresh on next load');
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
