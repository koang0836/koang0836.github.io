window.YY=(function(){
const STEMS=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'],BRANCHES=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_E={甲:'목',乙:'목',丙:'화',丁:'화',戊:'토',己:'토',庚:'금',辛:'금',壬:'수',癸:'수'},BRANCH_E={子:'수',丑:'토',寅:'목',卯:'목',辰:'토',巳:'화',午:'화',未:'토',申:'금',酉:'금',戌:'토',亥:'수'};
const ELEMENTS=['목','화','토','금','수'],GEN={목:'화',화:'토',토:'금',금:'수',수:'목'},CTRL={목:'토',토:'수',수:'화',화:'금',금:'목'};
const STEM_COMB=new Set(['甲己','己甲','乙庚','庚乙','丙辛','辛丙','丁壬','壬丁','戊癸','癸戊']),STEM_CLASH=new Set(['甲庚','庚甲','乙辛','辛乙','丙壬','壬丙','丁癸','癸丁']);
const SIX_COMB=new Set(['子丑','丑子','寅亥','亥寅','卯戌','戌卯','辰酉','酉辰','巳申','申巳','午未','未午']),CLASH=new Set(['子午','午子','丑未','未丑','寅申','申寅','卯酉','酉卯','辰戌','戌辰','巳亥','亥巳']);
const HARM=new Set(['子未','未子','丑午','午丑','寅巳','巳寅','卯辰','辰卯','申亥','亥申','酉戌','戌酉']),BREAK=new Set(['子酉','酉子','丑辰','辰丑','寅亥','亥寅','卯午','午卯','巳申','申巳','未戌','戌未']);
const PUNISH=new Set(['子卯','卯子','寅巳','巳寅','巳申','申巳','申寅','寅申','丑戌','戌丑','戌未','未戌','未丑','丑未']);
const $=id=>document.getElementById(id),clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(n)));
/* 일주 경계 규칙 (사이트 전체 공통)
 * 23:00~23:59 출생은 다음 날 일주로 본다. getDayInGanZhiExact 가 이 방식이고,
 * 60갑자 백과 60페이지에도 같은 문구가 있다. lunar 의 getEightChar() 기본값(sect 2)은
 * 자정 기준이라 결과가 다르므로, 원국 계산에서는 반드시 setSect(DAY_SECT) 를 호출할 것. */
