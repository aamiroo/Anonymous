/* ============================================================
   ناشناس — Admin Panel · «اتاق تاریک» (SPA)
   JWT auth · protected admin APIs · reply workspace.
   Backend contract is unchanged.
   ============================================================ */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  var API_BASE = window.EA_API_BASE || (
    (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : location.protocol + '//' + location.hostname + ':8000'
  );

  var EP = {
    login:        function (u, p) { return API_BASE + '/api/admin/login?username=' + encodeURIComponent(u) + '&password=' + encodeURIComponent(p); },
    conversations: API_BASE + '/api/admin/conversations',
    conversation:  function (id) { return API_BASE + '/api/admin/conversations/' + id; },
    reply:         function (id) { return API_BASE + '/api/admin/conversations/' + id + '/reply'; },
  };

  var TOKEN_KEY = 'dr-admin-token';
  var THEME_KEY = 'dr-admin-theme';

  /* ── State ──────────────────────────────────────────────── */
  var state = {
    screen: 'boot',            // boot | login | console
    token: null,
    conversations: [],
    previewCache: {},          // id -> { content, lastSender, created_at }
    selectedId: null,
    messages: [],
    status: 'pending',
    tab: 'all',
    query: '',
    loaded: false,
    convLoading: false,
    detailLoading: false,
    sending: false,
    online: true,
    theme: localStorage.getItem(THEME_KEY) || 'dark',
    clockTimer: null,
    convTimer: null,
    detailTimer: null,
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
      send:    '<path d="M19 12H5M11 18l-6-6 6-6"/>',
      back:    '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
      search:  '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
      eye:     '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
      eyeOff:  '<path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-2.4 3.4M6.3 6.3A17.7 17.7 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 4.6-1.1M4 4l16 16"/>',
      logout:  '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
      key:     '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12l9-9"/><path d="M17 6l3 3"/><path d="M14 9l2 2"/>',
      refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
      moon:    '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>',
      sun:     '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
      check:   '<path d="M20 6L9 17l-5-5"/>',
      quill:   '<path d="M20 4c1 1.4.6 3.6-1 5.4L8 20l-4 1 1-4L16 5c1.6-1.6 3.7-2 5-1z"/><path d="M14 8l2 2"/>',
      lock:    '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
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

  function isAnswered(c) {
    if (!c) return false;
    if (c.status === 'answered') return true;
    var p = state.previewCache[c.id];
    if (p && p.lastSender === 'admin') return true;
    if (c.messages && c.messages.length) return c.messages[c.messages.length - 1].sender === 'admin';
    return false;
  }
  function convPreview(c) {
    var p = state.previewCache[c.id];
    if (p && p.content) return p.content;
    if (c.messages && c.messages.length) return c.messages[c.messages.length - 1].content;
    return 'بدون دید — برای مشاهده باز کنید';
  }
  function convTime(c) {
    var p = state.previewCache[c.id];
    if (p && p.created_at) return fmtRel(p.created_at);
    return fmtRel(c.created_at);
  }
  function updatePreviewFromDetail(d) {
    var msgs = d.messages || [];
    var last = msgs.length ? msgs[msgs.length - 1] : null;
    state.previewCache[d.id] = {
      content: last ? last.content : undefined,
      lastSender: last ? last.sender : (d.status === 'answered' ? 'admin' : 'user'),
      created_at: last ? last.created_at : d.created_at,
    };
  }

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
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    var btn = $('.theme-toggle');
    if (btn) btn.innerHTML = state.theme === 'dark' ? icon('sun') : icon('moon');
  }
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, state.theme);
    applyTheme();
  }

  /* ── API client (Bearer auth + 401 handling) ────────────── */
  function api(url, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    opts.headers = headers;
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, 20000);
    opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (res) {
      clearTimeout(tid);
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (res.status === 401 && state.token) {
          onUnauthorized(body && body.detail);
        }
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

  /* ── Auth lifecycle ─────────────────────────────────────── */
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { state.token = t; if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

  function onUnauthorized(detail) {
    setToken(null);
    clearTimers();
    renderLogin(detail === 'Token expired' ? 'نشست‌ات تمام شد؛ دوباره وارد شو.' : 'برای ادامه، دوباره وارد شو.');
  }

  function login(username, password) {
    var btn = $('#btn-login');
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerHTML = '<span class="spinner"></span>';
    hideFormError();
    fetch(EP.login(username.trim(), password), { method: 'POST' }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) {
          var err = new Error(body.detail || 'ورود ناموفق');
          err.status = res.status;
          throw err;
        }
        return body;
      });
    }).then(function (data) {
      if (!data.access_token) throw new Error('پاسخ سرور نامعتبر است');
      setToken(data.access_token);
      state.screen = 'console';
      renderConsole();
      startPolling();
      loadConversations();
    }).catch(function (e) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.innerHTML = 'ورود';
      showFormError(e.message || 'ورود ناموفق بود');
    });
  }

  function logout() {
    setToken(null);
    clearTimers();
    state.selectedId = null;
    toast('از اتاق خارج شدی', 'info');
    renderLogin();
  }

  /* ── Login view ─────────────────────────────────────────── */
  function renderLogin(message) {
    state.screen = 'login';
    app.classList.remove('console-mode');
    setBodyView();
    app.innerHTML =
      '<div class="login">' +
        '<section class="login-story">' +
          '<div class="story-inner">' +
            '<div class="story-frame">' + veil(0, 'am-solid') + '</div>' +
            '<div class="story-brand">ناشناس</div>' +
            '<div class="story-role">' + icon('lock') + 'اتاق تاریک</div>' +
            '<p class="story-copy">نامه‌های بی‌نام این‌جا می‌آیند؛<br>محرمانه نگاهشان کن و پاسخ بده.</p>' +
            '<p class="story-foot">فقط برای مدیر سامانه</p>' +
          '</div>' +
        '</section>' +
        '<section class="login-access">' +
          '<form class="login-card" id="login-form" novalidate>' +
            '<h1 class="card-title">ورود به اتاق تاریک</h1>' +
            '<p class="card-sub">دسترسی محدود به مدیر سامانه</p>' +
            '<div class="form-row">' +
              '<label class="form-label" for="f-user">نام کاربری</label>' +
              '<input class="field" id="f-user" autocomplete="username" placeholder="نام کاربری مدیر" aria-label="نام کاربری">' +
            '</div>' +
            '<div class="form-row">' +
              '<label class="form-label" for="f-pass">رمز عبور</label>' +
              '<div class="pw">' +
                '<input class="field" id="f-pass" type="password" autocomplete="current-password" placeholder="••••••••" aria-label="رمز عبور">' +
                '<button type="button" class="pw-toggle" id="pw-eye" aria-label="نمایش رمز">' + icon('eye') + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="form-error" id="form-error"></div>' +
            '<button type="submit" class="btn btn-primary form-submit" id="btn-login">ورود</button>' +
            '<p class="login-note">مکاتبات محرمانه · پاسخ فقط یک بار</p>' +
          '</form>' +
        '</section>' +
      '</div>';

    var form = $('#login-form');
    var user = $('#f-user');
    var pass = $('#f-pass');
    var eye = $('#pw-eye');
    function submit(e) {
      e.preventDefault();
      if (user.value.trim() && pass.value) login(user.value, pass.value);
    }
    form.addEventListener('submit', submit);
    eye.addEventListener('click', function () {
      var isPw = pass.type === 'password';
      pass.type = isPw ? 'text' : 'password';
      eye.innerHTML = isPw ? icon('eyeOff') : icon('eye');
    });
    user.focus();
    if (message) showFormError(message);
    applyTheme();
  }

  function showFormError(msg) {
    var el = $('#form-error');
    if (el) { el.textContent = msg; el.classList.add('visible'); }
  }
  function hideFormError() {
    var el = $('#form-error');
    if (el) el.classList.remove('visible');
  }

  function setBodyView() {
    document.body.className = (window.innerWidth > 760 || (state.screen === 'console' && state.selectedId))
      ? 'view-detail' : 'view-list';
  }
  /* ── Timers & connection ─────────────────────────────────── */
  function clearTimers() {
    if (state.clockTimer)  { clearInterval(state.clockTimer);  state.clockTimer = null; }
    if (state.convTimer)   { clearInterval(state.convTimer);   state.convTimer = null; }
    if (state.detailTimer) { clearTimeout(state.detailTimer);  state.detailTimer = null; }
  }
  function startPolling() {
    tickClock();
    state.clockTimer = setInterval(tickClock, 20000);
    state.convTimer = setInterval(loadConversations, 25000);
  }
  function tickClock() {
    var el = $('#clock');
    if (el) el.textContent = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  }
  function updateConnState() {
    var ok = navigator.onLine !== false;
    var conn = $('#conn');
    if (ok === state.online) return;
    state.online = ok;
    if (conn) {
      conn.classList.toggle('offline', !ok);
      var txt = $('.conn-txt', conn);
      if (txt) txt.textContent = ok ? 'متصل' : 'آفلاین';
    }
    if (!ok) toast('اتصال اینترنت برقرار نیست', 'error');
  }

  /* ── Workspace shell ─────────────────────────────────────── */
  function renderConsole() {
    state.screen = 'console';
    state.selectedId = null;
    app.classList.add('console-mode');
    setBodyView();
    app.innerHTML =
      '<header class="topbar">' +
        '<div class="topbar-in">' +
          '<div class="brand">' +
            '<span class="brand-seal">' + veil(0, 'am-solid') + '</span>' +
            '<span class="brand-name">ناشناس</span>' +
            '<span class="brand-badge">اتاق تاریک</span>' +
          '</div>' +
          '<div class="top-actions">' +
            '<span class="clock" id="clock"></span>' +
            '<span class="conn" id="conn"><span class="conn-dot"></span><span class="conn-txt">متصل</span></span>' +
            '<button class="icon-btn" id="btn-refresh" title="به‌روزرسانی" aria-label="به‌روزرسانی">' + icon('refresh') + '</button>' +
            '<button class="icon-btn theme-toggle" title="تغییر تم" aria-label="تغییر تم"></button>' +
            '<button class="btn btn-danger logout" id="btn-logout" type="button">' + icon('logout') + 'خروج</button>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<div class="console">' +
        '<aside class="rail">' +
          '<div class="rail-head">' +
            '<div class="rail-title"><span>نامه‌های بی‌نام</span><span class="rail-count" id="rail-count"></span></div>' +
            '<div class="tabs" id="pane-tabs">' +
              '<button class="tab active" type="button" data-tab="all">همه <small id="cnt-all"></small></button>' +
              '<button class="tab" type="button" data-tab="pending">در انتظار <small id="cnt-pend"></small></button>' +
              '<button class="tab" type="button" data-tab="answered">پاسخ‌شده <small id="cnt-ans"></small></button>' +
            '</div>' +
            '<div class="search">' + icon('search') +
              '<input class="field" id="pane-search-input" placeholder="جستجو در نامه‌ها..." aria-label="جستجو" autocomplete="off">' +
            '</div>' +
          '</div>' +
          '<div class="rail-list" id="rail-list"></div>' +
        '</aside>' +
        '<section class="stage" id="stage">' + stageEmptyHtml() + '</section>' +
      '</div>';

    applyTheme();
    bindConsoleEvents();
    updateConnState();
  }

  function bindConsoleEvents() {
    $('#btn-logout').addEventListener('click', logout);
    $('#btn-refresh').addEventListener('click', loadConversations);
    var tt = $('.theme-toggle');
    if (tt) tt.addEventListener('click', toggleTheme);

    $('#pane-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.tab');
      if (!btn) return;
      $$('.tab').forEach(function (t) { t.classList.remove('active'); });
      btn.classList.add('active');
      state.tab = btn.getAttribute('data-tab');
      renderPane();
    });

    var debo = null;
    $('#pane-search-input').addEventListener('input', function () {
      clearTimeout(debo);
      var v = this.value;
      debo = setTimeout(function () {
        state.query = v.trim();
        renderPane();
      }, 220);
    });
  }

  /* ── Conversation list ───────────────────────────────────── */
  function loadConversations() {
    if (state.convLoading) return;
    state.convLoading = true;
    var btn = $('#btn-refresh');
    if (btn) btn.classList.add('is-spinning');
    api(EP.conversations)
      .then(function (list) {
        if (!Array.isArray(list)) list = [];
        state.conversations = list;
        state.loaded = true;
        updateCounts();
        renderPane();
      })
      .catch(function (err) {
        if (state.loaded && err.status !== 401) toast(err.message, 'error');
      })
      .then(function () {
        state.convLoading = false;
        if (btn) btn.classList.remove('is-spinning');
      });
  }

  function pendingCount() {
    var n = 0;
    state.conversations.forEach(function (c) { if (!isAnswered(c)) n++; });
    return n;
  }
  function setCount(sel, n) { var el = $(sel); if (el) el.textContent = faNum(n || 0); }
  function updateCounts() {
    var total = state.conversations.length;
    var pend = pendingCount();
    setCount('#cnt-all', total);
    setCount('#cnt-pend', pend);
    setCount('#cnt-ans', total - pend);
    var rc = $('#rail-count');
    if (rc) rc.textContent = faNum(total) + ' نامه';
  }

  function lastTs(c) {
    var p = state.previewCache[c.id];
    if (p && p.created_at) return new Date(p.created_at).getTime() || 0;
    try { return new Date(c.created_at).getTime() || 0; } catch (e) { return 0; }
  }
  function filteredConversations() {
    var list = state.conversations.slice();
    if (state.tab === 'pending')   list = list.filter(function (c) { return !isAnswered(c); });
    if (state.tab === 'answered')  list = list.filter(function (c) { return isAnswered(c); });
    if (state.query) {
      var q = state.query.toLowerCase();
      list = list.filter(function (c) {
        var body = (convPreview(c) || '') + ' ' + (c.user_id != null ? String(c.user_id) : '') + ' ' + convName(c);
        return body.toLowerCase().indexOf(q) !== -1;
      });
    }
    list.sort(function (a, b) { return lastTs(b) - lastTs(a); });
    return list;
  }

  function convName(c) { return 'نامهٔ بی\u200cنام #' + (c && c.id != null ? c.id : '؟'); }
  function convUser(c) { return 'کاربرِ ' + (c && c.user_id != null ? c.user_id : '؟'); }

  function convItemHtml(c) {
    var ans = isAnswered(c);
    return '<div class="conv-item' + (String(state.selectedId) === String(c.id) ? ' active' : '') + '" data-id="' + c.id + '">' +
      '<span class="conv-avatar">' + veil(c.id, ans ? 'am-plain' : 'am-solid') + '</span>' +
      '<div class="conv-body">' +
        '<div class="conv-top">' +
          '<span class="conv-name">' + esc(convName(c)) + '</span>' +
          '<span class="conv-time">' + esc(convTime(c)) + '</span>' +
        '</div>' +
        '<p class="conv-preview">' + esc(convPreview(c)) + '</p>' +
        '<div class="conv-bottom">' +
          '<span class="conv-user">' + esc(convUser(c)) + '</span>' +
          '<span class="chip ' + (ans ? 'chip-answered' : 'chip-pending') + '">' + (ans ? 'پاسخ داده شد' : 'در انتظار') + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function paneSkeletonsHtml() {
    var out = '';
    for (var i = 0; i < 6; i++) {
      out += '<div class="conv-skel">' +
        '<span class="skeleton sk-av"></span>' +
        '<span class="sk-lines"><span class="skeleton sk-line"></span><span class="skeleton sk-line"></span></span>' +
      '</div>';
    }
    return out;
  }
  function paneEmptyHtml() {
    var title, desc;
    if (state.query) {
      title = 'نتیجه\u200cای نبود';
      desc = 'برای «' + esc(state.query) + '» نامه\u200cای پیدا نشد.';
    } else if (state.tab === 'pending') {
      title = 'چیزی در انتظار نیست';
      desc = 'همهٔ نامه\u200cها جواب گرفتند.';
    } else if (state.tab === 'answered') {
      title = 'هنوز پاسخی رد نشده';
      desc = 'نامه‌های پاسخ‌داده‌شده اینجا جمع می‌شوند.';
    } else {
      title = 'هنوز نامه‌ای نرسیده';
      desc = 'به محض رسیدن یک نامهٔ بی‌نام، اینجا دیده می‌شود.';
    }
    return '<div class="pane-empty">' + veil(0, 'am-plain') +
      '<p class="pane-empty-title">' + title + '</p>' +
      '<p class="pane-empty-desc">' + desc + '</p></div>';
  }

  function renderPane() {
    var list = $('#rail-list');
    if (!list) return;
    var items = filteredConversations();
    updateCounts();
    if (items.length) {
      list.innerHTML = items.map(convItemHtml).join('');
      $$('.conv-item', list).forEach(function (el) {
        el.addEventListener('click', function () { selectConversation(el.getAttribute('data-id')); });
      });
    } else if (!state.loaded) {
      list.innerHTML = paneSkeletonsHtml();
    } else {
      list.innerHTML = paneEmptyHtml();
    }
  }

  function refreshRailRow(id) {
    var el = $('.conv-item[data-id="' + id + '"]');
    if (!el) return;
    var p = state.previewCache[id] || {};
    var ans = isAnswered({ status: state.status }) || p.lastSender === 'admin';
    var av = $('.conv-avatar', el);
    if (av) av.innerHTML = veil(id, ans ? 'am-plain' : 'am-solid');
    var tm = $('.conv-time', el);
    if (tm) tm.textContent = fmtRel(p.created_at);
    var pr = $('.conv-preview', el);
    if (pr) pr.textContent = p.content || '';
    var chip = $('.chip', el);
    if (chip) {
      chip.className = 'chip ' + (ans ? 'chip-answered' : 'chip-pending');
      chip.textContent = ans ? 'پاسخ داده شد' : 'در انتظار';
    }
  }

  /* ── Stage (detail) ──────────────────────────────────────── */
  function stageEmptyHtml() {
    return '<div class="stage-empty">' + veil(0, 'am-outline') +
      '<p class="stage-empty-title">هیچ نامه‌ای باز نشده</p>' +
      '<p class="stage-empty-desc">یک نامه از فهرست کنار دست انتخاب کن تا متن آن اینجا باز شود؛ و اگر پاسخی در راه است، همین‌جا بنویس.</p>' +
    '</div>';
  }
  function stageSkeletonHtml() {
    return '<div class="skel-msgs">' +
      '<div class="skeleton skel-msg"></div><div class="skeleton skel-msg"></div>' +
      '<div class="skeleton skel-msg"></div><div class="skeleton skel-msg"></div>' +
    '</div>';
  }
  function dayKey(iso) {
    try { var d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); } catch (e) { return ''; }
  }
  function stageMessagesHtml() {
    var msgs = state.messages || [];
    if (!msgs.length) {
      return '<div class="pane-empty">' + veil(0, 'am-plain') +
        '<p class="pane-empty-title">نامه خالی است</p>' +
        '<p class="pane-empty-desc">متن نامه هنوز ثبت نشده. شاید کاربر چیزی نگفته باشد.</p></div>';
    }
    var out = '';
    var prevKey = null;
    var prevSender = null;
    msgs.forEach(function (m) {
      var k = dayKey(m.created_at);
      if (k !== prevKey) {
        out += '<div class="day"><span>' + esc(fmtDay(m.created_at)) + '</span></div>';
        prevKey = k;
        prevSender = null;
      }
      var isAdmin = m.sender === 'admin';
      var grp = isAdmin === prevSender;
      prevSender = isAdmin;
      out += '<div class="msg ' + (isAdmin ? 'msg-admin' : 'msg-user') + (grp ? ' grp' : '') + '">' +
        '<div class="bubble">' + esc(m.content) + '</div>' +
        '<div class="msg-meta"><span class="who">' + (isAdmin ? 'شما' : 'بی\u200cنام') + '</span><span>' + esc(fmtTime(m.created_at)) + '</span></div>' +
      '</div>';
    });
    return out;
  }

  function replyDockHtml(kind) {
    if (kind === 'loading') {
      return '<div class="reply-dock">' +
        '<div class="compose-line">' +
          '<textarea disabled placeholder="در حال بارگذاری نامه..." rows="1"></textarea>' +
          '<button class="send-btn" disabled type="button">' + icon('send').replace('<svg', '<svg class="flip"') + '</button>' +
        '</div>' +
        '<p class="reply-hint">می‌توانی پاسخ بدهی</p>' +
      '</div>';
    }
    if (kind === 'answered') {
      return '<div class="reply-dock answered">' +
        '<div class="compose-line">' +
          '<textarea disabled placeholder="این نامه قبلاً پاسخ داده شده" rows="1"></textarea>' +
          '<button class="send-btn" disabled type="button">' + icon('lock') + '</button>' +
        '</div>' +
        '<p class="reply-hint closed">پرونده بسته شد — پاسخ فقط یک بار ارسال می‌شود</p>' +
      '</div>';
    }
    return '<div class="reply-dock">' +
      '<div class="compose-line">' +
        '<textarea id="reply-input" placeholder="پاسخ بنویس…" rows="1"></textarea>' +
        '<button class="send-btn" id="reply-send" disabled type="button" aria-label="ارسال پاسخ">' + icon('send').replace('<svg', '<svg class="flip"') + '</button>' +
      '</div>' +
      '<p class="reply-hint">پاسخ فقط یک بار ارسال می‌شود</p>' +
    '</div>';
  }

  function renderStage(d, loading) {
    var stage = $('#stage');
    if (!stage) return;
    if (!d && !loading && !state.selectedId) { stage.innerHTML = stageEmptyHtml(); return; }
    var id = d ? d.id : state.selectedId;
    if (d) {
      if (d.user_id != null) state.selectedUserId = d.user_id;
      if (d.created_at) state.createdAt = d.created_at;
    }
    var status = d ? d.status : state.status;
    var answered = !loading && isAnswered({ id: id, status: status });
    stage.innerHTML =
      '<div class="stage-head">' +
        '<button class="icon-btn stage-back" id="wh-back" type="button" title="بازگشت" aria-label="بازگشت">' + icon('back') + '</button>' +
        '<span class="stage-avatar">' + veil(id, answered ? 'am-plain' : 'am-solid') + '</span>' +
        '<div class="stage-meta">' +
          '<span class="stage-name">' + esc(convName({ id: id })) + '</span>' +
          '<span class="stage-sub">' + esc('کاربرِ ' + (state.selectedUserId != null ? state.selectedUserId : '…')) + ' · ' + esc(fmtRel(state.createdAt)) + '</span>' +
        '</div>' +
        '<span class="stage-status"><span class="chip ' + (answered ? 'chip-answered' : 'chip-pending') + '">' + (answered ? 'پاسخ داده شد' : 'در انتظار') + '</span></span>' +
      '</div>' +
      '<div class="stage-scroll" id="stage-scroll">' + (loading ? stageSkeletonHtml() : stageMessagesHtml()) + '</div>' +
      replyDockHtml(loading ? 'loading' : (answered ? 'answered' : 'active'));
    bindStageEvents();
    if (!loading) scrollStage();
  }

  function scrollStage() {
    var sc = $('#stage-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function bindStageEvents() {
    var back = $('#wh-back');
    if (back) back.addEventListener('click', function () {
      state.selectedId = null;
      state.messages = [];
      state.status = 'pending';
      if (state.detailTimer) { clearTimeout(state.detailTimer); state.detailTimer = null; }
      var sel = $('#stage'); if (sel) sel.innerHTML = stageEmptyHtml();
      setBodyView();
    });

    var ta = $('#reply-input');
    var send = $('#reply-send');
    if (!ta || !send) return;
    function resizeTa() {
      ta.style.height = 'auto';
      ta.style.height = Math.min(150, ta.scrollHeight) + 'px';
    }
    function updateSend() {
      send.disabled = !ta.value.trim() || state.sending;
    }
    function doSend() {
      var v = ta.value.trim();
      if (!v || state.sending || isAnswered({ status: state.status })) return;
      sendReply(v);
    }
    ta.addEventListener('input', function () { updateSend(); resizeTa(); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    send.addEventListener('click', doSend);
    resizeTa();
    updateSend();
    ta.focus();
  }

  /* ── Selection & detail ──────────────────────────────────── */
  function selectConversation(id) {
    if (String(state.selectedId) === String(id) && state.messages.length) return;
    state.selectedId = String(id);
    state.messages = [];
    state.status = 'pending';
    state.detailLoading = false;
    if (state.detailTimer) { clearTimeout(state.detailTimer); state.detailTimer = null; }
    $$('.conv-item').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-id') === String(id));
    });
    setBodyView();
    renderStage(null, true);
    loadDetail(state.selectedId);
    scrollStage();
  }

  function loadDetail(id) {
    if (state.detailLoading) return;
    state.detailLoading = true;
    api(EP.conversation(id))
      .then(function (d) {
        if (String(state.selectedId) !== String(d.id)) return;
        state.messages = d.messages || [];
        state.status = d.status || 'pending';
        state.selectedUserId = d.user_id;
        state.createdAt = d.created_at;
        updatePreviewFromDetail(d);
        renderStage(d, false);
        refreshRailRow(d.id);
        if (!isAnswered(d) && !state.detailTimer) {
          state.detailTimer = setTimeout(function () {
            state.detailTimer = null;
            if (String(state.selectedId) === String(d.id)) loadDetail(d.id);
          }, 8000);
        }
      })
      .catch(function (err) {
        if (String(state.selectedId) === String(id) && err.status !== 401) {
          toast(err.status === 404 ? 'نامه پیدا نشد' : err.message, 'error');
        }
      })
      .then(function () { state.detailLoading = false; });
  }

  /* ── Reply ───────────────────────────────────────────────── */
  function sendReply(content) {
    var id = state.selectedId;
    if (!id || state.sending) return;
    state.sending = true;
    var send = $('#reply-send');
    var ta = $('#reply-input');
    if (send) send.disabled = true;
    if (ta) ta.disabled = true;
    api(EP.reply(id) + '?content=' + encodeURIComponent(content), { method: 'POST' })
      .then(function (m) {
        state.sending = false;
        state.status = 'answered';
        if (state.detailTimer) { clearTimeout(state.detailTimer); state.detailTimer = null; }
        state.messages.push(m);
        state.conversations.forEach(function (c) {
          if (String(c.id) === String(id)) {
            c.status = 'answered';
            if (c.messages && c.messages.length) c.messages[c.messages.length - 1] = m;
            else c.messages = [m];
          }
        });
        updatePreviewFromDetail({ id: id, messages: state.messages, status: 'answered', created_at: state.createdAt || m.created_at });
        renderStage({ id: id, status: 'answered' }, false);
        refreshRailRow(id);
        updateCounts();
        toast('پاسخ ارسال شد؛ نامه بسته شد', 'success');
      })
      .catch(function (err) {
        state.sending = false;
        if (ta) {
          ta.disabled = false;
          ta.focus();
        }
        var s = $('#reply-send');
        if (s) s.disabled = !(ta && ta.value.trim());
        var msg = err.status === 409 ? 'نامه قبلاً پاسخ داده شده است' : (err.status === 404 ? 'نامه پیدا نشد' : err.message);
        toast(msg, 'error');
      });
  }

  /* ── Boot ────────────────────────────────────────────────── */
  function init() {
    if (!document.getElementById('toast-container')) {
      var c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
    }
    window.addEventListener('resize', setBodyView);
    window.addEventListener('online', updateConnState);
    window.addEventListener('offline', updateConnState);
    var token = getToken();
    if (token) {
      state.token = token;
      renderConsole();
      startPolling();
      loadConversations();
    } else {
      renderLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
