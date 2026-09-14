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
        profileOnResult(el);
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
      if (it.action) b.addEventListener('click', it.action);
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

  /* ── 내 정보 · 저장한 사람 (5단계) ─────────────────────────────
   * 이 기기 브라우저(localStorage 'yeongyeol.profile.v1')에만 저장한다. 서버·주소·통계로 보내지 않는다.
   * 저장은 사용자가 직접 할 때만: 시트의 '저장' 항목, 또는 기존 '이 기기에 입력값 저장'을 켠 채 결과를 볼 때.
   * - 입력 화면의 사람 칸 옆 [내 정보] · [저장한 사람/강아지/고양이] 버튼 → 바텀시트에서 채우기·저장
   * - 내 정보가 있으면 입력 화면을 열 때 '나' 칸을 채운다 (공유 링크 값·페이지 자체 저장값이 있으면 건드리지 않는다)
   * - /saju.html#me · /today.html#me 는 내 정보로 채우고 바로 계산
   * - 전체 탭 #yyProfile · 홈 #yyHomeMe 에 내 정보 카드 (지우기 포함) */
  var PKEY = 'yeongyeol.profile.v1';
  var KIND = { person: { label: '사람', img: 'bust_in_silhouette' }, dog: { label: '강아지', img: 'dog_face' }, cat: { label: '고양이', img: 'cat_face' } };
  var GENDER_TEXT = { F: '여성', M: '남성', '': '선택 안 함' };
  function pload() {
    try {
      var p = JSON.parse(localStorage.getItem(PKEY) || 'null');
      if (p && typeof p === 'object') { p.people = Array.isArray(p.people) ? p.people : []; return p; }
    } catch (e) { /* 손상된 값·저장소 차단은 없는 것으로 */ }
    return null;
  }
  function psave(p) {
    try { p.v = 1; localStorage.setItem(PKEY, JSON.stringify(p)); return true; }
    catch (e) { toast('이 브라우저에서는 저장할 수 없어요'); return false; }
  }
  function pclear() { try { localStorage.removeItem(PKEY); } catch (e) { /* 무시 */ } }
  function byId(id) { return d.getElementById(id); }
  function val(id) { var el = byId(id); return el ? String(el.value || '').trim() : ''; }
  function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  function setVal(id, v) {
    var el = byId(id);
    if (!el || v == null) return;
    if (el.tagName === 'SELECT') {
      var opt = [].slice.call(el.options).filter(function (o) { return o.value === String(v) || o.text === String(v); })[0];
      if (!opt) return;
      el.value = opt.value;
    } else el.value = v;
    fire(el);
  }
  function genderFrom(v) { return v === '여성' || v === 'F' ? 'F' : v === '남성' || v === 'M' ? 'M' : ''; }
  function dot(s) { return s ? String(s).replace(/-/g, '.') : ''; }
  function describe(x) {
    var date = x.calendar === 'lunar' ? '음력 ' + dot(x.date) + (x.leap ? ' 윤달' : '') : dot(x.solarDate || x.date);
    return [date, x.time || '시간 모름', x.breed || '', x.gender === 'F' ? '여성' : x.gender === 'M' ? '남성' : ''].filter(Boolean).join(' · ');
  }
  var toastTimer = 0;
  function toast(msg) {
    var t = d.querySelector('.yy-toast');
    if (!t) { t = d.createElement('div'); t.className = 'yy-toast'; t.setAttribute('role', 'status'); d.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  /* 페이지별 입력 칸 — 테스트 사본(_t…_이름.html)도 같은 설정을 쓴다 */
  var PAGE = location.pathname.replace(/^\/_t[0-9a-z]*_/, '/');
  var FORMS = {
    '/saju.html': { run: 'runChart', groups: [{ role: 'me', saju: true, stored: 'yeongyeol.chart.v1', before: '.formCard' }] },
    '/today.html': { run: 'runToday', groups: [{ role: 'me', ids: { name: 'todayName', date: 'todayDate', time: 'todayTime' }, before: 'section.card.pad.grid2' }] },
    '/match.html': { groups: [
      { role: 'me', ids: { name: 'nameA', date: 'dateA', time: 'timeA', gender: 'genderA' }, into: ['#pairView .person h2', 0], stored: 'yeongyeol.inputs.v3', query: 'dateA' },
      { role: 'other', kind: 'person', ids: { name: 'nameB', date: 'dateB', time: 'timeB', gender: 'genderB' }, into: ['#pairView .person h2', 1] },
      { role: 'group', into: ['#groupView .groupToolbar', 0] },
      { role: 'other', kind: 'dog', ids: { name: 'petName', date: 'petDate', time: 'petTime', breed: 'petBreed' }, into: ['#petView h3', '우리 아이'], autofill: true },
      { role: 'me', ids: { name: 'ownerName', date: 'ownerDate', time: 'ownerTime' }, into: ['#petView h3', '보호자'] }
    ] },
    '/cat.html': { groups: [
      { role: 'other', kind: 'cat', ids: { name: 'catName', date: 'catDate', time: 'catTime', breed: 'catBreed' }, into: ['h3', '우리 고양이'], autofill: true },
      { role: 'me', ids: { name: 'catOwner', date: 'catOwnerDate', time: 'catOwnerTime' }, into: ['h3', '집사'] }
    ] }
  };

  function readSaju() {
    var cal = (d.querySelector('input[name="cal"]:checked') || {}).value || 'solar';
    var date = val('by') + '-' + ('0' + val('bm')).slice(-2) + '-' + ('0' + val('bd')).slice(-2);
    var unknown = !!(byId('timeUnknown') && byId('timeUnknown').checked);
    var x = { name: '나', calendar: cal, leap: cal === 'lunar' && !!(byId('leap') && byId('leap').checked), date: date,
      time: unknown ? '' : val('birthTime'), gender: (d.querySelector('input[name="gender"]:checked') || {}).value || '' };
    x.solarDate = cal === 'solar' ? date : '';
    if (cal === 'lunar' && window.YY && window.YY.chart) {
      try { x.solarDate = window.YY.chart({ calendar: 'lunar', leap: x.leap, date: date, time: x.time, gender: x.gender || 'F' }).input.solarDate; } catch (e) { /* 없는 음력 날짜면 양력 칸은 비워 둔다 */ }
    }
    return x;
  }
  function fillSaju(x) {
    var cal = d.querySelector('input[name="cal"][value="' + (x.calendar === 'lunar' ? 'lunar' : 'solar') + '"]');
    if (cal) { cal.checked = true; fire(cal); }
    var p = String(x.date || '').split('-');
    if (p.length === 3) { setVal('by', +p[0]); setVal('bm', +p[1]); setVal('bd', +p[2]); }
    if (byId('leap')) byId('leap').checked = x.calendar === 'lunar' && !!x.leap;
    var tu = byId('timeUnknown');
    if (x.time) { setVal('birthTime', x.time); if (tu && tu.checked) { tu.checked = false; fire(tu); } }
    else if (tu && !tu.checked) { tu.checked = true; fire(tu); }
    var g = d.querySelector('input[name="gender"][value="' + (x.gender === 'M' ? 'M' : 'F') + '"]');
    if (g) { g.checked = true; fire(g); }
  }
  function readGroup(g) {
    if (g.saju) return readSaju();
    var x = { name: val(g.ids.name), date: val(g.ids.date), time: g.ids.time ? val(g.ids.time) : '', calendar: 'solar', leap: false };
    x.solarDate = x.date;
    if (g.ids.gender) x.gender = genderFrom(val(g.ids.gender));
    if (g.ids.breed) x.breed = val(g.ids.breed);
    return x;
  }
  function fillGroup(g, x) {
    if (g.saju) { fillSaju(x); return; }
    var date = x.solarDate || (x.calendar !== 'lunar' ? x.date : '');
    if (g.ids.name && x.name) setVal(g.ids.name, x.name);
    if (date) setVal(g.ids.date, date);
    if (g.ids.time) setVal(g.ids.time, x.time || '');
    if (g.ids.gender && x.gender != null) setVal(g.ids.gender, GENDER_TEXT[x.gender || '']);
    if (g.ids.breed && x.breed) setVal(g.ids.breed, x.breed);
  }

  function saveMe(x, quiet) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) { if (!quiet) toast('생년월일을 먼저 입력해 주세요'); return; }
    var p = pload() || { me: null, people: [] }, prev = p.me || {};
    p.me = { name: x.name || prev.name || '나', calendar: x.calendar || 'solar', leap: !!x.leap, date: x.date,
      solarDate: x.solarDate || (x.calendar === 'lunar' ? '' : x.date), time: x.time || '', gender: x.gender || prev.gender || '', updated: Date.now() };
    if (psave(p)) { if (!quiet) toast('내 정보를 이 기기에 저장했어요'); renderProfileViews(); }
  }
  function saveOther(kind, x, quiet) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) { if (!quiet) toast('생년월일을 먼저 입력해 주세요'); return; }
    var p = pload() || { me: null, people: [] }, name = x.name || KIND[kind].label;
    p.people = p.people.filter(function (y) { return !(y.kind === kind && y.name === name); });
    p.people.unshift({ id: kind + '-' + Date.now().toString(36), kind: kind, name: name, date: x.date, solarDate: x.solarDate || x.date, calendar: 'solar',
      time: x.time || '', gender: x.gender || '', breed: x.breed || '', updated: Date.now() });
    p.people = p.people.slice(0, 10);
    if (psave(p)) { if (!quiet) toast(name + ' 정보를 저장했어요'); renderProfileViews(); }
  }

  function openPicker(g) {
    var p = pload(), items = [];
    if (g.role === 'me') {
      if (p && p.me) items.push({ label: '내 정보 불러오기', sub: describe(p.me), svg: 'user', action: function () { fillGroup(g, p.me); toast('내 정보를 채웠어요'); } });
      items.push({ label: p && p.me ? '지금 입력한 값으로 내 정보 바꾸기' : '지금 입력한 값을 내 정보로 저장', sub: '이 기기에만 저장돼요 · 전체 탭에서 지울 수 있어요', svg: 'save',
        action: function () { saveMe(readGroup(g)); } });
      openSheet({ title: '내 정보', items: items });
      return;
    }
    if (g.role === 'group') {
      var ppl = (p && p.me ? [p.me] : []).concat((p ? p.people : []).filter(function (y) { return y.kind === 'person'; }));
      ppl.forEach(function (y) {
        var name = y.name || '나';
        items.push({ label: y === (p && p.me) ? name + ' (내 정보)' : name, sub: describe(y), svg: 'plus', action: function () {
          if (typeof window.addGroupPerson === 'function') window.addGroupPerson({ name: name, date: y.solarDate || y.date, time: y.time || '' });
          toast(name + ' 님을 추가했어요');
        } });
      });
      if (!items.length) items.push({ label: '저장한 사람이 아직 없어요', sub: '1:1 궁합이나 내 사주에서 저장하면 여기서 바로 추가할 수 있어요', svg: 'user' });
      openSheet({ title: '저장한 사람 추가', items: items });
      return;
    }
    (p ? p.people : []).filter(function (y) { return y.kind === g.kind; }).forEach(function (y) {
      items.push({ label: y.name, sub: describe(y), svg: 'user', action: function () { fillGroup(g, y); toast(y.name + ' 정보를 채웠어요'); } });
    });
    items.push({ label: '지금 입력한 ' + (g.kind === 'person' ? '상대' : KIND[g.kind].label) + ' 저장하기', sub: '이 기기에만 저장돼요 · 최대 10개', svg: 'save',
      action: function () { saveOther(g.kind, readGroup(g)); } });
    openSheet({ title: '저장한 ' + KIND[g.kind].label, items: items });
  }

  function mountPickers(cfg) {
    cfg.groups.forEach(function (g) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'yy-pick';
      b.innerHTML = svg(g.role === 'group' ? 'plus' : 'user') + '<span>' + (g.role === 'me' ? '내 정보' : g.role === 'group' ? '저장한 사람' : '저장한 ' + KIND[g.kind].label) + '</span>';
      b.addEventListener('click', function () { openPicker(g); });
      if (g.before) {
        var anchor = d.querySelector(g.before);
        if (!anchor) return;
        var row = d.createElement('div');
        row.className = 'yy-pickrow';
        row.appendChild(b);
        anchor.parentNode.insertBefore(row, anchor);
        return;
      }
      var list = [].slice.call(d.querySelectorAll(g.into[0]));
      var host = typeof g.into[1] === 'number' ? list[g.into[1]] : list.filter(function (x) { return x.textContent.indexOf(g.into[1]) >= 0; })[0];
      if (!host) return;
      host.classList.add('yy-pick-host');
      host.appendChild(b);
    });
  }

  function autofill(cfg) {
    var p = pload();
    if (!p) return;
    cfg.groups.forEach(function (g) {
      if (g.role === 'me' && p.me) {
        var own = false;
        try { own = !!(g.stored && localStorage.getItem(g.stored)); } catch (e) { own = false; }
        var fromQuery = g.query && new RegExp('[?&]' + g.query + '=').test(location.search);
        if (!own && !fromQuery) fillGroup(g, p.me);
      }
      if (g.role === 'other' && g.autofill) {
        var y = p.people.filter(function (z) { return z.kind === g.kind; })[0];
        if (y) fillGroup(g, y);
      }
    });
  }

  function runFromMe(cfg) {
    if (location.hash !== '#me') return;
    history.replaceState(history.state, '', location.pathname + location.search);
    var p = pload();
    if (!p || !p.me || !cfg.run || typeof window[cfg.run] !== 'function') return;
    fillGroup(cfg.groups[0], p.me);
    setTimeout(function () { window[cfg.run](); }, 60);
  }

  /* 기존 '이 기기에 입력값 저장'을 켠 채 결과를 보면 내 정보도 함께 맞춰 둔다(사용자가 저장을 고른 경우만) */
  function profileOnResult(el) {
    var cfg = FORMS[PAGE], box = byId('saveLocal');
    if (!cfg || !box || !box.checked) return;
    if (PAGE === '/saju.html' && el.id === 'chartResult') {
      var x = readSaju(), last = window.__chartPage && window.__chartPage.last && window.__chartPage.last();
      if (last && last.input) x.solarDate = last.input.solarDate;
      saveMe(x, true);
    } else if (PAGE === '/match.html' && el.id === 'result') {
      saveMe(readGroup(cfg.groups[0]), true);
      saveOther('person', readGroup(cfg.groups[1]), true);
    }
  }

  function renderProfileViews() {
    var p = pload(), me = p && p.me, ppl = p ? p.people : [];
    var box = byId('yyProfile');
    if (box) {
      var h = '<h2>내 정보</h2><div class="yy-list">';
      if (me) {
        h += '<div class="yy-row"><span class="yy-ico"><img src="/assets/icons3d/crystal_ball.png" alt=""></span><span class="yy-row-t"><b>' + esc(me.name || '나') + '</b><small>' + esc(describe(me)) + '</small></span>' +
          '<button type="button" class="yy-mini" data-yy-del="me" aria-label="내 정보 지우기">' + svg('trash') + '</button></div>' +
          '<div class="yy-row-actions"><a class="yy-chipbtn" href="/saju.html#me">내 사주 풀이</a><a class="yy-chipbtn" href="/today.html#me">오늘운</a></div>';
      } else {
        h += '<a class="yy-row" href="/saju.html"><span class="yy-ico"><img src="/assets/icons3d/crystal_ball.png" alt=""></span><span class="yy-row-t"><b>내 정보를 저장해 보세요</b>' +
          '<small>한 번 저장하면 사주·궁합·오늘운에 자동으로 채워져요</small></span>' + svg('next') + '</a>';
      }
      h += '</div>';
      if (ppl.length) {
        h += '<h2 class="yy-sub2">저장한 사람 · 반려동물</h2><div class="yy-list">' + ppl.map(function (y) {
          return '<div class="yy-row"><span class="yy-ico"><img src="/assets/icons3d/' + KIND[y.kind].img + '.png" alt=""></span><span class="yy-row-t"><b>' + esc(y.name) + '</b><small>' +
            esc(KIND[y.kind].label + ' · ' + describe(y)) + '</small></span><button type="button" class="yy-mini" data-yy-del="' + esc(y.id) + '" aria-label="' + esc(y.name) + ' 지우기">' + svg('trash') + '</button></div>';
        }).join('') + '</div>';
      }
      if (me || ppl.length) h += '<button type="button" class="yy-textbtn" data-yy-del="all">이 기기에 저장한 정보 모두 지우기</button>';
      h += '<p class="yy-note">생년월일은 이 기기의 브라우저에만 저장되고 서버로 보내지 않아요.</p>';
      box.innerHTML = h;
      box.hidden = false;
    }
    var home = byId('yyHomeMe');
    if (home) {
      home.hidden = !me;
      home.innerHTML = me ? '<div class="yy-mecard"><div class="yy-mecard-t"><small>내 정보</small><b>' + esc(me.name || '나') + '</b><span>' + esc(describe(me)) + '</span></div>' +
        '<div class="yy-mecard-a"><a href="/saju.html#me">내 사주 풀이</a><a href="/today.html#me">오늘운</a></div></div>' : '';
    }
  }

  d.addEventListener('click', function (e) {
    var del = closest(e.target, '[data-yy-del]');
    if (!del) return;
    var key = del.getAttribute('data-yy-del');
    openSheet({ title: key === 'all' ? '저장한 정보를 모두 지울까요?' : '이 정보를 지울까요?', items: [{ label: '지우기', sub: '이 기기에서만 지워져요', svg: 'trash', action: function () {
      var p = pload();
      if (!p) return;
      if (key === 'all') pclear();
      else {
        if (key === 'me') p.me = null; else p.people = p.people.filter(function (y) { return y.id !== key; });
        if (!p.me && !p.people.length) pclear(); else psave(p);
      }
      renderProfileViews();
      toast('지웠어요');
    } }] });
  });

  (function initProfile() {
    var cfg = FORMS[PAGE];
    if (cfg) { mountPickers(cfg); autofill(cfg); runFromMe(cfg); }
    renderProfileViews();
  })();

  window.YYShell = { openResult: openResult, closeResult: closeResult, openSheet: openSheet, closeSheet: closeSheet, toast: toast };
  window.YYProfile = { get: pload, clear: function () { pclear(); renderProfileViews(); } };
})();
