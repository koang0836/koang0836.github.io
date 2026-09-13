/* 연결운 웹앱 셸 동작 (APP_NAV_DESIGN.md 1단계)
 * - ← 뒤로: 사이트 안에서 왔으면 브라우저 뒤로가기, 바로 들어왔으면 상위 페이지(href)로
 * - 입력칸에 글자를 칠 때는 하단 탭 숨김 (키보드가 탭 바를 밀어 올리는 문제)
 * - 탭을 누르려는 순간 그 페이지를 미리 받아 두기 (탭 전환이 거의 즉시)
 * - 지금 탭을 한 번 더 누르면 맨 위로
 * - 앱 바 아래 선: 스크롤했을 때만
 * 개인정보: 아무것도 저장하거나 보내지 않는다. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  function closest(el, sel) { return el && el.closest ? el.closest(sel) : null; }

  d.addEventListener('click', function (e) {
    var close = closest(e.target, '[data-yy-close]');
    if (close) {
      e.preventDefault();
      if (history.state && history.state.yyResult) history.back();
      else { closeResult(); history.replaceState(null, '', location.pathname + location.search + baseHash()); }
      return;
    }
    var back = closest(e.target, '[data-back]');
    if (back) {
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

  /* ── 결과 화면 (APP_NAV_DESIGN.md 3단계) ─────────────────────────
   * [data-yy-result] 컨테이너에 .show 가 붙으면(페이지의 계산 함수가 결과를 보여 줄 때) 결과 화면으로 바꾼다.
   * - 입력 영역(결과보다 앞에 있는 형제들)을 숨기고 맨 위로
   * - 앱 바: ← 입력 화면으로 + 결과 제목(data-yy-title / data-yy-title-sel)
   * - 결과 안 [data-yy-chip] 으로 섹션 칩 — 누르면 그 섹션으로, 스크롤하면 칩이 따라 켜진다
   * - 하단 탭 대신 고정 버튼: 다시 입력 + data-yy-next="라벨|주소"
   * - 주소 끝에 #result(#pair → #pair-result)를 쌓아 휴대폰 뒤로가기 = 입력 화면(스크롤 위치 복원)
   * 생년월일은 주소에 넣지 않으므로 결과 주소로 새로고침하면 입력 화면이 나온다. */
  var R = { el: null, hidden: [], scroll: 0, bar: null, items: null, actions: null, orig: '', tick: 0 };
  var SUFFIX = /-?result$/;
  function baseHash() { var h = location.hash.slice(1).replace(SUFFIX, ''); return h ? '#' + h : ''; }
  if (SUFFIX.test(location.hash.slice(1))) history.replaceState(null, '', location.pathname + location.search + baseHash());
  function svg(name) { return '<svg class="yy-i" aria-hidden="true"><use href="/assets/icons.svg#i-' + name + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
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
    var bar = d.createElement('nav');
    bar.className = 'yy-secbar';
    bar.setAttribute('aria-label', '결과 목차');
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
      bar.appendChild(b);
    });
    var ab = d.querySelector('.yy-appbar');
    if (ab && ab.parentNode === d.body) ab.after(bar); else d.body.prepend(bar);
    R.bar = bar;
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
    if (R.el !== el) {
      if (R.el) closeResult({ noScroll: true });
      R.el = el;
      R.scroll = window.scrollY;
      hidePreceding(el);
      var inner = d.querySelector('.yy-appbar-in');
      if (inner) {
        R.orig = inner.innerHTML;
        var desk = inner.querySelector('.yy-desk');
        inner.innerHTML = '<button type="button" class="yy-back" data-yy-close aria-label="입력 화면으로">' + svg('back') + '</button>' +
          '<div class="yy-title"></div>' + (desk ? desk.outerHTML : '');
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
    setTimeout(function () { window.scrollTo({ top: 0, behavior: 'instant' }); spyUpdate(); }, 0);
  }

  function closeResult(opts) {
    opts = opts || {};
    if (!R.el) return;
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
    var inResultEntry = history.state && history.state.yyResult;
    if (R.el && !inResultEntry) closeResult();
    else if (!R.el && inResultEntry) history.replaceState(null, '', location.pathname + location.search + baseHash());
  });
  window.addEventListener('hashchange', function () {
    if (R.el && !SUFFIX.test(location.hash.slice(1))) closeResult({ noScroll: true });
  });
  d.querySelectorAll('[data-yy-result]').forEach(function (el) {
    new MutationObserver(function () { if (el.classList.contains('show')) openResult(el); })
      .observe(el, { attributes: true, attributeFilter: ['class'] });
  });
  window.YYShell = { openResult: openResult, closeResult: closeResult };
})();
