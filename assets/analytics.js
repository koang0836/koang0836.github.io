/* 연결운 방문·행동 측정
 *
 * 설계 원칙
 * ---------
 * 1) 개인정보를 절대 내보내지 않는다.
 *    이 사이트는 `saveURL()`이 이름·생년월일·출생시간·성별을 URL 쿼리에 담는다.
 *    그 링크로 들어온 방문을 그대로 기록하면 생년월일이 분석 서버로 나간다.
 *    그래서 **쿼리스트링과 해시를 떼고 경로만** 보낸다. 설정으로 끌 수 없게 고정했다.
 *    같은 이유로 제공자의 자동 페이지뷰를 끄고 정제한 URL로 직접 한 번 보낸다.
 *
 * 2) 기본은 꺼져 있다. config.js에 실제 발급받은 값을 넣어야만 동작한다.
 *    ads.js와 같은 방식이다. 임의의 ID를 코드에 넣지 않는다.
 *
 * 3) 쿠키를 쓰지 않는 제공자를 우선한다(plausible·umami).
 *    ga4는 쿠키를 쓰므로 개인정보처리방침과 동의 처리를 따로 확인해야 한다.
 *
 * 4) 측정이 실패해도 사이트 기능은 영향받지 않는다. 전부 try/catch에 감싼다.
 *
 * 이벤트는 자동으로 붙는다
 * ------------------------
 * 페이지의 onclick 속성을 읽어서 위임 처리하므로 139개 HTML을 고칠 필요가 없다.
 * 새 버튼을 추가하면 EVENT_MAP에 함수명만 넣으면 된다.
 */
