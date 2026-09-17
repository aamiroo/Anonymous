/* ============================================================
   Eitaa Anonymous Messaging — SPA Frontend
   Premium Glass UI · RTL · Persian
   ============================================================ */
(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────── */
  var API_BASE = 'http://localhost:8000';
  var EP = {
    login:       function(d) { return API_BASE + '/api/auth/login?init_data=' + encodeURIComponent(d); },
    sendNew:     function(uid, c) { return API_BASE + '/api/Messages/send?user_id=' + uid + '&content=' + encodeURIComponent(c); },
    sendReply:   function(cid, c) { return API_BASE + '/api/Messages/?conversation_id=' + cid + '&sender=user&content=' + encodeURIComponent(c); },
    convos:      function(uid) { return API_BASE + '/api/conversations/user/' + uid; },
    messages:    function(cid) { return API_BASE + '/api/Messages/' + cid; },
  };

  /* ── State ───────────────────────────────────────────────── */
  var state = {
    screen: 'splash',
    user: null,
    conversations: [],
    activeConvo: null,
    messages: [],
    loading: false,
    sending: false,
    isDev: !window.Eitaa,
    online: navigator.onLine,
    theme: localStorage.getItem('ea-theme') || 'light',
  };

  /* ── DOM ─────────────────────────────────────────────────── */
  var $ = function (s, p) { return (p || document).querySelector(s); };
  var app = $('#app');

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    applyTheme(state.theme);
    window.addEventListener('online', function() { state.online = true; updateConnection(); });
    window.addEventListener('offline', function() { state.online = false; updateConnection(); });
    if (state.isDev) {
      renderSplash();
      setTimeout(showDevLogin, 800);
    } else {
      renderSplash();
      setTimeout(authenticate, 800);
    }
  }

  /* ── Theme ───────────────────────────────────────────────── */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.content = t === 'dark' ? '#0c1222' : '#f8fafc';
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('ea-theme', state.theme);
    applyTheme(state.theme);
    var btn = $('.theme-toggle');
    if (btn) btn.innerHTML = state.theme === 'dark' ? '☀️' : '🌙';
  }

  /* ── Splash ──────────────────────────────────────────────── */
  function renderSplash() {
    state.screen = 'splash';
    app.innerHTML =
      '<div class="splash">' +
        '<div class="splash-icon">💌</div>' +
        '<div class="splash-title">پیام ناشناس</div>' +
        '<div class="splash-dots"><span></span><span></span><span></span></div>' +
      '</div>';
  }

  /* ── API Client ──────────────────────────────────────────── */
  function api(url, opts) {
    opts = opts || {};
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, 15000);
    opts.signal = ctrl.signal;
    return fetch(url, opts).then(function(res) {
      clearTimeout(tid);
      if (!res.ok) {
        return res.json().catch(function() { return {}; }).then(function(body) {
          var detail = body.detail;
          if (Array.isArray(detail)) {
            detail = detail.map(function(d) { return d.msg || d.detail || JSON.stringify(d); }).join(', ');
          }
          throw new Error(detail || 'خطای سرور (' + res.status + ')');
        });
      }
      return res.json();
    }).catch(function(e) {
      clearTimeout(tid);
      if (e.name === 'AbortError') throw new Error('اتصال با سرور قطع شد');
      if (!navigator.onLine) throw new Error('شما آفلاین هستید');
      throw e;
    });
  }

  /* ── Auth ────────────────────────────────────────────────── */
  function authenticate() {
    var initData = '';
    if (window.Eitaa && window.Eitaa.WebApp) {
      initData = window.Eitaa.WebApp.initData || '';
    }
    if (!initData) {
      showDevLogin();
      return;
    }
    api(EP.login(initData)).then(function(data) {
      state.user = data;
      localStorage.setItem('ea-user', JSON.stringify(data));
      showHome();
    }).catch(function() {
      showDevLogin();
    });
  }

  function showDevLogin() {
    state.screen = 'devLogin';
    app.innerHTML =
      '<div class="login-screen">' +
        '<div class="login-card glass">' +
          '<div class="login-icon">🔐</div>' +
          '<h2 class="login-title">ورود توسعه‌دهی</h2>' +
          '<p class="login-desc">برای تست، شناسه کاربری خود را وارد کنید</p>' +
          '<input type="number" id="dev-uid" class="login-input" placeholder="شناسه کاربری" inputmode="numeric">' +
          '<button id="dev-login-btn" class="login-btn">ورود</button>' +
          '<p class="login-note">در نسخه نهایی از Eitaa WebApp استفاده می‌شود</p>' +
        '</div>' +
      '</div>';
    var btn = $('#dev-login-btn');
    var input = $('#dev-uid');
    if (btn) btn.onclick = function() {
      var uid = parseInt(input.value);
      if (!uid || uid < 1) { toast('شناسه نامعتبر است', 'error'); return; }
      state.user = { id: uid, eitta_user_id: String(uid) };
      localStorage.setItem('ea-user', JSON.stringify(state.user));
      showHome();
    };
    if (input) {
      input.onkeydown = function(e) { if (e.key === 'Enter') btn.click(); };
      input.focus();
    }
  }

  /* ── Home ────────────────────────────────────────────────── */
  function showHome() {
    state.screen = 'home';
    state.activeConvo = null;
    state.messages = [];
    renderHome();
    loadConversations();
  }

  function renderHome() {
    app.innerHTML =
      renderHeader() +
      renderConnectionBar() +
      '<main class="main-content">' +
        renderHero() +
        renderComposeBox() +
        '<div class="section-title">پیام‌های اخیر</div>' +
        '<div id="conv-list" class="conv-list"></div>' +
      '</main>';
    bindHeaderEvents();
    bindComposeEvents();
  }

  function renderHeader() {
    return '<header class="header glass">' +
      '<div class="header-inner">' +
        '<div class="header-brand">' +
          '<div class="header-logo">ناشناس</div>' +
          '<div class="header-status">' +
            '<span class="status-dot' + (state.online ? '' : ' offline') + '"></span>' +
            '<span class="status-text">' + (state.online ? 'آنلاین' : 'آفلاین') + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="theme-toggle" aria-label="تغییر تم">' +
          (state.theme === 'dark' ? '☀️' : '🌙') +
        '</button>' +
      '</div>' +
    '</header>';
  }

  function renderConnectionBar() {
    return '<div class="connection-bar' + (state.online ? '' : ' visible') + '">' +
      '<span>⚠️ اینترنت قطع است</span>' +
    '</div>';
  }

  function renderHero() {
    return '<section class="hero fade-in">' +
      '<div class="hero-glow"></div>' +
      '<div class="hero-icon-wrap">' +
        '<div class="hero-icon">💌</div>' +
      '</div>' +
      '<h1 class="hero-title gradient-text">پیام ناشناس</h1>' +
      '<p class="hero-desc">پیامتو ناشناس بفرست. هیچ‌کس نمی‌فهمه کی فرستادی.</p>' +
    '</section>';
  }

  function renderComposeBox() {
    return '<div class="compose-section glass fade-in">' +
      '<div class="compose-label">💬 پیام جدید</div>' +
      '<div class="compose-row">' +
        '<textarea id="home-composer" class="compose-input" rows="1" placeholder="پیامت رو بنویس..." maxlength="2000"></textarea>' +
        '<button id="home-send" class="send-btn" disabled aria-label="ارسال">' +
          '<span class="send-icon">➤</span>' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function bindComposeEvents() {
    var textarea = $('#home-composer');
    var sendBtn = $('#home-send');
    if (!textarea || !sendBtn) return;

    textarea.addEventListener('input', function() {
      sendBtn.disabled = !textarea.value.trim();
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });

    sendBtn.addEventListener('click', function() { sendNewMessage(); });

    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (textarea.value.trim()) sendNewMessage();
      }
    });
  }

  function sendNewMessage() {
    var textarea = $('#home-composer');
    var sendBtn = $('#home-send');
    var content = textarea.value.trim();
    if (!content || state.sending) return;

    state.sending = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="send-spinner"></span>';

    api(EP.sendNew(state.user.id, content), { method: 'POST' }).then(function(data) {
      textarea.value = '';
      textarea.style.height = 'auto';
      state.sending = false;
      toast('پیام ارسال شد ✨', 'success');

      // Reload convos then open the new conversation
      return loadConversations().then(function() {
        var convo = state.conversations.find(function(c) { return c.id === data.conversation_id; });
        if (convo) openConversation(convo);
      });
    }).catch(function(e) {
      toast(e.message || 'خطا در ارسال پیام', 'error');
      state.sending = false;
    }).then(function() {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span class="send-icon">➤</span>';
      }
    });
  }

  /* ── Conversations ───────────────────────────────────────── */
  function loadConversations() {
    return api(EP.convos(state.user.id)).then(function(data) {
      state.conversations = data || [];
      renderConversations();
    }).catch(function(e) {
      toast('خطا در بارگذاری پیام‌ها', 'error');
    });
  }

  function renderConversations() {
    var el = $('#conv-list');
    if (!el) return;
    if (!state.conversations.length) {
      el.innerHTML = emptyStateHTML();
      return;
    }
    var html = '';
    state.conversations.forEach(function(c, i) {
      var lastMsg = c.messages && c.messages.length ? c.messages[c.messages.length - 1] : null;
      var preview = lastMsg ? lastMsg.content : 'بدون پیام';
      var time = lastMsg ? formatTime(lastMsg.created_at) : '';
      html += '<div class="conv-card glass fade-in" style="animation-delay:' + (i * 60) + 'ms" data-idx="' + i + '" tabindex="0" role="button">' +
        '<div class="conv-avatar">' +
          '<div class="conv-avatar-letter">' + (i + 1) + '</div>' +
        '</div>' +
        '<div class="conv-info">' +
          '<div class="conv-title">گفتگو #' + (c.id || (i + 1)) + '</div>' +
          '<div class="conv-preview">' + escapeHtml(preview) + '</div>' +
        '</div>' +
        '<div class="conv-meta">' +
          '<div class="conv-time">' + time + '</div>' +
          (lastMsg && lastMsg.sender === 'admin' ? '<div class="conv-unread-dot"></div>' : '') +
        '</div>' +
      '</div>';
    });
    el.innerHTML = html;
  }

  function openConversation(convo) {
    state.activeConvo = convo;
    state.screen = 'chat';
    renderChat();
    loadMessages(convo.id);
  }

  /* ── Chat ────────────────────────────────────────────────── */
  function renderChat() {
    app.innerHTML =
      renderChatHeader() +
      renderConnectionBar() +
      '<main class="chat-main">' +
        '<div id="chat-messages" class="chat-messages"></div>' +
      '</main>' +
      renderChatComposer();
    bindChatEvents();
    bindHeaderEvents();
  }

  function renderChatHeader() {
    var title = state.activeConvo ? 'گفتگو #' + state.activeConvo.id : 'گفتگو';
    return '<header class="header glass header-chat">' +
      '<div class="header-inner">' +
        '<button id="back-btn" class="header-back" aria-label="بازگشت">➡</button>' +
        '<div class="header-brand">' +
          '<div class="header-title">' + title + '</div>' +
          '<div class="header-status">' +
            '<span class="status-dot' + (state.online ? '' : ' offline') + '"></span>' +
            '<span class="status-text">ناشناس</span>' +
          '</div>' +
        '</div>' +
        '<button class="theme-toggle" aria-label="تغییر تم">' +
          (state.theme === 'dark' ? '☀️' : '🌙') +
        '</button>' +
      '</div>' +
    '</header>';
  }

  function renderChatComposer() {
    return '<div class="chat-composer glass">' +
      '<div class="composer-row">' +
        '<textarea id="chat-input" class="composer-input" rows="1" placeholder="پیامت رو بنویس..." maxlength="2000"></textarea>' +
        '<button id="chat-send" class="send-btn" disabled aria-label="ارسال">' +
          '<span class="send-icon">➤</span>' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function bindChatEvents() {
    var backBtn = $('#back-btn');
    if (backBtn) backBtn.onclick = function() { showHome(); };

    var textarea = $('#chat-input');
    var sendBtn = $('#chat-send');
    if (textarea) {
      textarea.addEventListener('input', function() {
        sendBtn.disabled = !textarea.value.trim();
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      });

      sendBtn.addEventListener('click', function() { sendChatReply(); });

      textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (textarea.value.trim()) sendChatReply();
        }
      });

      textarea.focus();
    }
  }

  function sendChatReply() {
    var textarea = $('#chat-input');
    var sendBtn = $('#chat-send');
    var content = textarea.value.trim();
    if (!content || state.sending || !state.activeConvo) return;

    state.sending = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="send-spinner"></span>';

    // Optimistic message
    var tempId = 'temp-' + Date.now();
    var tempMsg = { id: tempId, sender: 'user', content: content, created_at: new Date().toISOString() };
    state.messages.push(tempMsg);
    renderMessages();
    scrollToBottom();
    textarea.value = '';
    textarea.style.height = 'auto';

    // Reply to existing conversation
    api(EP.sendReply(state.activeConvo.id, content)).then(function() {
      state.sending = false;
      return loadMessages(state.activeConvo.id);
    }).catch(function(e) {
      state.messages = state.messages.filter(function(m) { return m.id !== tempId; });
      renderMessages();
      toast(e.message || 'خطا در ارسال', 'error');
      state.sending = false;
    }).then(function() {
      if (sendBtn) {
        sendBtn.innerHTML = '<span class="send-icon">➤</span>';
        sendBtn.disabled = !textarea.value.trim();
      }
    });
  }

  function loadMessages(cid) {
    return api(EP.messages(cid)).then(function(data) {
      state.messages = data || [];
      renderMessages();
      scrollToBottom();
    }).catch(function() {
      renderMessages();
    });
  }

  function renderMessages() {
    var el = $('#chat-messages');
    if (!el) return;
    if (!state.messages.length) {
      el.innerHTML = '<div class="chat-empty">' +
        '<div class="chat-empty-icon">💭</div>' +
        '<div class="chat-empty-text">هنوز پیامی نیست...</div>' +
        '<div class="chat-empty-hint">اولین پیام رو بفرست</div>' +
      '</div>';
      return;
    }

    var html = '';
    var lastDate = '';
    state.messages.forEach(function(m) {
      var msgDate = formatDate(m.created_at);
      if (msgDate !== lastDate) {
        html += '<div class="chat-date-divider"><span>' + msgDate + '</span></div>';
        lastDate = msgDate;
      }
      var isUser = m.sender === 'user';
      var cls = isUser ? 'msg msg-user' : 'msg msg-admin';
      html += '<div class="' + cls + '">' +
        '<div class="msg-bubble">' +
          '<div class="msg-text">' + escapeHtml(m.content) + '</div>' +
          '<div class="msg-time">' + formatTimeShort(m.created_at) + '</div>' +
        '</div>' +
      '</div>';
    });
    el.innerHTML = html;
    scrollToBottom();
  }

  /* ── Event Listeners ─────────────────────────────────────── */
  function bindHeaderEvents() {
    var themeBtn = $('.theme-toggle');
    if (themeBtn) themeBtn.onclick = toggleTheme;
  }

  document.addEventListener('click', function(e) {
    var card = e.target.closest('.conv-card');
    if (card) {
      var idx = parseInt(card.getAttribute('data-idx'));
      if (state.conversations[idx]) openConversation(state.conversations[idx]);
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      var card = e.target.closest('.conv-card');
      if (card) { e.preventDefault(); card.click(); }
    }
  });

  /* ── Helpers ─────────────────────────────────────────────── */
  function scrollToBottom() {
    requestAnimationFrame(function() {
      var el = $('#chat-messages');
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  function updateConnection() {
    var dot = $('.status-dot');
    if (dot) { if (state.online) dot.classList.remove('offline'); else dot.classList.add('offline'); }
    var bar = $('.connection-bar');
    if (bar) { if (state.online) bar.classList.remove('visible'); else bar.classList.add('visible'); }
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatTime(iso) {
    try {
      var d = new Date(iso);
      var now = new Date();
      var diffMs = now - d;
      var diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'الان';
      if (diffMin < 60) return diffMin + ' دقیقه پیش';
      var diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return diffH + ' ساعت پیش';
      return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function formatTimeShort(iso) {
    try { return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      var now = new Date();
      if (d.toDateString() === now.toDateString()) return 'امروز';
      var y = new Date(now); y.setDate(y.getDate() - 1);
      if (d.toDateString() === y.toDateString()) return 'دیروز';
      return d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function emptyStateHTML() {
    return '<div class="empty-state">' +
      '<div class="empty-icon">💬</div>' +
      '<div class="empty-title">هنوز پیامی نفرستادی</div>' +
      '<div class="empty-desc">از کادر بالا اولین پیام ناشناس رو بفرست.</div>' +
    '</div>';
  }

  function toast(msg, type) {
    type = type || 'info';
    var c = $('#toast-container');
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<span>' + escapeHtml(msg) + '</span>';
    c.appendChild(el);
    setTimeout(function() {
      el.classList.add('hiding');
      setTimeout(function() { el.remove(); }, 300);
    }, 3500);
  }

  /* ── Boot ────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
