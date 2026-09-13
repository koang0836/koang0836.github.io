(function(){
  const cfg=(window.YEONGYEOL_CONFIG||{}).ads||{};
  const slots=[...document.querySelectorAll('[data-ad-placement]')];
  const showPlaceholder=(el,msg='광고 영역 · 승인 후 활성화')=>{
    el.innerHTML=`<div class="ad-label">ADVERTISEMENT</div><div class="ad-placeholder">${msg}</div>`;
    el.hidden=false;
  };
  if(!slots.length) return;
  if(cfg.provider==='none'){
    slots.forEach(el=>{ if(cfg.showPlaceholders) showPlaceholder(el); else el.hidden=true; });
    return;
  }
  if(cfg.provider!=='adsense'){
    slots.forEach(el=>showPlaceholder(el,'광고 설정을 확인해주세요'));
    return;
  }
  const ad=cfg.adsense||{};
  if(!/^ca-pub-\d+$/.test(ad.client||'')){
    slots.forEach(el=>showPlaceholder(el,'AdSense publisher ID를 config.js에 입력해주세요'));
    return;
  }
  if(!document.querySelector('script[data-yeongyeol-adsense]')){
    const s=document.createElement('script');
    s.async=true;
    s.dataset.yeongyeolAdsense='1';
    s.crossOrigin='anonymous';
    s.src=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ad.client)}`;
    document.head.appendChild(s);
  }
  slots.forEach(el=>{
    const key=el.dataset.adPlacement;
    const slot=(ad.slots||{})[key];
    if(!/^\d+$/.test(slot||'')){
      showPlaceholder(el,`${key} 광고 슬롯 ID를 입력해주세요`);
      return;
    }
    el.hidden=false;
    el.innerHTML=`<div class="ad-label">ADVERTISEMENT</div><ins class="adsbygoogle" style="display:block" data-ad-client="${ad.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch(e){console.warn('AdSense slot init failed',e)}
  });
})();
