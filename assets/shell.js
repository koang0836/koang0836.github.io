/* 연결운 웹앱 셸 동작 (APP_NAV_DESIGN.md 1·3·4단계)
 * - ← 뒤로: 사이트 안에서 왔으면 브라우저 뒤로가기, 바로 들어왔으면 상위 페이지(href)로
 * - 입력칸에 글자를 칠 때는 하단 탭 숨김 (키보드가 탭 바를 밀어 올리는 문제)
 * - 탭을 누르려는 순간 그 페이지를 미리 받아 두기 (탭 전환이 거의 즉시)
 * - 지금 탭을 한 번 더 누르면 맨 위로 · 앱 바 아래 선은 스크롤했을 때만
 * - 결과 화면(3단계) · 화면 전환 움직임과 바텀시트(4단계)
 * 개인정보: 아무것도 저장하거나 보내지 않는다(전환 방향 표시 한 글자만 sessionStorage 에 잠깐 둔다). */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function closest(el, sel) { return el && el.closest ? el.closest(sel) : null; }
  function svg(name) { return '<svg class="yy-i" aria-hidden="true"><use href="/assets/icons.svg#i-' + name + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* 다음 페이지가 어떤 움직임으로 나타날지 표시 — shell-head.js 가 읽고 지운다 */
  function setNav(dir) { try { sessionStorage.setItem('yy-nav', dir); } catch (e) { /* 저장소 차단 시 움직임 없이 이동 */ } }
  /* 같은 페이지 안의 화면 바꾸기(결과 열기·닫기)에 쓰는 전환 */
  function vt(fn, dir) {
    if (!d.startViewTransition || reduce || d.hidden) { fn(); return; }
    root.setAttribute('data-yy-nav', dir);
    var clear = function () { root.removeAttribute('data-yy-nav'); };
    d.startViewTransition(fn).finished.then(clear, clear);
  }

  d.addEventListener('click', function (e) {
    if (closest(e.target, '[data-yy-share]')) { e.preventDefault(); openShare(); return; }
    if (closest(e.target, '[data-yy-close]')) {
      e.preventDefault();
      if (history.state && history.state.yyResult) { R.navDir = 'back'; history.back(); }
      else { vt(function () { closeResult(); }, 'back'); history.replaceState(null, '', location.pathname + location.search + baseHash()); }
      return;
    }
    var back = closest(e.target, '[data-back]');
    if (back) {
      setNav('back');
      try {
        var ref = d.referrer ? new URL(d.referrer) : null;
        if (ref && ref.origin === location.origin && history.length > 1) { e.preventDefault(); history.back(); }
      } catch (err) { /* 주소 해석 실패 시 링크 그대로 이동 */ }
      return;
    }
    var tab = closest(e.target, '.yy-tab[aria-current="page"], .yy-desk a[aria-current="page"]');
    if (tab && tab.pathname === location.pathname && !location.hash) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    /* 본문 안의 링크로 다른 페이지에 들어가면 옆에서 밀려 들어오게 — 하단 탭·헤더 메뉴는 즉시 전환 */
    var a = closest(e.target, 'a[href]');
    if (a && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && a.target !== '_blank' &&
        !a.hasAttribute('download') && a.origin === location.origin && a.pathname !== location.pathname && !closest(a, '.yy-tabbar, .yy-desk')) {
      setNav('forward');
    }
  });

  var TYPING = 'input:not([type=checkbox]):not([type=radio]):not([type=date]):not([type=time]):not([type=range]):not([type=button]):not([type=submit]),textarea';
  d.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches(TYPING)) root.classList.add('yy-typing'); });
  d.addEventListener('focusout', function () {
    setTimeout(function () { var a = d.activeElement; if (!a || !a.matches || !a.matches(TYPING)) root.classList.remove('yy-typing'); }, 60);
  });

  var fetched = {};
  function prefetch(e) {
    var a = closest(e.target, '.yy-tab, .yy-desk a');
    if (!a || fetched[a.href] || a.getAttribute('aria-current') === 'page') return;
    fetched[a.href] = 1;
    var l = d.createElement('link'); l.rel = 'prefetch'; l.href = a.href; d.head.appendChild(l);
  }
  d.addEventListener('touchstart', prefetch, { passive: true });
  d.addEventListener('mouseover', prefetch);

  var bar = d.querySelector('.yy-appbar');
  if (bar) {
    var onScroll = function () { bar.classList.toggle('yy-scrolled', window.scrollY > 4); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 결과 화면 (3단계) ─────────────────────────────────────────
   * [data-yy-result] 컨테이너에 .show 가 붙으면(페이지의 계산 함수가 결과를 보여 줄 때) 결과 화면으로 바꾼다.
   * - 입력 영역(결과보다 앞에 있는 형제들)을 숨기고 맨 위로 — 옆에서 밀려 들어오는 전환(4단계)
   * - 앱 바: ← 입력 화면으로 + 결과 제목(data-yy-title / data-yy-title-sel) + 공유(data-yy-share 가 있을 때)
   * - 결과 안 [data-yy-chip] 으로 섹션 칩 — 누르면 그 섹션으로, 스크롤하면 칩이 따라 켜진다
   * - 하단 탭 대신 고정 버튼: 다시 입력 + data-yy-next="라벨|주소"
   * - 주소 끝에 #result(#pair → #pair-result)를 쌓아 휴대폰 뒤로가기 = 입력 화면(스크롤 위치 복원)
   * 생년월일은 주소에 넣지 않으므로 결과 주소로 새로고침하면 입력 화면이 나온다. */
  var R = { el: null, hidden: [], scroll: 0, bar: null, items: null, actions: null, orig: '', tick: 0, navDir: null };
  var SUFFIX = /-?result$/;
  function baseHash() { var h = location.hash.slice(1).replace(SUFFIX, ''); return h ? '#' + h : ''; }
  if (SUFFIX.test(location.hash.slice(1))) history.replaceState(null, '', location.pathname + location.search + baseHash());
  function visible(n) { return !!(n && (n.offsetParent !== null || n.tagName === 'DETAILS')); }

  function hidePreceding(el) {
    for (var node = el; node && node.parentElement && node.parentElement !== d.body; node = node.parentElement) {
      for (var sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
        if (!sib.classList.contains('yy-hid')) { sib.classList.add('yy-hid'); R.hidden.push(sib); }
      }
    }
  }

  function buildChips(el) {
    if (R.bar) { R.bar.remove(); R.bar = null; R.items = null; }
    var targets = [].slice.call(el.querySelectorAll('[data-yy-chip]')).filter(visible);
    if (!targets.length) return;
    var items = targets.map(function (t) { return { label: t.getAttribute('data-yy-chip'), el: t }; });
    var first = [].slice.call(el.children).filter(visible)[0];
    if (first && first !== targets[0] && !first.contains(targets[0])) items.unshift({ label: '요약', el: el });
    var nav = d.createElement('nav');
    nav.className = 'yy-secbar';
    nav.setAttribute('aria-label', '결과 목차');
    items.forEach(function (it) {
      var b = d.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      b.addEventListener('click', function () {
        if (it.el.tagName === 'DETAILS') it.el.open = true;
        if (it.el === el) window.scrollTo({ top: 0, behavior: 'smooth' });
        else it.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      it.btn = b;
      nav.appendChild(b);
    });
    var ab = d.querySelector('.yy-appbar');
    if (ab && ab.parentNode === d.body) ab.after(nav); else d.body.prepend(nav);
    R.bar = nav;
    R.items = items;
  }

  function spyUpdate() {
    if (!R.bar || !R.items) return;
    var line = R.bar.getBoundingClientRect().bottom + 16, on = R.items[0];
    R.items.forEach(function (it) { if (it.el !== R.el && it.el.getBoundingClientRect().top <= line) on = it; });
    R.items.forEach(function (it) { it.btn.classList.toggle('on', it === on); });
    var b = on.btn;
    if (b.offsetLeft < R.bar.scrollLeft || b.offsetLeft + b.offsetWidth > R.bar.scrollLeft + R.bar.clientWidth) R.bar.scrollLeft = Math.max(0, b.offsetLeft - 14);
  }
  /* requestAnimationFrame 은 백그라운드 탭·일부 인앱 브라우저에서 멈추므로 짧은 타이머로 묶는다 */
  window.addEventListener('scroll', function () {
    if (!R.bar || R.tick) return;
    R.tick = setTimeout(function () { R.tick = 0; spyUpdate(); }, 60);
  }, { passive: true });

  function buildActions(el) {
    if (!R.actions) { R.actions = d.createElement('div'); R.actions.className = 'yy-actionbar'; d.body.appendChild(R.actions); }
    var next = (el.getAttribute('data-yy-next') || '').split('|');
    R.actions.innerHTML = '<button type="button" class="yy-act-sub" data-yy-close>다시 입력</button>' +
      (next[0] && next[1] ? '<a class="yy-act-main" href="' + esc(next[1]) + '">' + esc(next[0]) + '</a>' : '');
  }

  function openResult(el) {
    var title = el.getAttribute('data-yy-title') || '결과';
    var sel = el.getAttribute('data-yy-title-sel');
    if (sel) { var t = d.querySelector(sel); if (t && t.textContent.trim()) title = t.textContent.trim(); }
    var fresh = R.el !== el;
    var inputScroll = window.scrollY;
    function apply() {
      if (fresh) {
        if (R.el) closeResult({ noScroll: true });
        R.el = el;
        R.scroll = inputScroll;
        hidePreceding(el);
        var inner = d.querySelector('.yy-appbar-in');
        if (inner) {
          R.orig = inner.innerHTML;
          var desk = inner.querySelector('.yy-desk');
          inner.innerHTML = '<button type="button" class="yy-back" data-yy-close aria-label="입력 화면으로">' + svg('back') + '</button>' +
            '<div class="yy-title"></div>' +
            (el.hasAttribute('data-yy-share') ? '<button type="button" class="yy-back yy-share" data-yy-share aria-label="공유하기">' + svg('share') + '</button>' : '') +
            (desk ? desk.outerHTML : '');
        }
        buildActions(el);
        root.classList.add('yy-result');
        if (!(history.state && history.state.yyResult)) {
          var h = location.hash.slice(1);
          history.pushState({ yyResult: 1 }, '', location.pathname + location.search + '#' + (h ? h + '-result' : 'result'));
        }
      }
      var tt = d.querySelector('.yy-appbar .yy-title');
      if (tt) tt.textContent = title;
      buildChips(el);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (fresh) vt(apply, 'forward'); else apply();
    setTimeout(function () { window.scrollTo({ top: 0, behavior: 'instant' }); spyUpdate(); }, 60);
  }

  function closeResult(opts) {
    opts = opts || {};
    if (!R.el) return;
    closeSheet();
    var el = R.el;
    R.el = null;
    R.hidden.forEach(function (n) { n.classList.remove('yy-hid'); });
    R.hidden = [];
    var inner = d.querySelector('.yy-appbar-in');
    if (inner && R.orig) inner.innerHTML = R.orig;
    if (R.bar) { R.bar.remove(); R.bar = null; R.items = null; }
    root.classList.remove('yy-result');
    el.classList.remove('show');
    if (!opts.noScroll) window.scrollTo({ top: R.scroll, behavior: 'instant' });
  }

  window.addEventListener('popstate', function () {
    closeSheet();
    var inResultEntry = history.state && history.state.yyResult;
    if (R.el && !inResultEntry) {
      var dir = R.navDir;
      R.navDir = null;
      /* 화면 안 버튼으로 돌아갈 때만 움직인다 — 휴대폰 뒤로 제스처는 브라우저가 이미 움직임을 보여 준다 */
      if (dir) vt(function () { closeResult(); }, dir); else closeResult();
    } else if (!R.el && inResultEntry) {
      history.replaceState(null, '', location.pathname + location.search + baseHash());
    }
  });
  window.addEventListener('hashchange', function () {
    if (R.el && !SUFFIX.test(location.hash.slice(1))) closeResult({ noScroll: true });
  });
  d.querySelectorAll('[data-yy-result]').forEach(function (el) {
    new MutationObserver(function () { if (el.classList.contains('show')) openResult(el); })
      .observe(el, { attributes: true, attributeFilter: ['class'] });
  });

  /* ── 바텀시트 (4단계) ──────────────────────────────────────────
   * 아래에서 올라오는 선택 창. 바깥·닫기·Esc·아래로 끌기·뒤로가기로 닫힌다.
   * 항목은 onclick 속성으로 기존 함수를 부른다 — analytics.js 가 같은 함수명으로 공유 이벤트를 센다. */
  var S = { back: null, sheet: null };
  function closeSheet() {
    if (!S.sheet) return;
    var b = S.back, s = S.sheet;
    S.back = S.sheet = null;
    b.classList.remove('on');
    s.classList.remove('on');
    setTimeout(function () { b.remove(); s.remove(); }, reduce ? 0 : 260);
  }
  function openSheet(opts) {
    closeSheet();
    opts = opts || {};
    var back = d.createElement('div');
    back.className = 'yy-sheet-back';
    var sheet = d.createElement('div');
    sheet.className = 'yy-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    if (opts.title) sheet.setAttribute('aria-label', opts.title);
    sheet.innerHTML = '<div class="yy-sheet-grab" aria-hidden="true"></div>' +
      (opts.title ? '<div class="yy-sheet-title">' + esc(opts.title) + '</div>' : '') +
      '<div class="yy-sheet-list"></div><button type="button" class="yy-sheet-cancel">닫기</button>';
    var list = sheet.querySelector('.yy-sheet-list');
    (opts.items || []).forEach(function (it) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'yy-sheet-item';
      if (it.onclick) b.setAttribute('onclick', it.onclick);
      b.innerHTML = (it.svg ? '<span class="yy-ic">' + svg(it.svg) + '</span>' : '') +
        '<span class="yy-sheet-label">' + esc(it.label) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>';
      b.addEventListener('click', function () { setTimeout(closeSheet, 0); });
      list.appendChild(b);
    });
    back.addEventListener('click', closeSheet);
    sheet.querySelector('.yy-sheet-cancel').addEventListener('click', closeSheet);
    var y0 = null, dy = 0;
    sheet.addEventListener('touchstart', function (e) { if (sheet.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; }, { passive: true });
    sheet.addEventListener('touchmove', function (e) { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    sheet.addEventListener('touchend', function () {
      if (y0 === null) return;
      sheet.style.transition = '';
      sheet.style.transform = '';
      y0 = null;
      if (dy > 80) closeSheet();
    });
    d.body.appendChild(back);
    d.body.appendChild(sheet);
    S.back = back;
    S.sheet = sheet;
    setTimeout(function () { back.classList.add('on'); sheet.classList.add('on'); var f = sheet.querySelector('.yy-sheet-item'); if (f) f.focus({ preventScroll: true }); }, 16);
  }
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  function openShare() {
    if (!R.el) return;
    var items = (R.el.getAttribute('data-yy-share') || '').split(';').map(function (x) {
      var p = x.split('|');
      if (!p[0] || !p[1]) return null;
      var label = p[0].trim();
      return { label: label, onclick: p[1].trim(), svg: /카드|이미지/.test(label) ? 'image' : /링크/.test(label) ? 'link' : 'copy' };
    }).filter(Boolean);
    if (items.length) openSheet({ title: '공유하기', items: items });
  }

  window.YYShell = { openResult: openResult, closeResult: closeResult, openSheet: openSheet, closeSheet: closeSheet };
})();