const DAY_SECT=1;
function isLateNight(time){return /^23:/.test(String(time||''))}
function engineReady(){return typeof Solar!=='undefined'&&Solar&&typeof Solar.fromYmdHms==='function'}
function parseDate(date){const [y,m,d]=String(date).split('-').map(Number);return{y,m,d}}
const TERM_DAY=[6,4,6,5,6,6,7,8,8,8,7,7]; // 소한~대설 절입일 근사(±1일). 정밀 절기는 lunar 엔진이 담당
function fallback(date,time){const {y,m,d}=parseDate(date),h=time?(time.split(':').map(Number)[0]||0):12;
const Y=(m<2||(m===2&&d<TERM_DAY[1]))?y-1:y,ys=((Y-4)%10+10)%10,yb=((Y-4)%12+12)%12; // 연주는 입춘 기준
const mb=d>=TERM_DAY[m-1]?m%12:(m-1+12)%12,ms=((ys%5)*2+2+((mb-2+12)%12))%10; // 월지=절기, 월간=오호둔
let di=((Math.floor(Date.UTC(y,m-1,d)/86400000)+17)%60+60)%60,hi=Math.floor((h+1)/2);
if(hi>=12){di=(di+1)%60;hi=0} // 야자시(23시~)는 일주도 다음날로
const ti=(di*12+hi)%60;
return{pillars:{year:STEMS[ys]+BRANCHES[yb],month:STEMS[ms]+BRANCHES[mb],day:STEMS[di%10]+BRANCHES[di%12],time:STEMS[ti%10]+BRANCHES[ti%12]},accurate:false}}
function person(date,time,name=''){if(!date)throw new Error('date');const {y,m,d}=parseDate(date),hasTime=!!time,[hh,mm]=time?time.split(':').map(Number):[12,0];let p;try{if(engineReady()){const l=Solar.fromYmdHms(y,m,d,hh||0,mm||0,0).getLunar();p={pillars:{year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),time:l.getTimeInGanZhi()},accurate:true}}else p=fallback(date,time)}catch(e){p=fallback(date,time)}p.name=name;p.date=date;p.time=time;p.hasTime=hasTime;if(!hasTime)p.pillars.time=null;/* 시간을 모르면 시주를 지어내지 않는다(12:00 가정 금지). 오행 개수도 6자 기준 */p.dayStem=p.pillars.day[0];p.dayBranch=p.pillars.day[1];p.dayElem=STEM_E[p.dayStem]||'토';p.vec=elementVector(p.pillars);return p}
function elementVector(p){const v={목:0,화:0,토:0,금:0,수:0};Object.values(p).forEach(x=>{if(!x)return;if(STEM_E[x[0]])v[STEM_E[x[0]]]++;if(BRANCH_E[x[1]])v[BRANCH_E[x[1]]]++});return v}
function prop(v){const s=Object.values(v).reduce((a,b)=>a+b,0)||1,o={};ELEMENTS.forEach(e=>o[e]=v[e]/s);return o}
function similarity(A,B){const a=prop(A.vec),b=prop(B.vec);let d=0;ELEMENTS.forEach(e=>d+=Math.abs(a[e]-b[e]));return clamp(100-d*50,25,100)}
function complement(A,B){const a=prop(A.vec),b=prop(B.vec);let cov=0,gap=0;ELEMENTS.forEach(e=>{const da=Math.max(0,.2-a[e]),db=Math.max(0,.2-b[e]),sa=Math.max(0,a[e]-.2),sb=Math.max(0,b[e]-.2);cov+=Math.min(da,sb)+Math.min(db,sa);gap+=Math.min(da,db)});return clamp(56+cov*190-gap*80,35,96)}
function elemRel(a,b){if(a===b)return{kind:'same',label:'같은 오행',h:4,t:0};if(GEN[a]===b)return{kind:'aGenB',label:`${a}→${b} 상생`,h:8,t:0};if(GEN[b]===a)return{kind:'bGenA',label:`${b}→${a} 상생`,h:8,t:0};if(CTRL[a]===b||CTRL[b]===a)return{kind:'control',label:'오행 상극',h:0,t:6};return{kind:'mix',label:'혼합 오행',h:2,t:1}}
function branchRel(a,b){const k=a+b;return{combine:SIX_COMB.has(k),clash:CLASH.has(k),harm:HARM.has(k),break:BREAK.has(k),punish:PUNISH.has(k)||(a===b&&['辰','午','酉','亥'].includes(a)),same:a===b}}
function branchEnergy(r,w){let h=0,t=0;if(r.combine)h+=12*w;if(r.same)h+=3*w;if(r.clash)t+=14*w;if(r.harm)t+=8*w;if(r.break)t+=5*w;if(r.punish)t+=7*w;return{h,t}}
function weights(rel){return rel==='친구'?{attraction:.10,communication:.32,stability:.24,conflict:.14,complement:.20}:rel==='직장'?{attraction:.04,communication:.35,stability:.22,conflict:.20,complement:.19}:rel==='가족'?{attraction:.03,communication:.24,stability:.31,conflict:.22,complement:.20}:{attraction:.29,communication:.21,stability:.20,conflict:.13,complement:.17}}
function pair(A,B,rel='연인·썸'){const ds=A.dayStem+B.dayStem,stemComb=STEM_COMB.has(ds),stemClash=STEM_CLASH.has(ds),er=elemRel(A.dayElem,B.dayElem);let harmony=er.h+(stemComb?10:0),tension=er.t+(stemClash?10:0);const rels={};[['day',1.45],['month',1],['year',.65]].concat(A.hasTime&&B.hasTime?[['time',.8]]:[]).forEach(([k,w])=>{const r=branchRel(A.pillars[k][1],B.pillars[k][1]);rels[k]=r;const e=branchEnergy(r,w);harmony+=e.h;tension+=e.t});const sim=similarity(A,B),comp=clamp(complement(A,B)+(er.kind==='aGenB'||er.kind==='bGenA'?5:0)+(rels.day.combine?6:0),30,98),conflict=clamp(27+tension*2.05+(rels.day.clash?10:0)+(stemClash?6:0)-harmony*.35,12,96),attraction=clamp(57+harmony*1.25+(stemComb?8:0)+(rels.day.combine?8:0)+(er.kind==='aGenB'||er.kind==='bGenA'?5:0)+comp*.08-conflict*.09,30,98),communication=clamp(52+sim*.25+(rels.month.combine?8:0)-(rels.month.clash?11:0)-(stemClash?6:0)+(er.kind==='same'?6:(er.t===0?3:-3)),28,97),stability=clamp(50+harmony*1.05+comp*.18-tension*1.15-conflict*.08+(rels.year.combine?5:0),25,97),M={attraction,communication,stability,conflict,complement:comp,similarity:sim},w=weights(rel),score=clamp(M.attraction*w.attraction+M.communication*w.communication+M.stability*w.stability+(100-M.conflict)*w.conflict+M.complement*w.complement,20,98);return{A,B,rel,M,score,er,rels,harmony,tension,stemComb,stemClash}}
function dayKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function jitter(key,min=-8,max=8){return min+(hash(key)%(max-min+1))}
function todayScores(P,date=dayKey()){const D=person(date,'12:00','오늘'),R=pair(P,D,'친구'),base=R.score;return{overall:clamp(base+jitter(P.date+date+'o',-5,7),30,96),relation:clamp(R.M.communication*.42+R.M.complement*.28+(100-R.M.conflict)*.30+jitter(P.date+date+'r',-5,5),25,97),action:clamp(R.M.attraction*.45+R.M.stability*.25+R.M.communication*.30+jitter(P.date+date+'a',-8,8),25,97),communication:clamp(R.M.communication+jitter(P.date+date+'c',-6,6),25,97),tension:clamp(R.M.conflict+jitter(P.date+date+'t',-6,6),10,95),day:D,R}}
function fmtDate(d=new Date()){return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`}
function copy(text,msg='복사했습니다'){navigator.clipboard?.writeText(text).then(()=>toast(msg)).catch(()=>{const x=document.createElement('textarea');x.value=text;document.body.appendChild(x);x.select();document.execCommand('copy');x.remove();toast(msg)})}
function toast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#f5f6fa;color:#111;padding:10px 14px;border-radius:999px;font:800 12px sans-serif;z-index:99';document.body.appendChild(t)}t.textContent=msg;t.hidden=false;clearTimeout(t._timer);t._timer=setTimeout(()=>t.hidden=true,1600)}
function metricHTML(label,v){return `<div class="card metric"><small>${label}</small><b>${v}</b><div class="track"><div class="fill" style="width:${v}%"></div></div></div>`}
function shellFooter(){return `<div class="footer"><div class="footerlinks"><a href="/">홈</a><a href="/today.html">오늘운</a><a href="/love.html">연락·재회</a><a href="/family.html">우리집 관계도</a><a href="/dream/">꿈해몽</a><a href="/encyclopedia/">60갑자</a><a href="/privacy.html">개인정보</a><a href="/terms.html">이용약관</a></div>연결운 · 재미로 보는 사주·궁합</div>`}
/* 방문자 화면용 쉬운 말 — 오행은 나무·불·흙·쇠·물 별명으로, 이름 뒤 조사는 받침에 맞춰 붙인다 */
const NICK={목:'🌳 나무',화:'🔥 불',토:'⛰️ 흙',금:'🪙 쇠',수:'💧 물'};
const GEN_IMG={목:'나무가 불을 피워 주듯',화:'불이 흙을 따뜻하게 데우듯',토:'흙이 쇠를 품어 기르듯',금:'차가운 쇠에 이슬이 맺혀 물이 되듯',수:'물이 나무를 자라게 하듯'};
const CTRL_IMG={목:'나무뿌리가 흙을 움켜쥐듯',토:'둑이 물길을 잡아 주듯',수:'물이 불을 식히듯',화:'불이 쇠를 달구듯',금:'가위가 나뭇가지를 다듬듯'};
function nick(e){return NICK[e]||e}
function jo(w,a,b){const c=String(w).trim().slice(-1).charCodeAt(0);if(!(c>=0xAC00&&c<=0xD7A3))return b;const f=(c-0xAC00)%28;return f===0||(a==='으로'&&f===8)?b:a}
function josa(w,a,b){return String(w)+jo(w,a,b)}
function who(n,kind){n=String(n||'');if(n==='나')return{subj:'내가',topic:'나는',with:'나와',obj:'나를'}[kind];const J={subj:['이','가'],topic:['은','는'],with:['과','와'],obj:['을','를']}[kind];return n+jo(n,J[0],J[1])}
function flowText(a,b,na,nb){if(a===b)return `${who(na,'with')} ${nb} 둘 다 ${NICK[a]} 기운이라, 말하지 않아도 통하는 부분이 많아요.`;if(GEN[a]===b)return `${GEN_IMG[a]} ${na}의 ${NICK[a]} 기운이 ${nb}의 ${NICK[b]} 기운에 힘을 보태 줘요.`;if(GEN[b]===a)return `${GEN_IMG[b]} ${nb}의 ${NICK[b]} 기운이 ${na}의 ${NICK[a]} 기운에 힘을 보태 줘요.`;const [x,y,nx,ny]=CTRL[a]===b?[a,b,na,nb]:[b,a,nb,na];return `${CTRL_IMG[x]} ${nx}의 ${NICK[x]} 기운이 ${ny}의 ${NICK[y]} 기운을 붙잡아 주는 사이라, 서로에게 좋은 자극이 되기 쉬워요.`}
function todayFlow(p,d){if(p===d)return '나와 같은 기운이 도는 날이라, 평소 페이스대로 편안하게 흘러가요.';if(GEN[d]===p)return `${GEN_IMG[d]} 오늘의 기운이 나를 채워 주는 날이에요. 도움을 받거나 새로 배우기 좋아요.`;if(GEN[p]===d)return '내가 가진 힘을 밖으로 꺼내 쓰는 날이에요. 표현하고 베풀기 좋은 대신, 저녁엔 푹 쉬어 주세요.';if(CTRL[p]===d)return '내가 흐름을 이끌기 좋은 날이에요. 욕심을 조금만 덜어 내면 일이 술술 풀려요.';return '바깥에서 신경 쓸 일이 많아지기 쉬운 날이에요. 속도를 한 박자 늦추면 훨씬 편해요.'}
/* 행운 포인트 — 나를 채워 주는 기운(나를 생하는 오행)의 색·숫자·물건. 재미 요소 */
const LUCK={목:{color:'초록색',num:'3 · 8',item:'작은 화분이나 나무 소재 소품',food:'싱싱한 샐러드'},화:{color:'빨간색 · 주황색',num:'2 · 7',item:'향초나 따뜻한 차 한 잔',food:'살짝 매콤한 음식'},토:{color:'노란색 · 베이지',num:'5 · 10',item:'도자기 머그컵',food:'고소한 곡물빵'},금:{color:'흰색 · 은색',num:'4 · 9',item:'손목시계나 은빛 액세서리',food:'아삭한 과일'},수:{color:'남색 · 검정',num:'1 · 6',item:'물 한 병과 파란 펜',food:'따뜻한 국물 요리'}};
function luckyElem(e){return ELEMENTS.find(x=>GEN[x]===e)||e}
return{DAY_SECT,isLateNight,$,clamp,person,pair,todayScores,dayKey,fmtDate,hash,jitter,copy,toast,metricHTML,shellFooter,NICK,nick,jo,josa,who,flowText,todayFlow,LUCK,luckyElem,engineReady,parseDate,similarity,prop,complement,elemRel,branchRel,branchEnergy,weights,STEMS,BRANCHES,STEM_E,BRANCH_E,ELEMENTS,GEN,CTRL,STEM_COMB,STEM_CLASH,SIX_COMB,CLASH,HARM,BREAK,PUNISH};
})();
