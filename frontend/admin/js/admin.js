/* ============================================================
   Eitaa Admin Panel — SPA Frontend
   Premium Glass UI · RTL · Persian
   ============================================================ */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  var API_BASE = (location.protocol === 'http:' || location.protocol === 'https:')
    ? location.protocol + '//' + location.hostname + ':8000'
    : 'http://localhost:8000';

  var EP = {
    health:       API_BASE + '/api/health',
    conversations: API_BASE + '/api/admin/conversations',
    conversation:  function (id) { return API_BASE + '/api/admin/conversations/' + id; },
    // reply sends content as query parameter: /reply?content=text
    reply:         function (convId) { return API_BASE + '/api/admin/conversations/' + convId + '/reply'; },
  };

  /* ── State ──────────────────────────────────────────────── */
  var state = {
    conversations: [],
    selectedId: null,
    messages: [],
    loading: true,
    messagesLoading: false,
    sending: false,
    online: true,
    theme: localStorage.getItem('admin-theme') || 'light',
    searchQuery: '',
    viewMode: window.innerWidth > 768 ? 'desktop' : 'list',
    repliedIds: {},
  };

  /* ── API ────────────────────────────────────────────────── */
  function api(url, opts) {
    return fetch(url, Object.assign({
      headers: { 'Content-Type': 'application/json' },
    }, opts || {})).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return null; }).then(function (body) {
          var err = new Error((body && body.detail) || 'HTTP ' + r.status);
          err.status = r.status;
          throw err;
        });
      }
      return r.json();
    });
  }

  function checkHealth() {
    return api(EP.health).then(function () {
      state.online = true;
    }).catch(function () {
      state.online = false;
    });
  }

  function loadConversations() {
    state.loading = true;
    render();
    return api(EP.conversations).then(function (data) {
      state.conversations = Array.isArray(data) ? data : [];
      state.loading = false;
      render();
    }).catch(function (err) {
      state.loading = false;
      state.conversations = [];
      render();
      var msg = 'دریافت مکالمات با خطا مواجه شد';
      if (err.status === 500) msg = 'خطای سرور در دریافت مکالمات';
      toast(msg, 'error');
    });
  }

  function loadMessages(conversationId) {
    state.messagesLoading = true;
    state.messages = [];
    renderDetail();
    return api(EP.conversation(conversationId)).then(function (data) {
      state.messages = data.messages || [];
      state.messagesLoading = false;
      renderDetail();
      scrollMessagesBottom();
    }).catch(function (err) {
      state.messagesLoading = false;
      // Fallback: use messages from list data
      var conv = state.conversations.find(function (c) { return c.id === conversationId; });
      if (conv && conv.messages && conv.messages.length) {
        state.messages = conv.messages;
      } else {
        state.messages = [];
      }
      // 409 means conversation already answered - track it
      if (err.status === 409) {
        state.repliedIds[conversationId] = true;
      }
      renderDetail();
      if (err.status === 404) {
        toast('مکالمه یافت نشد', 'error');
      } else if (err.status === 409) {
        // already answered — silently handled via repliedIds
      } else if (err.status === 500) {
        toast('خطای سرور در دریافت پیام‌ها', 'error');
      } else {
        toast('دریافت پیام‌ها با خطا مواجه شد', 'error');
      }
    });
  }

  function replyToConversation(conversationId, content) {
    // Build URL with content as query parameter
    var url = EP.reply(conversationId) + '?content=' + encodeURIComponent(content);
    return api(url, { method: 'POST' }).then(function (data) {
      state.repliedIds[conversationId] = true;
      return data;
    });
  }

  /* ── Helpers ────────────────────────────────────────────── */
  function $(sel) { return document.querySelector(sel); }
  function $id(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var now = Date.now();
    var t = new Date(iso).getTime();
    var diff = Math.floor((now - t) / 1000);
    if (diff < 60) return 'اکنون';
    if (diff < 3600) return Math.floor(diff / 60) + ' دقیقه پیش';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ساعت پیش';
    var d = Math.floor(diff / 86400);
    if (d === 1) return 'دیروز';
    if (d < 7) return d + ' روز پیش';
    return new Date(iso).toLocaleDateString('fa-IR');
  }

  function formatTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var today = new Date();
    if (d.toDateString() === today.toDateString()) return 'امروز';
    var y = new Date(today);
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'دیروز';
    return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
  }

  function getConvPreview(conv) {
    if (!conv.messages || !conv.messages.length) return 'بدون پیام';
    var last = conv.messages[conv.messages.length - 1];
    var txt = last.content || '';
    return txt.length > 50 ? txt.substring(0, 50) + '...' : txt;
  }

  function getConvTime(conv) {
    if (!conv.messages || !conv.messages.length) return timeAgo(conv.created_at);
    var last = conv.messages[conv.messages.length - 1];
    return timeAgo(last.created_at);
  }

  function getConvStatus(conv) {
    if (state.repliedIds[conv.id]) return 'replied';
    if (conv.status === 'answered') return 'replied';
    if (!conv.messages || !conv.messages.length) return 'empty';
    var last = conv.messages[conv.messages.length - 1];
    return last.sender === 'user' ? 'pending' : 'replied';
  }

  function filteredConversations() {
    var q = state.searchQuery.trim();
    if (!q) return state.conversations;
    return state.conversations.filter(function (c) {
      var search = '#' + c.id + ' ' + getConvPreview(c);
      return search.indexOf(q) !== -1;
    });
  }

  /* ── Toast ──────────────────────────────────────────────── */
  function toast(msg, type) {
    var t = el('div', 'toast toast-' + (type || 'info'), esc(msg));
    var c = $id('toast-container');
    c.appendChild(t);
    setTimeout(function () { t.classList.add('hiding'); }, 3000);
    setTimeout(function () { t.remove(); }, 3300);
  }

  /* ── Render: Main Layout ────────────────────────────────── */
  function render() {
    var app = $id('app');
    app.innerHTML = ''
      + '<header class="admin-header">'
      +   '<div class="admin-header-right">'
      +     '<div class="admin-logo">'
      +       '<div class="admin-logo-icon">🛡</div>'
      +       '<span class="admin-logo-text">پنل مدیریت</span>'
      +       '<span class="admin-logo-badge">ADMIN</span>'
      +     '</div>'
      +     '<div class="admin-status">'
      +       '<span class="admin-status-dot' + (state.online ? '' : ' offline') + '"></span>'
      +       '<span>' + (state.online ? 'متصل' : 'قطع') + '</span>'
      +     '</div>'
      +   '</div>'
      +   '<div class="admin-header-left">'
      +     '<button class="theme-toggle" id="theme-toggle" title="تغییر تم">'
      +       (state.theme === 'dark' ? '☀️' : '🌙')
      +     '</button>'
      +   '</div>'
      + '</header>'
      + '<div class="admin-layout">'
      +   '<aside class="sidebar" id="sidebar"></aside>'
      +   '<main class="main-panel" id="main-panel"></main>'
      + '</div>';

    renderSidebar();
    renderDetail();
    bindEvents();
    applyViewMode();
  }

  /* ── Render: Sidebar ────────────────────────────────────── */
  function renderSidebar() {
    var sb = $id('sidebar');
    if (!sb) return;
    var convs = filteredConversations();
    var total = state.conversations.length;

    var pending = 0;
    state.conversations.forEach(function (c) {
      if (getConvStatus(c) === 'pending') pending++;
    });

    var html = ''
      + '<div class="sidebar-header">'
      +   '<div class="sidebar-title">مکالمات</div>'
      +   '<div class="sidebar-count">' + total + ' مکالمه' + (pending ? ' · ' + pending + ' منتظر پاسخ' : '') + '</div>'
      + '</div>'
      + '<div class="sidebar-search">'
      +   '<div class="sidebar-search-wrap">'
      +     '<span class="sidebar-search-icon">🔍</span>'
      +     '<input type="text" id="search-input" placeholder="جستجو..." value="' + esc(state.searchQuery) + '">'
      +   '</div>'
      + '</div>'
      + '<div class="sidebar-list" id="conv-list">';

    if (state.loading) {
      for (var i = 0; i < 6; i++) {
        html += ''
          + '<div class="skel-conv">'
          +   '<div class="skel-avatar skeleton"></div>'
          +   '<div class="skel-lines">'
          +     '<div class="skel-line skeleton"></div>'
          +     '<div class="skel-line skeleton"></div>'
          +     '<div class="skel-line skeleton"></div>'
          +   '</div>'
          + '</div>';
      }
    } else if (convs.length === 0) {
      html += ''
        + '<div class="empty-state">'
        +   '<div class="empty-icon">📭</div>'
        +   '<div class="empty-title">مکالمه‌ای یافت نشد</div>'
        +   '<div class="empty-desc">' + (state.searchQuery ? 'نتیجه‌ای برای جستجوی شما پیدا نشد.' : 'هیچ مکالمه‌ای برای پاسخ وجود ندارد.') + '</div>'
        + '</div>';
    } else {
      convs.forEach(function (c) {
        var status = getConvStatus(c);
        var isActive = c.id === state.selectedId;
        var statusLabel = status === 'pending' ? 'منتظر پاسخ' : (status === 'replied' ? 'پاسخ داده شده' : '');
        var statusClass = status;

        html += ''
          + '<div class="conv-item' + (isActive ? ' active' : '') + '" data-id="' + c.id + '">'
          +   '<div class="conv-avatar">' + c.id + '</div>'
          +   '<div class="conv-body">'
          +     '<div class="conv-top">'
          +       '<span class="conv-id">#' + c.id + '</span>'
          +       '<span class="conv-time">' + getConvTime(c) + '</span>'
          +     '</div>'
          +     '<div class="conv-preview">' + esc(getConvPreview(c)) + '</div>'
          +     '<div class="conv-bottom">'
          +       (statusLabel ? '<span class="conv-status ' + statusClass + '">' + statusLabel + '</span>' : '')
          +       (status === 'pending' ? '<span class="conv-unread"></span>' : '')
          +     '</div>'
          +   '</div>'
          + '</div>';
      });
    }

    html += '</div>';
    sb.innerHTML = html;

    // Re-bind sidebar events
    var searchInput = $id('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.searchQuery = this.value;
        renderSidebar();
      });
    }

    var items = sb.querySelectorAll('.conv-item[data-id]');
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        var id = parseInt(this.getAttribute('data-id'));
        selectConversation(id);
      });
    });
  }

  /* ── Render: Detail Panel ───────────────────────────────── */
  function renderDetail() {
    var mp = $id('main-panel');
    if (!mp) return;

    if (!state.selectedId) {
      mp.innerHTML = ''
        + '<div class="empty-state">'
        +   '<div class="empty-icon">💬</div>'
        +   '<div class="empty-title">یک مکالمه را انتخاب کنید</div>'
        +   '<div class="empty-desc">از لیست سمت راست یک مکالمه را انتخاب کنید تا پیام آن را مشاهده کنید.</div>'
        + '</div>';
      return;
    }

    var conv = state.conversations.find(function (c) { return c.id === state.selectedId; });
    var status = conv ? getConvStatus(conv) : 'empty';
    var statusLabel = status === 'pending' ? 'منتظر پاسخ' : (status === 'replied' ? 'پاسخ داده شده' : '');

    var headerHtml = ''
      + '<div class="detail-header">'
      +   '<div class="detail-header-right">'
      +     '<button class="detail-back" id="detail-back" title="بازگشت">➡</button>'
      +     '<span class="detail-conv-id">#' + state.selectedId + '</span>'
      +     (statusLabel ? '<span class="detail-conv-status ' + status + '">' + statusLabel + '</span>' : '')
      +   '</div>'
      + '</div>';

    var bodyHtml = '';

    if (state.messagesLoading) {
      bodyHtml = ''
        + '<div class="skel-msg">'
        +   '<div class="skel-msg-bubble skeleton"></div>'
        +   '<div class="skel-msg-bubble skeleton"></div>'
        +   '<div class="skel-msg-bubble skeleton"></div>'
        + '</div>';
    } else if (state.messages.length === 0) {
      bodyHtml = ''
        + '<div class="empty-state">'
        +   '<div class="empty-icon">📭</div>'
        +   '<div class="empty-title">پیامی وجود ندارد</div>'
        +   '<div class="empty-desc">این مکالمه هنوز پیامی ندارد.</div>'
        + '</div>';
    } else {
      bodyHtml = renderMessages();
    }

    var isAnswered = status === 'replied';
    var composerHtml = isAnswered
      ? '<div class="composer answered">'
      +   '<div class="composer-wrap">'
      +     '<textarea class="composer-input" id="composer-input" placeholder="پاسخ داده شده..." rows="1" disabled></textarea>'
      +     '<button class="composer-send" id="composer-send" disabled title="ارسال">'
      +       '<span class="send-icon">↑</span>'
      +     '</button>'
      +   '</div>'
      +   '<div class="composer-hint">این مکالمه قبلاً پاسخ داده شده است.</div>'
      + '</div>'
      : '<div class="composer">'
      +   '<div class="composer-wrap">'
      +     '<textarea class="composer-input" id="composer-input" placeholder="پاسخ خود را بنویسید..." rows="1"></textarea>'
      +     '<button class="composer-send" id="composer-send" disabled title="ارسال">'
      +       '<span class="send-icon">↑</span>'
      +     '</button>'
      +   '</div>'
      +   '<div class="composer-hint">Enter برای ارسال · Shift+Enter برای خط جدید</div>'
      + '</div>';

    mp.innerHTML = ''
      + headerHtml
      + '<div class="messages-area" id="messages-area">' + bodyHtml + '</div>'
      + composerHtml;

    var backBtn = $id('detail-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        state.viewMode = 'list';
        applyViewMode();
      });
    }

    var input = $id('composer-input');
    var sendBtn = $id('composer-send');
    if (input && sendBtn) {
      input.addEventListener('input', function () {
        sendBtn.disabled = !this.value.trim();
        autoResize(this);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
      sendBtn.addEventListener('click', function () { handleSend(); });
      scrollMessagesBottom();
    }
  }

  function renderMessages() {
    var html = '';
    var lastDate = '';
    state.messages.forEach(function (msg) {
      var msgDate = formatDate(msg.created_at);
      if (msgDate !== lastDate) {
        html += '<div class="date-separator"><span>' + msgDate + '</span></div>';
        lastDate = msgDate;
      }
      var isAdmin = msg.sender === 'admin';
      var wrapCls = isAdmin ? 'msg-admin-wrap' : 'msg-user-wrap';
      var bubCls  = isAdmin ? 'msg-admin-bubble' : 'msg-user-bubble';
      var txtCls  = isAdmin ? 'msg-admin-text' : 'msg-user-text';
      var metCls  = isAdmin ? 'msg-admin-meta' : 'msg-user-meta';
      var senderLabel = isAdmin ? '🛡 ادمین' : '👤 کاربر';
      html += ''
        + '<div class="' + wrapCls + '">'
        +   '<div class="' + bubCls + '">'
        +     '<div class="' + txtCls + '">' + esc(msg.content) + '</div>'
        +     '<div class="' + metCls + '">'
        +       '<span>' + formatTime(msg.created_at) + '</span>'
        +       '<span>' + senderLabel + '</span>'
        +     '</div>'
        +   '</div>'
        + '</div>';
    });
    return html;
  }

  function autoResize(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }

  function scrollMessagesBottom() {
    setTimeout(function () {
      var a = $id('messages-area');
      if (a) a.scrollTop = a.scrollHeight;
    }, 50);
  }

  function handleSend() {
    var input = $id('composer-input');
    if (!input || !input.value.trim() || state.sending) return;
    var content = input.value.trim();
    state.sending = true;
    renderSendState(content);
    replyToConversation(state.selectedId, content).then(function () {
      state.sending = false;
      input.value = '';
      input.style.height = 'auto';
      state.messages.push({
        id: Date.now(), conversation_id: state.selectedId,
        sender: 'admin', content: content, created_at: new Date().toISOString(),
      });
      renderSidebar();
      renderDetail();
      toast('پاسخ ارسال شد', 'success');
    }).catch(function (err) {
      state.sending = false;
      renderSendState('');
      var msg = 'خطا در ارسال پاسخ';
      if (err.status === 404) msg = 'مکالمه یافت نشد';
      else if (err.status === 409) msg = 'این مکالمه قبلاً پاسخ داده شده';
      else if (err.status === 500) msg = 'خطای سرور؛ لطفاً دوباره تلاش کنید';
      else if (err.message) msg = err.message;
      toast(msg, 'error');
    });
  }

  function renderSendState(content) {
    var btn = $id('composer-send');
    if (!btn) return;
    if (state.sending) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
    } else {
      btn.disabled = !content;
      btn.innerHTML = '<span class="send-icon">↑</span>';
    }
  }

  /* ── Selection & Navigation ──────────────────────────────── */
  function selectConversation(id) {
    state.selectedId = id;
    state.viewMode = 'detail';
    renderSidebar();
    renderDetail();
    applyViewMode();
    loadMessages(id);
  }

  function applyViewMode() {
    document.body.className = state.viewMode + '-view';
  }

  /* ── Theme ──────────────────────────────────────────────── */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('admin-theme', state.theme);
    var btn = $id('theme-toggle');
    if (btn) btn.innerHTML = state.theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  }

  /* ── Global Events ──────────────────────────────────────── */
  function bindEvents() {
    var themeBtn = $id('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  }

  /* ── Responsive ─────────────────────────────────────────── */
  function onResize() {
    var was = state.viewMode;
    if (window.innerWidth > 768) {
      state.viewMode = 'desktop';
    } else if (!state.selectedId) {
      state.viewMode = 'list';
    }
    if (was !== state.viewMode) applyViewMode();
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    applyTheme();
    document.body.className = 'list-view';
    render();
    checkHealth();
    loadConversations();
    window.addEventListener('resize', onResize);
    setInterval(checkHealth, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();