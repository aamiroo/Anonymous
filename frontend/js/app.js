/* ============================================================
   ناشناس — Anonymous Messaging · «شبِ نامه‌ها» (SPA)
   Glass-over-midnight UI. Connects to the existing FastAPI
   backend; API contract unchanged.
   ============================================================ */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  var API_BASE = window.EA_API_BASE || (
    (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : ''
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

  /* Avatar gradient pairs (Telegram-style per-chat identity) */
  var AV_GRADS = [
    ['#f472b6', '#a78bfa'],
    ['#34d399', '#22d3ee'],
    ['#fbbf24', '#fb7185'],
    ['#60a5fa', '#a78bfa'],
    ['#f97316', '#f472b6'],
    ['#2dd4bf', '#60a5fa'],
    ['#a3e635', '#34d399']
  ];
  function avGrad(id) {
    var n = parseInt(id, 10);
    if (!n || n < 1) n = 1;
    return AV_GRADS[(n - 1) % AV_GRADS.length];
  }

  /* ── State ──────────────────────────────────────────────── */
  var state = {
    screen: 'boot',            // boot | login | home | chat
    user: null,
    conversations: [],
    visibleConvos: [],
    activeConvo: null,
    messages: [],
    query: '',
    notices: { convLoading: false, msgsLoading: false, sending: false },
    online: navigator.onLine,
    theme: localStorage.getItem(THEME_KEY) || 'dark',
    hasEitaa: !!(window.Eitaa && window.Eitaa.WebApp && window.Eitaa.WebApp.initData),
    timers: null,
  };

  var $  = function (s, p) { return (p || document).querySelector(s); };
  var $$ = function (s, p) { return Array.prototype.slice.call((p || document).querySelectorAll(s)); };
  var app = $('#app');

  /* ── Brand mark (the calligraphy logo, tinted via currentColor) ── */
  function logo(size) {
    return '<i class="logo-mark ' + (size || 'lm-md') + '" aria-hidden="true"></i>';
  }
  function avatar(id, cls) {
    var g = avGrad(id);
    return '<span class="avatar' + (cls ? ' ' + cls : '') + '" style="--av1:' + g[0] + ';--av2:' + g[1] + '">' + logo() + '</span>';
  }

  function icon(name) {
    var paths = {
      send:    '<path fill="currentColor" stroke="none" d="M3.4 20.4l17.4-7.5c.8-.35.8-1.45 0-1.8L3.4 3.6c-.66-.29-1.39.2-1.39.92l-.01 4.61c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .72.73 1.2 1.39.91z"/>',
      back:    '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
      moon:    '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>',
      sun:     '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
      search:  '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
      clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      check:   '<path d="M4.5 12.5l5 5L20 6.5"/>',
      checks:  '<path d="M2.5 12.5l4.5 4.5L16 8"/><path d="M10.5 15.5l1.5 1.5L22 7"/>',
      retry:   '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
      quill:   '<path d="M20 4c1 1.4.6 3.6-1 5.4L8 20l-4 1 1-4L16 5c1.6-1.6 3.7-2 5-1z"/><path d="M14 8l2 2"/>',
      smile:   '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/><circle cx="9" cy="9.6" r="0.6" fill="currentColor"/><circle cx="15" cy="9.6" r="0.6" fill="currentColor"/>',
      eyeOff:  '<path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-2.4 3.4M6.3 6.3A17.7 17.7 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 4.6-1.1M4 4l16 16"/>',
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
    if (meta) meta.content = t === 'dark' ? '#0a0e17' : '#eef1f8';
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
    dots.forEach(function (d) { d.classList.toggle('offline', !v); });
    var bar = $('.offline-bar');
    if (bar) bar.classList.toggle('visible', !v);
  }

  /* ── Boot / Auth ────────────────────────────────────────── */
  function init() {
    injectAurora();
    applyTheme(state.theme);
    setOnline(state.online);
    window.addEventListener('online', function () { setOnline(true); });
    window.addEventListener('offline', function () { setOnline(false); });
    renderSplash();
    if (window.Eitaa && window.Eitaa.WebApp) {
      authenticate(0);
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

  function injectAurora() {
    if ($('.aurora')) return;
    var a = document.createElement('div');
    a.className = 'aurora';
    a.setAttribute('aria-hidden', 'true');
    a.innerHTML = '<i></i><i></i><i></i>';
    document.body.insertBefore(a, document.body.firstChild);
  }

  function authenticate(attempt) {
    attempt = attempt || 0;
    var webApp = window.Eitaa && window.Eitaa.WebApp;
    var initData = webApp ? (webApp.initData || '') : '';

    if (!initData) {
      if (attempt < 20) {
        setTimeout(function () {
          authenticate(attempt + 1);
        }, 250);
        return;
      }
      showAuthError('اطلاعات ورود ایتا دریافت نشد. مینی‌اپ را از داخل ایتا دوباره باز کنید.');
      return;
    }

    api(EP.login(initData), { method: 'POST' }).then(function (data) {
      state.user = data;
      localStorage.setItem(USER_KEY, JSON.stringify(data));
      showHome();
    }).catch(function (err) {
      console.error('[Eitaa auth] Login failed:', err);
      showAuthError('ورود خودکار ناموفق بود: ' + (err.message || 'خطای نامشخص'));
    });
  }

  function showAuthError(message) {
    state.screen = 'login';
    app.classList.remove('chat-mode');
    app.innerHTML =
      '<div class="dev-login"><div class="dev-card glass">' +
      '<div class="dev-seal">' + logo('lm-lg') + '</div>' +
      '<h1 class="dev-title">ورود به ایتا</h1>' +
      '<p class="dev-desc"></p>' +
      '<button id="eitaa-retry" class="btn btn-primary" style="width:100%;margin-top:14px">تلاش مجدد</button>' +
      '</div></div>';
    var desc = $('.dev-desc');
    if (desc) desc.textContent = message;
    var btn = $('#eitaa-retry');
    if (btn) btn.addEventListener('click', function () {
      renderSplash();
      authenticate(0);
    });
  }

  /* ── Splash ─────────────────────────────────────────────── */
  function renderSplash() {
    state.screen = 'boot';
    app.classList.remove('chat-mode');
    app.innerHTML =
      '<div class="splash-screen">' +
        '<div class="splash-logo">' + logo('lm-hero') + '</div>' +
        '<h1 class="splash-name grad-text">ناشناس</h1>' +
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
        '<div class="dev-card glass">' +
          '<div class="dev-seal">' + logo('lm-lg') + '</div>' +
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
    state.query = '';
    clearTimers();
    app.classList.remove('chat-mode');
    renderHome();
    loadConversations(true);
    state.timers = setInterval(function () { loadConversations(false); }, 15000);
  }

  function renderHome() {
    app.innerHTML =
      '<header class="topbar">' +
        '<div class="topbar-in glass">' +
          '<div class="brand">' +
            '<span class="brand-logo">' + logo('lm-sm') + '</span>' +
            '<span class="brand-name">ناشناس</span>' +
            '<span class="brand-status"><span class="dot status-dot"></span><span class="status-text">' + (state.online ? 'متصل' : 'آفلاین') + '</span></span>' +
          '</div>' +
          '<button class="icon-btn theme-toggle" aria-label="تغییر تم"></button>' +
        '</div>' +
        '<div class="search-wrap">' +
          '<div class="search-bar glass">' + icon('search') +
            '<input type="search" id="home-search" placeholder="جستجو در نامه‌ها" aria-label="جستجو" autocomplete="off">' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<div class="offline-bar"><span>' + icon('eyeOff') + 'اتصال اینترنت برقرار نیست</span></div>' +
      '<main class="page">' +
        '<section class="compose-hero glass" aria-label="پیام ناشناس جدید">' +
          '<span class="compose-kicker">' + icon('quill') + 'مکاتبهٔ بی‌نام</span>' +
          '<h2 class="compose-title">نامهٔ تازه بنویس</h2>' +
          '<p class="compose-cap">بی‌نام می‌ماند؛ پاسخ مدیر محرمانه به همین گفتگو برمی‌گردد.</p>' +
          '<div class="compose-line">' +
            '<textarea id="home-composer" rows="1" placeholder="حرفت را بنویس…" maxlength="2000" aria-label="متن پیام ناشناس"></textarea>' +
            '<button id="home-send" class="send-circle" disabled aria-label="ارسال پیام">' + icon('send') + '</button>' +
          '</div>' +
          '<div class="compose-hint">' + icon('smile') + 'Enter برای ارسال · Shift+Enter برای خط جدید</div>' +
        '</section>' +
        '<div class="list-head">' +
          '<span class="list-title">گفتگوهای تو</span>' +
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
    var search = $('#home-search');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value.trim();
        renderConversations();
      });
    }
    $$('.conv').forEach(function (row) {
      row.addEventListener('click', function () {
        var idx = parseInt(row.getAttribute('data-idx'), 10);
        if (state.visibleConvos[idx]) openConversation(state.visibleConvos[idx]);
      });
    });
  }

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  }

  function convTs(c) {
    var msgs = c.messages || [];
    var iso = msgs.length ? msgs[msgs.length - 1].created_at : c.created_at;
    try { return new Date(iso).getTime() || 0; } catch (e) { return 0; }
  }

  function filteredConvos() {
    var list = state.conversations.slice();
    if (state.query) {
      var q = state.query.toLowerCase();
      list = list.filter(function (c) {
        return String(c.id).indexOf(q) !== -1 || (convPreview(c) || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    list.sort(function (a, b) { return convTs(b) - convTs(a); });
    return list;
  }

  function convSkeletons(n) {
    var html = '';
    for (var i = 0; i < (n || 5); i++) {
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

    var list = filteredConvos();
    state.visibleConvos = list;

    var html = '';
    list.forEach(function (c, i) {
      var preview = convPreview(c);
      var answered = convAnswered(c);
      html +=
        '<button type="button" class="conv" data-idx="' + i + '" style="animation-delay:' + (i * 35) + 'ms">' +
          avatar(c.id || i + 1) +
          '<span class="conv-body">' +
            '<span class="conv-top">' +
              '<span class="conv-name">نامهٔ ' + faNum(c.id) + '</span>' +
              '<span class="conv-time">' + esc(convTime(c)) + '</span>' +
            '</span>' +
            '<span class="conv-bottom">' +
              '<span class="conv-preview">' + esc(preview) + '</span>' +
              '<span class="conv-state">' +
                (answered
                  ? '<span class="st-answered">' + icon('checks') + '</span>'
                  : '<span class="st-pending">' + icon('clock') + '</span>') +
              '</span>' +
            '</span>' +
          '</span>' +
        '</button>';
    });
    el.innerHTML = html || (state.query ? emptySearchHTML() : emptyStateHTML());
    bindHomeEvents();
  }

  function emptySearchHTML() {
    return '<div class="empty-state">' +
      '<div class="empty-seal">' + logo('lm-lg') + '</div>' +
      '<p class="empty-title">نتیجه‌ای نبود</p>' +
      '<p class="empty-desc">برای «' + esc(state.query) + '» نامه‌ای پیدا نشد.</p>' +
    '</div>';
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
        '<div class="empty-seal">' + logo('lm-lg') + '</div>' +
        '<p class="empty-title">نامه‌ها باز نشد</p>' +
        '<p class="empty-desc">' + esc(e && e.message ? e.message : 'اتصال به سرور برقرار نشد') + '</p>' +
        '<button class="btn btn-ghost" id="retry-btn">' + icon('retry') + 'تلاش دوباره</button>' +
      '</div>';
    var b = $('#retry-btn');
    if (b) b.addEventListener('click', function () { loadConversations(true); });
  }

  function emptyStateHTML() {
    return '<div class="empty-state">' +
      '<div class="empty-seal">' + logo('lm-lg') + '</div>' +
      '<p class="empty-title">هنوز نامه‌ای نیست</p>' +
      '<p class="empty-desc">اولین پیام ناشناس را از بالا بفرست؛ پاسخ مدیر به همین‌جا برمی‌گردد.</p>' +
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
        '<div class="topbar-in glass">' +
          '<button class="icon-btn" id="back-btn" aria-label="بازگشت به گفتگوها">' + icon('back') + '</button>' +
          '<div class="chat-id">' +
            avatar(c ? c.id : 1, 'sm') +
            '<div class="chat-meta">' +
              '<span class="chat-name">نامهٔ ' + (c ? faNum(c.id) : '') + '</span>' +
              '<span class="chat-sub">' + statusChip(answered) + '</span>' +
            '</div>' +
          '</div>' +
          '<button class="icon-btn theme-toggle" aria-label="تغییر تم"></button>' +
        '</div>' +
      '</header>' +
      '<div class="offline-bar"><span>' + icon('eyeOff') + 'اتصال اینترنت برقرار نیست</span></div>' +
      '<main class="chat-page">' +
        '<div class="chat-scroll" id="chat-messages"></div>' +
        '<div class="chat-composer">' +
          '<div class="compose-line">' +
            '<textarea id="chat-input" rows="1" placeholder="حرفت را بنویس…" maxlength="2000" aria-label="متن پیام"></textarea>' +
            '<button id="chat-send" class="send-circle" disabled aria-label="ارسال پیام">' + icon('send') + '</button>' +
          '</div>' +
          '<div class="compose-hint">' + icon('smile') + 'Enter برای ارسال · Shift+Enter برای خط جدید</div>' +
        '</div>' +
      '</main>';
    applyTheme(state.theme);
    bindChatEvents();
    setOnline(state.online);
  }

  function statusChip(answered) {
    return answered
      ? '<span class="chip chip-answered">پاسخ رسید</span>'
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
          '<div class="chat-empty-seal">' + logo('lm-lg') + '</div>' +
          '<p class="chat-empty-title">شروع این نامه</p>' +
          '<p class="chat-empty-desc">پیامت را بنویس؛ پاسخ محرمانه به همین‌جا می‌رسد.</p>' +
        '</div>';
      return;
    }
    var answered = convAnswered(state.activeConvo);
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
      var pos = !grouped && groupEnd ? 'single' : (!grouped ? 'first' : (groupEnd ? 'last' : 'mid'));
      var ticks = '';
      if (isUser) {
        ticks = m.pending
          ? icon('clock')
          : (answered ? icon('checks') : icon('check'));
      }
      html +=
        '<div class="msg ' + (isUser ? 'msg-user' : 'msg-admin') + ' ' + pos + '">' +
          '<div class="bubble">' +
            '<span class="b-text">' + esc(m.content) + '</span>' +
            '<span class="msg-meta">' + fmtTime(m.created_at) + ticks + '</span>' +
          '</div>' +
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
