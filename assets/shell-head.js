/* 연결운 페이지 간 화면 전환 (APP_NAV_DESIGN.md 4단계)
 * pagereveal 은 새 페이지가 처음 그려지기 전에 불리므로 defer 없이 <head> 에서 읽는다.
 * - 본문 안의 링크로 들어온 경우(shell.js 가 'forward' 표시) → 오른쪽에서 밀려 들어옴
 * - 화면 안의 ← 버튼으로 돌아온 경우('back' 표시) → 왼쪽으로 밀려 나감
 * - 하단 탭·헤더 메뉴 이동, 휴대폰 뒤로가기 제스처 → 움직임 없음
 *   (브라우저가 제스처에 자체 애니메이션을 붙이므로 겹치지 않게)
 * - Navigation API 가 없는 브라우저, '동작 줄이기' 설정 → 움직임 없음 */
(function () {
  var root = document.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var dir = null;
    try {
      var flag = sessionStorage.getItem('yy-nav');
      sessionStorage.removeItem('yy-nav');
      var act = window.navigation && window.navigation.activation;
      if (!reduce && act && (flag === 'forward' || flag === 'back')) {
        if (act.navigationType === 'push' || act.navigationType === 'replace') dir = flag;
        else if (act.navigationType === 'traverse' && flag === 'back') dir = 'back';
      }
    } catch (err) { dir = null; }
    if (!dir) { e.viewTransition.skipTransition(); return; }
    root.setAttribute('data-yy-nav', dir);
    var clear = function () { root.removeAttribute('data-yy-nav'); };
    e.viewTransition.finished.then(clear, clear);
  });
})();
