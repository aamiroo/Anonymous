/* ============================================================
   ناشناس — Anonymous Messaging · «نامهٔ بی‌نام» (SPA)
   The Nameless Letter. Connects to the existing FastAPI
   backend; API contract unchanged.
   ============================================================ */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  var API_BASE = window.EA_API_BASE || (
    (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : location.protocol + '//' + location.hostname + ':8000'
  );

  var USER_KEY = 'nl-user';
  var THEME_KEY = 'nl-theme';

  var EP = {
    login:      function (d) { return API_BASE + '/api/auth/login?init_data=' + encodeURIComponent(d); },
    sendNew:    function (uid, c) { return API_BASE + '/api/Messages/send?user_id=' + uid + '&content=' + encodeURIComponent(c); },
    reply:      function (cid, c) { return API_BASE + '/api/Messages/?conversation_id=' + cid + '&sender=user&content=' + encodeURIComponent(c); },
    convos:     function (uid) { return API_BASE + '/api/conversations/user/' + uid; },
    convo:      function (cid) { return API_BASE + '/api/conversations/' + cid; },
  };

  /* ── State ──────────────────────────────────────────────── */
  var state = {
    screen: 'boot',            // boot | login | home | chat
    user: null,
    conversations: [],
    activeConvo: null,
    messages: [],
    notices: { convLoading: false, msgsLoading: false, sending: false },
    online: navigator.onLine,
    theme: localStorage.getItem(THEME_KEY) || 'light',
    hasEitaa: !!(window.Eitaa && window.Eitaa.WebApp && window.Eitaa.WebApp.initData),
    timers: null,
  };

  var $  = function (s, p) { return (p || document).querySelector(s); };
  var $$ = function (s, p) { return Array.prototype.slice.call((p || document).querySelectorAll(s)); };
  var app = $('#app');

  /* ── Veil emblem ────────────────────────────────────────── */
  function veil(seed, cls) {
    seed = seed || 0;
    var rot = ((seed * 37) % 5) * 12 - 24;
    return '<svg class="anon-mark' + (cls ? ' ' + cls : '') + '" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      '<rect class="am-tile" x="2.5" y="2.5" width="43" height="43" rx="13"/>' +
      '<g style="transform:rotate(' + rot + 'deg); transform-origin:24px 24px">' +
      '<rect class="am-veil" x="11" y="18.5" width="26" height="4.6" rx="2.3"/>' +
      '<rect class="am-eye" x="15.5" y="25.5" width="5.2" height="7" rx="2.6"/>' +
      '<rect class="am-eye" x="27.3" y="25.5" width="5.2" height="7" rx="2.6"/>' +
      '</g></svg>';
  }

  function icon(name) {
    var paths = {
      send:    '<path d="M12 16.5V4M6.5 8.5 12 3l5.5 5.5"/><path d="M4.5 13.5 6.8 19a1.4 1.4 0 0 0 1.3.9h7.8a1.4 1.4 0 0 0 1.3-.9l2.3-5.5"/>',
      back:    '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
      moon:    '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>',
      sun:     '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
      clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      quill:   '<path d="M20 4c1 1.4.6 3.6-1 5.4L8 20l-4 1 1-4L16 5c1.6-1.6 3.7-2 5-1z"/><path d="M14 8l2 2"/>',
      eye:     '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
      eyeOff:  '<path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-2.4 3.4M6.3 6.3A17.7 17.7 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 4.6-1.1M4 4l16 16"/>',
      retry:   '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  /* ── Utils ──────────────────────────────────────────────── */
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function faNum(n) {
    try { return Number(n).toLocaleString('fa-IR'); } catch (e) { return String(n); }
  }

  function fmtTime(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function fmtDay(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso), now = new Date();
      if (d.toDateString() === now.toDateString()) return 'امروز';
      var y = new Date(now); y.setDate(y.getDate() - 1);
      if (d.toDateString() === y.toDateString()) return 'دیروز';
      return d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });
    } catch (e) { return ''; }
  }
  function fmtRel(iso) {
    if (!iso) return '';
    try {
      var t = new Date(iso).getTime(), diff = Math.max(0, (Date.now() - t) / 1000);
      if (diff < 60) return 'اکنون';
      if (diff < 3600) return faNum(Math.floor(diff / 60)) + ' دقیقه پیش';
      if (diff < 86400) return faNum(Math.floor(diff / 3600)) + ' ساعت پیش';
      var d = Math.floor(diff / 86400);
      if (d === 1) return 'دیروز';
      if (d < 7) return faNum(d) + ' روز پیش';
      return fmtDay(iso);
    } catch (e) { return ''; }
  }

  function convAnswered(c) {
    if (c.status === 'answered') return true;
    var msgs = c.messages || [];
    if (!msgs.length) return false;
    return msgs[msgs.length - 1].sender === 'admin';
  }
  function convPreview(c) {
    var msgs = c.messages || [];
    if (!msgs.length) return 'هنوز پیامی فرستاده نشده';
    return msgs[msgs.length - 1].content || '';
  }
  function convTime(c) {
    var msgs = c.messages || [];
    if (!msgs.length) return fmtRel(c.created_at);
    return fmtRel(msgs[msgs.length - 1].created_at);
  }

  /* ── API client ─────────────────────────────────────────── */
  function api(url, opts) {
    opts = opts || {};
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, 20000);
    opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (res) {
      clearTimeout(tid);
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) {
          var detail = body.detail;
          if (Array.isArray(detail)) detail = detail.map(function (d) { return d.msg || d.detail || ''; }).join('، ');
          var err = new Error(detail || ('خطای سرور (' + res.status + ')'));
          err.status = res.status;
          throw err;
        }
        return body;
      });
    }).catch(function (e) {
      clearTimeout(tid);
      if (e.name === 'AbortError') throw new Error('اتصال با سرور قطع شد');
      if (!navigator.onLine) throw new Error('شما آفلاین هستید');
      throw e;
    });
  }

  /* ── Toast ──────────────────────────────────────────────── */
  function toast(msg, type) {
    type = type || 'info';
    var box = $('#toast-container');
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', 'status');
    el.innerHTML = '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('hiding');
      setTimeout(function () { el.remove(); }, 280);
    }, 3600);
  }

  /* ── Theme ──────────────────────────────────────────────── */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var meta = $('meta[name="theme-color"]:not([media])');
    if (meta) meta.content = t === 'dark' ? '#191611' : '#f3efe6';
    var btn = $('.theme-toggle');
    if (btn) btn.innerHTML = t === 'dark' ? icon('sun') : icon('moon');
  }
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, state.theme);
    applyTheme(state.theme);
  }

  /* ── Connection ─────────────────────────────────────────── */
  function setOnline(v) {
    state.online = v;
    var dots = $$('.status-dot');
    dots.forEach(function (d) { d.textContent = ''; d.classList.toggle('offline', !v); });
    var bar = $('.offline-bar');
    if (bar) bar.classList.toggle('visible', !v);
  }

  /* ── Boot / Auth ────────────────────────────────────────── */
  function init() {
    applyTheme(state.theme);
    setOnline(state.online);
    window.addEventListener('online', function () { setOnline(true); });
    window.addEventListener('offline', function () { setOnline(false); });
    renderSplash();
    if (state.hasEitaa) {
      authenticate();
    } else {
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { saved = null; }
      if (saved && saved.id) {
        state.user = saved;
        showHome();
      } else {
        setTimeout(showDevLogin, 650);
      }
    }
  }

  function authenticate() {
    var initData = window.Eitaa && window.Eitaa.WebApp ? (window.Eitaa.WebApp.initData || '') : '';
    if (!initData) { showDevLogin(); return; }
    api(EP.login(initData)).then(function (data) {
      state.user = data;
      localStorage.setItem(USER_KEY, JSON.stringify(data));
      showHome();
    }).catch(function () {
      showDevLogin();
    });
  }

  /* ── Splash ─────────────────────────────────────────────── */
  function renderSplash() {
    state.screen = 'boot';
    app.classList.remove('chat-mode');
    app.innerHTML =
      '<div class="splash-screen">' +
        '<div class="splash-seal">' + veil(0, 'am-solid') + '</div>' +
        '<h1 class="splash-name">ناشناس</h1>' +
        '<p class="splash-tag">پیامت را بی‌نام بفرست</p>' +
        '<div class="splash-dots"><span></span><span></span><span></span></div>' +
      '</div>';
    window.scrollTo(0, 0);
  }

  /* ── Dev login (only when Eitaa is not present) ─────────── */
  function showDevLogin() {
    state.screen = 'login';
    app.classList.remove('chat-mode');
    app.innerHTML =
      '<div class="dev-login">' +
        '<div class="dev-card">' +
          '<div class="dev-seal">' + veil(0, 'am-solid') + '</div>' +
          '<h1 class="dev-title">ورود آزمایشی</h1>' +
          '<p class="dev-desc">در محیط غیر از ایتا، شناسه‌ی کاربری‌ات را وارد کن. در نسخهٔ اصلی، ورود از طریق Eitaa انجام می‌شود.</p>' +
          '<input type="number" id="dev-uid" class="field" placeholder="شناسه کاربری" inputmode="numeric" aria-label="شناسه کاربری">' +
          '<button id="dev-login-btn" class="btn btn-primary" style="width:100%;margin-top:14px">ورود</button>' +
          '<p class="dev-note">کاربری که وارد می‌شود همان «شخص ناشناس» است</p>' +
        '</div>' +
      '</div>';
    var btn = $('#dev-login-btn');
    var input = $('#dev-uid');
    function enter() {
      var uid = parseInt(input.value, 10);
      if (!uid || uid < 1) { toast('شناسه نامعتبر است', 'error'); return; }
      state.user = { id: uid, eitaa_user_id: String(uid) };
      localStorage.setItem(USER_KEY, JSON.stringify(state.user));
      showHome();
    }
    if (btn) btn.addEventListener('click', enter);
    if (input) {
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') enter(); });
      input.focus();
    }
  }

  /* ── Home ───────────────────────────────────────────────── */
  function showHome() {
    state.screen = 'home';
    state.activeConvo = null;
    state.messages = [];
    clearTimers();
    app.classList.remove('chat-mode');
    renderHome();
    loadConversations(true);
    state.timers = setInterval(function () { loadConversations(false); }, 15000);
  }

  function renderHome() {
    app.innerHTML =
      '<header class="topbar">' +
        '<div class="topbar-in">' +
          '<div class="brand">' +
            '<span class="brand-seal">' + veil(0, 'am-solid') + '</span>' +
            '<span class="brand-name">ناشناس</span>' +
            '<span class="brand-status"><span class="dot status-dot"></span><span class="status-text">' + (state.online ? 'متصل' : 'آفلاین') + '</span></span>' +
          '</div>' +
          '<button class="icon-btn theme-toggle" aria-label="تغییر تم"></button>' +
        '</div>' +
      '</header>' +
      '<div class="offline-bar"><span>' + icon('eyeOff') + 'اتصال اینترنت برقرار نیست</span></div>' +
      '<main class="page">' +
        '<section class="hero">' +
          '<div class="hero-seal">' + veil(state.user ? state.user.id : 1, 'am-solid') + '</div>' +
          '<span class="kicker">' + icon('quill') + 'مکاتبهٔ بی‌نام</span>' +
          '<h1 class="hero-title">حرف تو، بدون نشان</h1>' +
          '<p class="hero-sub">پیامت را بنویس؛ بدون نام می‌ماند و پاسخِ مدیر، محرمانه به همین گفتگو برمی‌گردد.</p>' +
        '</section>' +
        '<section class="compose-card" aria-label="پیام ناشناس جدید">' +
          '<div class="compose-head">' +
            '<span class="compose-title">' + icon('quill') + 'پیام ناشناس جدید</span>' +
            '<span class="compose-cap">تا ۲۰۰۰ حرف</span>' +
          '</div>' +
          '<div class="compose-line">' +
            '<textarea id="home-composer" class="composer-input" rows="1" placeholder="متن پیامت را بنویس…" maxlength="2000" aria-label="متن پیام ناشناس"></textarea>' +
            '<button id="home-send" class="send-btn" disabled aria-label="ارسال پیام">' + icon('send') + '</button>' +
          '</div>' +
          '<div class="compose-hint">' + icon('clock') + 'Enter برای ارسال · Shift+Enter برای خط جدید</div>' +
        '</section>' +
        '<div class="list-head">' +
          '<span class="list-title">نامه‌های بی‌نام تو</span>' +
          '<span class="list-count" id="list-count"></span>' +
        '</div>' +
        '<div id="conv-list" class="conv-list"></div>' +
      '</main>';
    applyTheme(state.theme);
    bindHomeEvents();
    setOnline(state.online);
  }

  function bindHomeEvents() {
    var ta = $('#home-composer');
    var btn = $('#home-send');
    if (ta && btn) {
      ta.addEventListener('input', function () {
        btn.disabled = !ta.value.trim() || state.notices.sending;
        autoGrow(ta);
      });
      var send = function () { if (ta.value.trim()) sendNewMessage(); };
      btn.addEventListener('click', send);
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
    }
    $$('.conv').forEach(function (row) {
      row.addEventListener('click', function () {
        var idx = parseInt(row.getAttribute('data-idx'), 10);
        if (state.conversations[idx]) openConversation(state.conversations[idx]);
      });
    });
  }

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  }

  function convSkeletons(n) {
    var html = '';
    for (var i = 0; i < (n || 4); i++) {
      html += '<div class="skel-conv"><span class="skel-av skeleton"></span><span class="skel-lines"><span class="skel-line skeleton"></span><span class="skel-line skeleton"></span></span></div>';
    }
    return html;
  }

  function renderConversations() {
    var el = $('#conv-list');
    var count = $('#list-count');
    if (!el) return;
    if (state.notices.convLoading) { el.innerHTML = convSkeletons(); return; }

    var pend = 0;
    state.conversations.forEach(function (c) { if (!convAnswered(c)) pend++; });
    if (count) {
      count.textContent = faNum(state.conversations.length) + ' نامه · ' + faNum(pend) + ' در انتظار';
    }

    var html = '';
    state.conversations.forEach(function (c, i) {
      var preview = convPreview(c);
      var answered = convAnswered(c);
      html +=
        '<button type="button" class="conv" data-idx="' + i + '" style="animation-delay:' + (i * 45) + 'ms">' +
          '<span class="conv-avatar">' + veil(c.id || i + 1, 'am-plain') + '</span>' +
          '<span class="conv-body">' +
            '<span class="conv-top">' +
              '<span class="conv-name">نامهٔ ' + faNum(c.id) + '</span>' +
              '<span class="conv-time">' + esc(convTime(c)) + '</span>' +
            '</span>' +
            '<span class="conv-preview">' + esc(preview) + '</span>' +
            '<span class="conv-foot">' +
              (answered
                ? '<span class="chip chip-answered">پاسخ داده شد</span>'
                : '<span class="chip chip-pending">در انتظار پاسخ</span>') +
            '</span>' +
          '</span>' +
        '</button>';
    });
    el.innerHTML = html || emptyStateHTML();
    bindHomeEvents();
  }

  function loadConversations(initial) {
    if (!state.user) return Promise.resolve();
    if (state.notices.convLoading) return Promise.resolve();
    state.notices.convLoading = true;
    var el = $('#conv-list');
    if (el && initial) el.innerHTML = convSkeletons();
    renderConversations();
    return api(EP.convos(state.user.id)).then(function (data) {
      state.notices.convLoading = false;
      state.conversations = Array.isArray(data) ? data : [];
      renderConversations();
    }).catch(function (e) {
      state.notices.convLoading = false;
      if (initial) {
        renderConversationsError(e);
      } else {
        setOnline(false);
      }
    });
  }

  function renderConversationsError(e) {
    var el = $('#conv-list');
    if (!el) return;
    el.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-seal">' + veil(2, 'am-outline') + '</div>' +
        '<p class="empty-title">نامه‌ها باز نشد</p>' +
        '<p class="empty-desc">' + esc(e && e.message ? e.message : 'اتصال به سرور برقرار نشد') + '</p>' +
        '<button class="btn btn-ghost" id="retry-btn">' + icon('retry') + 'تلاش دوباره</button>' +
      '</div>';
    var b = $('#retry-btn');
    if (b) b.addEventListener('click', function () { loadConversations(true); });
  }

  function emptyStateHTML() {
    return '<div class="empty-state">' +
      '<div class="empty-seal">' + veil(1, 'am-outline') + '</div>' +
      '<p class="empty-title">هنوز نامه‌ای نیست</p>' +
      '<p class="empty-desc">اولین پیام ناشناس را از بالا بفرست؛ نوشته‌هایت این‌جا حفظ می‌شوند و پاسخ مدیر به همین نامه برمی‌گردد.</p>' +
    '</div>';
  }

  /* ═══ INTEGRATION: POST /api/Messages/send ────────────────── */
  function sendNewMessage() {
    var ta = $('#home-composer');
    var btn = $('#home-send');
    var content = ta.value.trim();
    if (!content || state.notices.sending || !state.user) return;

    state.notices.sending = true;
    btn.disabled = true;
    btn.classList.add('is-sending');
    btn.innerHTML = '<span class="spinner"></span>';

    api(EP.sendNew(state.user.id, content), { method: 'POST' }).then(function (data) {
      ta.value = '';
      ta.style.height = 'auto';
      state.notices.sending = false;
      btn.innerHTML = icon('send');
      btn.disabled = true;
      toast('نامه فرستاده شد', 'success');
      var cid = data.conversation_id;
      if (cid) {
        var convo = state.conversations.find(function (c) { return c.id === cid; });
        if (convo) {
          openConversation(convo);
        } else {
          return loadConversations(true).then(function () {
            var found = state.conversations.find(function (c) { return c.id === cid; });
            if (found) openConversation(found);
          });
        }
      }
      return null;
    }).catch(function (e) {
      toast(e.message || 'خطا در فرستادن پیام', 'error');
      state.notices.sending = false;
      btn.innerHTML = icon('send');
      btn.disabled = !ta.value.trim();
      btn.classList.remove('is-sending');
    });
  }

  /* ── Chat ───────────────────────────────────────────────── */
  function openConversation(convo) {
    state.screen = 'chat';
    state.activeConvo = convo;
    state.messages = [];
    clearTimers();
    app.classList.add('chat-mode');
    renderChat();
    loadMessages(true);
    state.timers = setInterval(function () { pollChat(); }, 7000);
  }

  function renderChat() {
    var c = state.activeConvo;
    var answered = c ? convAnswered(c) : false;
    app.innerHTML =
      '<header class="topbar">' +
        '<div class="topbar-in">' +
          '<button class="icon-btn" id="back-btn" aria-label="بازگشت به نامه‌ها">' + icon('back') + '</button>' +
          '<div class="chat-id">' +
            '<span class="chat-avatar">' + veil(c ? c.id : 1, 'am-solid') + '</span>' +
            '<span class="chat-meta">' +
              '<span class="chat-name">نامهٔ ' + (c ? faNum(c.id) : '') + '</span>' +
              '<span class="chat-sub">' + statusChip(answered) + '</span>' +
            '</span>' +
          '</div>' +
          '<button class="icon-btn theme-toggle" aria-label="تغییر تم"></button>' +
        '</div>' +
      '</header>' +
      '<div class="offline-bar"><span>' + icon('eyeOff') + 'اتصال اینترنت برقرار نیست</span></div>' +
      '<main class="chat-page">' +
        '<div class="chat-scroll" id="chat-messages"></div>' +
        '<div class="chat-composer">' +
          '<div class="compose-line">' +
            '<textarea id="chat-input" class="composer-input" rows="1" placeholder="پاسخ ناشناس بنویس…" maxlength="2000" aria-label="متن پیام"></textarea>' +
            '<button id="chat-send" class="send-btn" disabled aria-label="ارسال پیام">' + icon('send') + '</button>' +
          '</div>' +
          '<div class="compose-hint">' + icon('clock') + 'Enter برای ارسال · Shift+Enter برای خط جدید</div>' +
        '</div>' +
      '</main>';
    applyTheme(state.theme);
    bindChatEvents();
    setOnline(state.online);
  }

  function statusChip(answered) {
    return answered
      ? '<span class="chip chip-answered">پاسخ داده شد</span>'
      : '<span class="chip chip-pending">در انتظار پاسخ</span>';
  }

  function bindChatEvents() {
    var back = $('#back-btn');
    if (back) back.addEventListener('click', function () { showHome(); });

    var ta = $('#chat-input');
    var btn = $('#chat-send');
    if (ta && btn) {
      ta.addEventListener('input', function () {
        btn.disabled = !ta.value.trim() || state.notices.sending;
        autoGrow(ta);
      });
      var send = function () { if (ta.value.trim()) sendChatReply(); };
      btn.addEventListener('click', send);
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
      ta.addEventListener('focus', function () { scrollToBottom(); });
      ta.focus();
    }
  }

  /* ═══ INTEGRATION: GET /api/conversations/{id} ───────────── */
  function loadMessages(initial, silent) {
    if (!state.activeConvo) return Promise.resolve();
    var cid = state.activeConvo.id;
    if (initial) {
      state.notices.msgsLoading = true;
      renderMessages();
    }
    return api(EP.convo(cid)).then(function (data) {
      state.notices.msgsLoading = false;
      state.activeConvo = { id: data.id, user_id: data.user_id, created_at: data.created_at, messages: data.messages || [] };
      state.messages = (data.messages || []).map(function (m) { return m; });
      renderMessages();
      scrollToBottom(data.messages ? data.messages.length : 0);
      updateChatStatus();
    }).catch(function () {
      state.notices.msgsLoading = false;
      renderMessages();
      if (!silent) toast('دریافت پیام‌ها با خطا مواجه شد', 'error');
    });
  }

  function pollChat() {
    if (!state.activeConvo || !navigator.onLine) return;
    var before = state.messages.length;
    loadMessages(false, true).then(function () {
      var after = state.messages.length;
      if (after > before) {
        var last = state.messages[after - 1];
        if (last && last.sender === 'admin') {
          toast('پاسخ جدیدی رسید', 'info');
        }
      }
    });
  }

  /* ═══ INTEGRATION: POST /api/Messages/ (reply) ───────────── */
  function sendChatReply() {
    var ta = $('#chat-input');
    var btn = $('#chat-send');
    var content = ta.value.trim();
    if (!content || state.notices.sending || !state.activeConvo) return;

    var tempId = 'temp-' + Date.now();
    var tempMsg = { id: tempId, sender: 'user', content: content, created_at: new Date().toISOString(), pending: true };
    state.messages.push(tempMsg);

    state.notices.sending = true;
    btn.disabled = true;
    btn.classList.add('is-sending');
    btn.innerHTML = '<span class="spinner"></span>';
    ta.value = '';
    ta.style.height = 'auto';
    renderMessages();
    scrollToBottom();

    api(EP.reply(state.activeConvo.id, content), { method: 'POST' }).then(function () {
      state.notices.sending = false;
      btn.innerHTML = icon('send');
      btn.disabled = true;
      return loadMessages(false, true);
    }).catch(function (e) {
      state.messages = state.messages.filter(function (m) { return m.id !== tempId; });
      renderMessages();
      toast(e.message || 'خطا در ارسال', 'error');
      state.notices.sending = false;
      btn.innerHTML = icon('send');
      btn.disabled = !ta.value.trim();
      btn.classList.remove('is-sending');
    });
  }

  function renderMessages() {
    var el = $('#chat-messages');
    if (!el) return;
    if (state.notices.msgsLoading) {
      el.innerHTML =
        '<div class="skel-msgs"><div class="skel-msg skeleton"></div><div class="skel-msg skeleton"></div><div class="skel-msg skeleton"></div></div>';
      return;
    }
    if (!state.messages.length) {
      el.innerHTML =
        '<div class="chat-empty">' +
          '<div class="chat-empty-seal">' + veil((state.activeConvo && state.activeConvo.id) || 1, 'am-outline') + '</div>' +
          '<p class="chat-empty-title">شروع این نامه</p>' +
          '<p class="chat-empty-desc">پیامت را بنویس؛ پاسخ محرمانه به همین‌جا می‌رسد.</p>' +
        '</div>';
      return;
    }
    var html = '';
    var lastDate = '';
    state.messages.forEach(function (m, i) {
      var day = fmtDay(m.created_at);
      if (day !== lastDate) {
        html += '<div class="day"><span>' + day + '</span></div>';
        lastDate = day;
      }
      var isUser = m.sender === 'user';
      var prev = state.messages[i - 1];
      var next = state.messages[i + 1];
      var grouped = prev && prev.sender === m.sender;
      var groupEnd = !next || next.sender !== m.sender;
      html +=
        '<div class="msg ' + (isUser ? 'msg-user' : 'msg-admin') + (grouped ? ' grp' : '') + '">' +
          '<div class="bubble">' + esc(m.content) + '</div>' +
          (groupEnd
            ? '<span class="msg-meta">' + (m.pending ? icon('clock') : '') + fmtTime(m.created_at) + '</span>'
            : '') +
        '</div>';
    });
    el.innerHTML = html;
  }

  function updateChatStatus() {
    var sub = $('.chat-sub');
    if (!sub) return;
    sub.innerHTML = statusChip(convAnswered(state.activeConvo));
    var bar = $('#chat-messages');
    if (bar) bar.scrollTop = bar.scrollHeight;
  }

  function scrollToBottom(freshCount) {
    requestAnimationFrame(function () {
      var el = $('#chat-messages');
      if (!el) return;
      var nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      if (freshCount === undefined || nearBottom || freshCount <= 2) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  /* ── Timers ─────────────────────────────────────────────── */
  function clearTimers() {
    if (state.timers) { clearInterval(state.timers); state.timers = null; }
  }

  /* ── Global: theme toggles ──────────────────────────────── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.theme-toggle');
    if (t) toggleTheme();
  });

  /* ── Boot ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();