(function () {
  var cfg = (window.YEONGYEOL_CONFIG || {}).analytics || {};
  var provider = cfg.provider || 'none';
  var debug = !!cfg.debug;
  // 페이지뷰를 이 도구로 보낼지. 나중에 페이지뷰를 무료·무제한 도구(예: Cloudflare)로
  // 옮기고 여기서는 커스텀 이벤트만 보내고 싶을 때 false 로 바꾼다.
  // 기본 true — 처음에는 한 곳에서 다 보는 편이 단순하다.
  var sendPageviews = cfg.sendPageviews !== false;

  /* ── 개인정보 차단 ───────────────────────────────────────────────
   * 쿼리·해시를 떼고 경로만 남긴다. 이 함수를 거치지 않는 전송 경로는 없다. */
  function cleanPath() {
    return location.pathname || '/';
  }
  function cleanUrl() {
    return location.origin + cleanPath();
  }

  function log() {
    if (debug && window.console) console.log.apply(console, ['[analytics]'].concat([].slice.call(arguments)));
  }
  // 설정이 비어 있으면 debug 와 무관하게 항상 알린다.
  // 조용히 실패하면 켠 줄 알고 며칠치 데이터를 통째로 잃는다.
  function warn(msg) {
    if (window.console && console.warn) console.warn('[analytics] ' + msg);
  }

  /* ── 제공자별 로더 ──────────────────────────────────────────────
   * 어느 쪽이든 자동 페이지뷰를 끄고, 정제한 URL로 직접 한 번 보낸다. */
  var send = function () {};   // send(name, props) — 로더가 채운다
  var pageview = function () {};

  function script(src, attrs) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    Object.keys(attrs || {}).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.head.appendChild(s);
    return s;
  }

  function setupPlausible() {
    if (!cfg.domain) return warn('provider=plausible 인데 analytics.domain 이 비어 있습니다 — 아무것도 전송되지 않습니다.');
    // .manual 변형은 자동 페이지뷰를 보내지 않는다 — URL을 우리가 정한다
    window.plausible = window.plausible || function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
    script('https://plausible.io/js/script.manual.js', { 'data-domain': cfg.domain });
    send = function (name, props) { window.plausible(name, { props: props, u: cleanUrl() }); };
    pageview = function () { window.plausible('pageview', { u: cleanUrl() }); };
  }

  function setupUmami() {
    var u = cfg.umami || {};
    if (!u.src || !u.websiteId) return warn('provider=umami 인데 analytics.umami.src / websiteId 가 비어 있습니다 — 아무것도 전송되지 않습니다. ANALYTICS_SETUP.md 참조.');
    script(u.src, {
      'data-website-id': u.websiteId,
      'data-auto-track': 'false'      // 자동 추적을 끄고 정제한 URL만 보낸다
    });
    function call(fn) {
      if (window.umami && window.umami.track) fn();
      else setTimeout(function () { if (window.umami && window.umami.track) fn(); }, 800);
    }
    // ⚠️ umami.track(name, data) 형태를 쓰면 안 된다.
    // 그 형태에서 payload 의 url 은 트래커가 location.pathname+location.search 로 직접 만들고,
    // 우리가 넘긴 url 은 커스텀 속성으로 밀려난다 → 쿼리에 든 생년월일이 그대로 전송된다.
    // 함수 형태만이 payload 자체를 덮어쓸 수 있으므로 페이지뷰·이벤트 모두 함수 형태로 보낸다.
    function payload(extra) {
      return function (p) {
        return Object.assign({}, p, extra, {
          url: cleanPath(),
          referrer: (document.referrer || '').split('?')[0]
        });
      };
    }
    send = function (name, props) {
      call(function () { window.umami.track(payload({ name: name, data: props || {} })); });
    };
    pageview = function () {
      call(function () { window.umami.track(payload({})); });
    };
  }

  function setupGa4() {
    var id = (cfg.ga4 || {}).measurementId || '';
    if (!/^G-[A-Z0-9]+$/.test(id)) return warn('provider=ga4 인데 measurementId 형식이 올바르지 않습니다(G-XXXXXXXXXX) — 아무것도 전송되지 않습니다.');
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    script('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
    window.gtag('js', new Date());
    // send_page_view:false — 기본 페이지뷰가 쿼리 포함 URL을 보내는 것을 막는다
    window.gtag('config', id, { send_page_view: false, anonymize_ip: true });
    send = function (name, props) {
      window.gtag('event', name, Object.assign({ page_location: cleanUrl(), page_path: cleanPath() }, props || {}));
    };
    pageview = function () {
      window.gtag('event', 'page_view', { page_location: cleanUrl(), page_path: cleanPath() });
    };
  }

  if (provider === 'plausible') setupPlausible();
  else if (provider === 'umami') setupUmami();
  else if (provider === 'ga4') setupGa4();
  else if (provider !== 'none') warn('알 수 없는 provider: ' + provider);

  /* ── 공개 API ───────────────────────────────────────────────────
   * 측정이 꺼져 있어도 호출은 안전하다(디버그 모드면 콘솔에만 남는다). */
  function track(name, props) {
    try {
      log(name, props || {});
      if (provider !== 'none') send(name, props);
    } catch (e) { /* 측정 실패가 기능을 막지 않는다 */ }
  }
  window.YYA = { track: track, provider: provider };

  if (provider !== 'none' && sendPageviews) {
    try { pageview(); } catch (e) { log('pageview 실패', e); }
  } else if (provider !== 'none') {
    log('sendPageviews=false — 커스텀 이벤트만 전송합니다.');
  } else {
    log('provider=none — 전송하지 않습니다. config.js에서 켜세요.');
  }

  /* ── 이벤트 자동 부착 ────────────────────────────────────────────
   * onclick 속성의 함수명으로 무슨 행동인지 알아낸다.
   * MONETIZATION.md가 요구하는 지표에 대응한다. */
  var EVENT_MAP = {
    // 분석 실행 — "첫 방문 → 분석 실행률", "1인당 분석 횟수"
    analyzePair: ['분석실행', { 도구: '1:1궁합' }],
    analyzeGroup: ['분석실행', { 도구: '모임관계도' }],
    analyzePet: ['분석실행', { 도구: 'DOG DNA' }],
    runCat: ['분석실행', { 도구: 'CAT DNA' }],
    runToday: ['분석실행', { 도구: '오늘운' }],
    runLove: ['분석실행', { 도구: '연락·재회' }],
    runCompare: ['분석실행', { 도구: 'A/B/C 비교' }],
    runLoveDNA: ['분석실행', { 도구: '연애 사용설명서' }],
    runHouse: ['분석실행', { 도구: '우리집 관계도' }],
    compareBreeds: ['분석실행', { 도구: '견종 비교' }],
    searchDream: ['분석실행', { 도구: '꿈해몽 검색' }],
    // 공유 — "결과 공유 클릭률"
    copyResult: ['공유클릭', { 방식: '한줄복사' }],
    copyPetResult: ['공유클릭', { 방식: '한줄복사' }],
    downloadShareCard: ['공유클릭', { 방식: '카드저장' }],
    downloadPetCard: ['공유클릭', { 방식: '카드저장' }],
    saveURL: ['공유클릭', { 방식: '링크복사' }],
    // 유료 — "상세 리포트 클릭률"
    // 지금은 결제가 없으므로 여기서 재는 것은 '결제'가 아니라 '결제 의향'이다.
    // 실제 결제를 붙이면 결제 성공 콜백에서 YYA.track('결제완료', {상품, 금액}) 를 직접 부를 것.
    // (성공 여부는 클릭으로 알 수 없으므로 EVENT_MAP 으로는 처리할 수 없다)
    openPremium: ['유료CTA', { 단계: '상품보기' }],
    demoPay: ['유료CTA', { 단계: '결제시도' }]
  };

  var lastProduct = '';   // 결제시도 이벤트에 붙일 '직전에 본 상품'
  document.addEventListener('click', function (e) {
    try {
      var el = e.target.closest && e.target.closest('[onclick]');
      if (el) {
        var code = el.getAttribute('onclick') || '';
        var m = code.match(/^\s*([A-Za-z_$][\w$]*)/);
        var hit = m && EVENT_MAP[m[1]];
        if (hit) {
          var props = Object.assign({}, hit[1]);
          // 유료 상품 구분 — openPremium('group') 의 인자를 상품으로 붙인다.
          // 인자가 없으면 index.html 의 기본값('pair')과 맞춘다.
          // 결제 버튼(demoPay)은 인자가 없으므로 직전에 본 상품을 이어받는다.
          if (m[1] === 'openPremium') {
            var arg = code.match(/^\s*openPremium\(\s*['"]([^'"]+)['"]/);
            lastProduct = arg ? arg[1] : 'pair';
            props.상품 = lastProduct;
          } else if (m[1] === 'demoPay') {
            props.상품 = lastProduct || '알수없음';
          }
          return track(hit[0], props);
        }
      }
      // 백과·사전 → 도구 이동 — "꿈해몽 → 도구 이동률"
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var from = cleanPath();
      var isContent = /^\/(dream|encyclopedia|pet)\//.test(from);
      if (!isContent) return;
      var href = a.getAttribute('href') || '';
      if (/^\/(index\.html)?$|^\/(today|love|cat|family|saju)(\.html)?$/.test(href.split('?')[0])) {
        track('백과에서도구이동', {
          출발: from.split('/')[1],
          도착: href.replace(/^\//, '').replace(/\.html$/, '') || 'home'
        });
      }
    } catch (err) { /* 측정 실패가 클릭을 막지 않는다 */ }
  }, true);
})();
