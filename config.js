/* 연결운 출시 설정
 * 1) domain / operator 값을 실제 정보로 바꾸세요.
 * 2) 광고 심사 승인 후 adsense 값을 채우고 provider를 "adsense"로 바꾸세요.
 * 3) Kakao AdFit을 쓸 경우 AD_SETUP.md의 안내에 따라 대시보드에서 발급된 최신 스크립트를 사용하세요.
 */
window.YEONGYEOL_CONFIG = {
  siteName: "연결운",
  domain: "", // custom domain 연결 후 입력
  operator: {
    name: "[운영자명 또는 상호 입력]",
    email: "[문의 이메일 입력]"
  },
  // 방문·행동 측정. 실제 발급받은 값을 넣어야만 동작합니다(기본 꺼짐).
  // 쿠키를 쓰지 않는 plausible·umami 를 권장합니다 — 이 사이트는 생년월일을 다루므로
  // 쿠키 기반(ga4)은 개인정보처리방침과 동의 처리를 따로 확인해야 합니다.
  // 어느 쪽을 쓰든 URL 쿼리스트링은 전송되지 않습니다(analytics.js 에서 차단).
  analytics: {
    provider: "umami",  // none | plausible | umami | ga4
    debug: false,       // true 면 전송하지 않고 콘솔에만 출력 — 붙이기 전 확인용
    sendPageviews: true, // 확장용 스위치. 나중에 페이지뷰를 무료·무제한 도구로 옮기면
                         // false 로 바꿔 커스텀 이벤트만 이쪽으로 보낸다(무료 한도 절약).
    domain: "",         // plausible: 대시보드에 등록한 도메인 (예: yeongyeol.kr)
    // ↓ 이 두 값을 채워야 실제로 전송됩니다. 비어 있으면 콘솔에 경고가 뜹니다.
    umami: {
      src: "",          // 스크립트 주소. Umami Cloud면 https://cloud.umami.is/script.js
      websiteId: ""     // Umami 대시보드 > Settings > Websites 에서 복사한 Website ID
    },
    ga4: {
      measurementId: "" // 예: G-XXXXXXXXXX
    }
  },
  ads: {
    provider: "none", // none | adsense
    showPlaceholders: false, // 개발 중 광고 위치 확인이 필요할 때만 true
    adsense: {
      client: "", // 예: ca-pub-1234567890123456
      slots: {
        pairResult: "",
        groupResult: "",
        petResult: "",
        guide: "",
        todayResult: "",
        loveResult: "",
        catResult: "",
        familyResult: "",
        encyclopedia: "",
        breedGuide: "",
        dreamHub: "",
        dreamArticle: "",
        chartResult: ""
      }
    }
  }
};
