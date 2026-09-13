(function(){
  const c=window.YEONGYEOL_CONFIG||{};
  document.querySelectorAll('[data-operator-name]').forEach(x=>x.textContent=(c.operator&&c.operator.name)||'[운영자명 입력]');
  document.querySelectorAll('[data-operator-email]').forEach(x=>x.textContent=(c.operator&&c.operator.email)||'[문의 이메일 입력]');
})();
