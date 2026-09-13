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

  /* 2단계에서 궁합 도구가 match.html 로 옮겨 가기 전까지, 홈의 궁합 도구(/#pair·#group·#pet)에서는 '궁합' 탭을 켠다 */
  var TOOLS = { pair: 1, group: 1, pet: 1 };
  function markTools() {
    if (!/^\/(index\.html)?$/.test(location.pathname)) return;
    var inTools = TOOLS[location.hash.slice(1)] === 1;
    d.querySelectorAll('.yy-tab, .yy-desk a').forEach(function (a) {
      var key = a.getAttribute('data-tab');
      if (key === 'home') a.toggleAttribute('aria-current', !inTools);
      if (key === 'match') a.toggleAttribute('aria-current', inTools);
      if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
    });
    var t = d.querySelector('.yy-title');
    if (t) t.textContent = inTools ? '궁합' : '연결운';
  }
  markTools();
  window.addEventListener('hashchange', markTools);
})();
