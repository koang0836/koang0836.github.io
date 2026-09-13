/* 연결운 1인 원국 계산 — 계산만 담당한다. 화면은 saju.html(2단계)에서 그린다.
 *
 * 로드 순서: lunar.min.js → platform.js → saju_data.js → chart.js
 *
 * 무엇을 어디서 계산하나 (CHART_PAGE_DESIGN.md 3-1절)
 *   lunar.min.js   4주 간지 · 대운 · 음력/윤달 변환 · 절입 시각
 *   saju_data.js   십신 · 십이운성 · 지장간 · 납음 · 공망 · 관계표
 *                  build_saju_data.py 가 60갑자 백과와 같은 표에서 생성한다.
 *                  이 판단 로직을 여기서 다시 짜지 않는다.
 *   이 파일        4주 사이 합·충·형·해·파 탐지 · 오행 개수 · 경고
 *
 * 개인정보: 입력값은 이 함수 안에서만 쓰이고 어디로도 보내지 않는다.
 *
 * 사용: YY.chart({ calendar: 'solar'|'lunar', leap: false, date: 'YYYY-MM-DD',
 *                 time: 'HH:MM' 또는 생략(모름), gender: 'M'|'F' }, { now: Date })
 */
(function () {
  'use strict';

  var YY = window.YY;
  var D = window.YY_SAJU_DATA;
  if (!YY || !D || typeof Solar === 'undefined') {
    if (window.console) console.warn('[chart] lunar.min.js · platform.js · saju_data.js 가 먼저 로드돼야 합니다');
    return;
  }

  var POS = ['year', 'month', 'day', 'time'];
  var POS_KO = { year: '년', month: '월', day: '일', time: '시' };
  var POS_ORDER = { year: 0, month: 1, day: 2, time: 3 };
  var ELEMS = ['목', '화', '토', '금', '수'];

  /* 시 경계 경고 폭(분). 서울 경도(약 127°E)와 표준시 기준 경도(135°E)의 차이가 약 32분이라
     경도 보정 여부에 따라 시주가 바뀔 수 있는 구간이다. */
  var HOUR_BOUNDARY_MIN = 32;

  /* 절기 이름. lunar 는 중국어 간체로 주고, 연도 경계 부근에서는 영문 키로 주기도 한다. */
  var JIE_KO = {
    '小寒': '소한', '立春': '입춘', '惊蛰': '경칩', '清明': '청명', '立夏': '입하', '芒种': '망종',
    '小暑': '소서', '立秋': '입추', '白露': '백로', '寒露': '한로', '立冬': '입동', '大雪': '대설',
    'XIAO_HAN': '소한', 'LI_CHUN': '입춘', 'JING_ZHE': '경칩', 'DA_XUE': '대설'
  };

  /* 아직 구현하지 않은 경고: 한국 서머타임(1948~51, 1955~60, 1987~88) 기간 출생.
     정확한 시행 일자를 공식 기록으로 확인한 뒤 추가한다 — 설계서 4-4절. */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
  function toDate(s) { return new Date(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond()); }
  function ageAt(birth, at) {
    var a = at.getFullYear() - birth.getFullYear();
    if (at.getMonth() < birth.getMonth() || (at.getMonth() === birth.getMonth() && at.getDate() < birth.getDate())) a--;
    return a;
  }
  function inputError(msg) { var e = new Error(msg); e.name = 'ChartInputError'; return e; }
  function lastHidden(b) { var h = D.hidden[b]; return h[h.length - 1]; }
  function godOfBranch(dayStem, b) { return D.tenGod[dayStem][lastHidden(b)]; }

  /* ── 입력 정규화 ─────────────────────────────────────────────── */
  function normalize(input) {
    input = input || {};
    var calendar = input.calendar === 'lunar' ? 'lunar' : 'solar';
    if (input.gender !== 'M' && input.gender !== 'F') {
      throw inputError('성별(M 또는 F)이 필요합니다. 대운 방향 계산에만 씁니다.');
    }
    var dm = String(input.date || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!dm) throw inputError('날짜는 YYYY-MM-DD 형식이어야 합니다.');
    var y = +dm[1], m = +dm[2], d = +dm[3];
    if (y < 1900 || y > 2100) throw inputError('1900~2100년 사이만 계산합니다.');

    var hasTime = input.time != null && String(input.time) !== '';
    var hh = 12, mi = 0;
    if (hasTime) {
      var tm = String(input.time).match(/^(\d{1,2}):(\d{2})$/);
      if (!tm || +tm[1] > 23 || +tm[2] > 59) throw inputError('시간은 HH:MM 형식이어야 합니다.');
      hh = +tm[1];
      mi = +tm[2];
    }

    var leap = calendar === 'lunar' && !!input.leap;
    var solar;
    if (calendar === 'lunar') {
      if (m < 1 || m > 12 || d < 1 || d > 30) throw inputError('없는 음력 날짜입니다.');
      if (leap && LunarYear.fromYear(y).getLeapMonth() !== m) {
        throw inputError(y + '년에는 음력 윤' + m + '월이 없습니다.');
      }
      var lunar;
      try {
        lunar = Lunar.fromYmdHms(y, leap ? -m : m, d, hh, mi, 0);
      } catch (e) {
        throw inputError('없는 음력 날짜입니다.');
      }
      /* 29일까지인 달에 30일을 넣으면 다음 달로 넘어가 버리므로 되돌려서 확인한다 */
      var back = lunar.getSolar().getLunar();
      if (back.getYear() !== y || Math.abs(back.getMonth()) !== m || (back.getMonth() < 0) !== leap || back.getDay() !== d) {
        throw inputError('없는 음력 날짜입니다.');
      }
      solar = lunar.getSolar();
    } else {
      var check = new Date(y, m - 1, d);
      if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) {
        throw inputError('없는 날짜입니다.');
      }
      solar = Solar.fromYmdHms(y, m, d, hh, mi, 0);
    }

    return {
      calendar: calendar,
      leap: leap,
      gender: input.gender,
      hasTime: hasTime,
      solar: solar,
      hh: hh,
      mi: mi,
      solarDate: solar.getYear() + '-' + pad(solar.getMonth()) + '-' + pad(solar.getDay()),
      time: hasTime ? pad(hh) + ':' + pad(mi) : null
    };
  }

  /* ── 4주 ─────────────────────────────────────────────────────── */
  function eightCharOf(solar, sect) {
    var ec = solar.getLunar().getEightChar();
    ec.setSect(sect);
    return ec;
  }

  /* 23시 규칙은 platform.js 의 YY.DAY_SECT 를 따른다 (궁합 엔진·60갑자 문구와 같은 기준) */
  function pillarsOf(solar, hasTime) {
    var ec = eightCharOf(solar, YY.DAY_SECT);
    return { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: hasTime ? ec.getTime() : null };
  }

  function cellOf(dayStem, gz, pos) {
    if (!gz) return null;
    var s = gz.charAt(0), b = gz.charAt(1);
    var hidden = D.hidden[b], roles = D.hiddenRole[String(hidden.length)];
    return {
      pos: pos,
      label: POS_KO[pos] + '주',
      ganzhi: gz,
      stem: s,
      branch: b,
      stemElem: D.stemElem[s],
      branchElem: D.branchElem[b],
      stemGod: pos === 'day' ? '일간' : D.tenGod[dayStem][s],
      branchGod: godOfBranch(dayStem, b),
      hidden: hidden.map(function (h, i) {
        return { stem: h, role: roles[i], elem: D.stemElem[h], god: D.tenGod[dayStem][h] };
      }),
      lifeStage: D.lifeStage[dayStem][b],
      nayin: D.nayin[gz]
    };
  }

  /* ── 오행 — 가중치를 지어내지 않고 개수만 센다 (설계서 3-3절) ─────── */
  function elementsOf(cells) {
    var surface = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    var withHidden = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    cells.forEach(function (c) {
      if (!c) return;
      surface[c.stemElem]++;
      surface[c.branchElem]++;
      withHidden[c.stemElem]++;
      c.hidden.forEach(function (h) { withHidden[h.elem]++; });
    });
    return { surface: surface, withHidden: withHidden };
  }

  /* 나를 돕는 기운 = 비겁(같은 오행) + 인성(나를 생하는 오행). 강약 판정은 하지 않는다. */
  function balanceOf(dayElem, counts) {
    var help = 0, total = 0;
    ELEMS.forEach(function (e) {
      total += counts[e];
      if (e === dayElem || D.gen[e] === dayElem) help += counts[e];
    });
    return { help: help, spend: total - help, total: total };
  }

  /* ── 4주 사이 관계 ───────────────────────────────────────────── */
  function relationsOf(pillars) {
    var out = [], stems = [], branches = [];
    POS.forEach(function (p) {
      if (!pillars[p]) return;
      stems.push({ pos: p, ch: pillars[p].charAt(0) });
      branches.push({ pos: p, ch: pillars[p].charAt(1) });
    });

    function where(items, kind) {
      return items.slice()
        .sort(function (a, b) { return POS_ORDER[a.pos] - POS_ORDER[b.pos]; })
        .map(function (it) { return POS_KO[it.pos] + kind; });
    }
    /* key: 해설 문안을 찾는 키. 반합은 삼합 그룹, 두 글자만 만난 형은 삼형 그룹, 자형은 글자 하나 */
    function add(type, chars, result, items, kind, key) {
      var r = { type: type, chars: chars, key: key || chars, positions: where(items, kind) };
      if (result) r.result = result;
      out.push(r);
    }
    function isPair(a, b, r) { return (a === r[0] && b === r[1]) || (a === r[1] && b === r[0]); }
    function eachPair(list, fn) {
      for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) fn(list[i], list[j]);
    }
    function present(ch) { return branches.filter(function (x) { return x.ch === ch; }); }
    function hitIndexes(hits) {
      var have = [];
      hits.forEach(function (h, i) { if (h.length) have.push(i); });
      return have;
    }

    eachPair(stems, function (a, b) {
      D.rel.stemComb.forEach(function (r) { if (isPair(a.ch, b.ch, r)) add('천간합', r[0] + r[1], r[2], [a, b], '간'); });
      D.rel.stemClash.forEach(function (r) { if (isPair(a.ch, b.ch, r)) add('천간충', r[0] + r[1], null, [a, b], '간'); });
    });

    eachPair(branches, function (a, b) {
      [['sixComb', '육합'], ['clash', '충'], ['harm', '해'], ['break', '파'], ['punishMutual', '형']].forEach(function (k) {
        D.rel[k[0]].forEach(function (r) { if (isPair(a.ch, b.ch, r)) add(k[1], r[0] + r[1], null, [a, b], '지'); });
      });
      if (a.ch === b.ch && D.rel.selfPunish.indexOf(a.ch) >= 0) add('자형', a.ch + b.ch, null, [a, b], '지', a.ch);
    });

    D.rel.punishTriple.forEach(function (t) {
      var hits = t.map(present), have = hitIndexes(hits);
      if (have.length === 3) add('삼형', t.join(''), null, hits[0].concat(hits[1], hits[2]), '지', t.join(''));
      else if (have.length === 2) add('형', t[have[0]] + t[have[1]], null, hits[have[0]].concat(hits[have[1]]), '지', t.join(''));
    });

    D.rel.tripleComb.forEach(function (t) {
      var hits = [present(t[0]), present(t[1]), present(t[2])], have = hitIndexes(hits);
      if (have.length === 3) {
        add('삼합', t[0] + t[1] + t[2], t[3], hits[0].concat(hits[1], hits[2]), '지');
      } else if (have.length === 2 && hits[1].length) {
        /* 반합은 왕지(子午卯酉)가 들어 있을 때만 */
        add('반합', t[have[0]] + t[have[1]], t[3], hits[have[0]].concat(hits[have[1]]), '지', t[0] + t[1] + t[2]);
      }
    });

    D.rel.dirComb.forEach(function (t) {
      var hits = [present(t[0]), present(t[1]), present(t[2])];
      if (hits[0].length && hits[1].length && hits[2].length) {
        add('방합', t[0] + t[1] + t[2], t[3], hits[0].concat(hits[1], hits[2]), '지');
      }
    });

    return out;
  }

  /* ── 대운 · 세운 ─────────────────────────────────────────────── */
  function daeunOf(n, dayStem, birth, now) {
    var yun = eightCharOf(n.solar, YY.DAY_SECT).getYun(n.gender === 'M' ? 1 : 0);
    var s = yun.getStartSolar();
    var start = new Date(s.getYear(), s.getMonth() - 1, s.getDay());
    var list = [], current = -1;
    yun.getDaYun().forEach(function (dy) {
      var gz = dy.getGanZhi();
      if (!gz) return;  /* 첫 원소는 대운이 시작되기 전 구간이라 간지가 없다 */
      var i = list.length;
      var from = new Date(start.getFullYear() + 10 * i, start.getMonth(), start.getDate());
      var until = new Date(start.getFullYear() + 10 * (i + 1), start.getMonth(), start.getDate());
      if (now >= from && now < until) current = i;
      var last = new Date(until.getTime());
      last.setDate(last.getDate() - 1);
      list.push({
        ganzhi: gz,
        stemGod: D.tenGod[dayStem][gz.charAt(0)],
        branchGod: godOfBranch(dayStem, gz.charAt(1)),
        from: ymdOf(from),
        to: ymdOf(last),
        startYear: from.getFullYear(),
        /* 라이브러리 getStartAge() 는 세는나이라 쓰지 않는다. 만 나이로 계산 */
        startAge: ageAt(birth, from)
      });
    });
    return {
      forward: yun.isForward(),
      startSolar: ymdOf(start),
      startOffset: { years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay() },
      /* 대운수는 절입 시각까지의 거리로 정해진다. 출생시간을 모르면 시작일이 몇 달 어긋날 수 있다 */
      approximate: !n.hasTime,
      current: current,
      list: list
    };
  }

  /* 그해 간지 — 6월 1일은 언제나 입춘 뒤라 그해 간지로 확정된다 */
  function yearGanzhi(y) { return Solar.fromYmd(y, 6, 1).getLunar().getYearInGanZhiExact(); }

  function seunOf(dayStem, now) {
    var gz = Solar.fromYmdHms(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), 0)
      .getLunar().getYearInGanZhiExact();
    /* 1월~입춘 전에는 아직 지난해 간지다. 연도 표기도 간지에 맞춘다 (2027-01-15 → 2026 丙午) */
    var year = now.getFullYear();
    if (yearGanzhi(year) !== gz) year--;
    return {
      year: year,
      basis: '입춘 기준',
      ganzhi: gz,
      stemGod: D.tenGod[dayStem][gz.charAt(0)],
      branchGod: godOfBranch(dayStem, gz.charAt(1))
    };
  }

  /* ── 경고 — 해당될 때만 넣는다 ───────────────────────────────── */
  function warningsOf(n) {
    var list = [];
    var birth = toDate(n.solar);
    var lunar = n.solar.getLunar();

    [lunar.getPrevJie(), lunar.getNextJie()].forEach(function (jq) {
      var at = toDate(jq.getSolar());
      var hours = Math.abs(at - birth) / 3600000;
      if (hours < 24) {
        var name = JIE_KO[jq.getName()] || jq.getName();
        list.push({
          type: 'jieqi',
          name: name,
          at: jq.getSolar().toYmdHms(),
          hoursAway: Math.round(hours * 10) / 10,
          affects: name === '입춘' ? ['년주', '월주'] : ['월주']
        });
      }
    });

    if (!n.hasTime) {
      list.push({ type: 'time_unknown' });
      return list;
    }

    /* 시 경계는 홀수 정시(01:00, 03:00 … 23:00) */
    var mins = n.hh * 60 + n.mi, best = null;
    for (var h = 1; h <= 23; h += 2) {
      var dist = Math.abs(mins - h * 60);
      dist = Math.min(dist, 1440 - dist);
      if (!best || dist < best.dist) best = { h: h, dist: dist };
    }
    if (best.dist <= HOUR_BOUNDARY_MIN) {
      var bm = best.h * 60;
      var altMin = mins >= bm ? bm - 1 : bm + 1;
      var alt = pillarsOf(Solar.fromYmdHms(n.solar.getYear(), n.solar.getMonth(), n.solar.getDay(),
        Math.floor(altMin / 60), altMin % 60, 0), true);
      list.push({
        type: 'hour_boundary',
        boundary: pad(best.h) + ':00',
        minutesAway: best.dist,
        altTime: pad(Math.floor(altMin / 60)) + ':' + pad(altMin % 60),
        altDay: alt.day,
        altHour: alt.time
      });
    }

    if (YY.isLateNight(n.time)) {
      /* 이 사이트는 23시를 다음 날로 본다. 자정 기준(sect 2)으로 보는 학파의 일주를 함께 준다 */
      list.push({ type: 'late_night', altDay: eightCharOf(n.solar, 2).getDay() });
    }
    return list;
  }

  /* ── 쉬운 풀이 — 어느 문안을 고를지만 정한다 ────────────────────────
     문안과 기준값(rule)은 easy_text.py 에 있다 (설계서 2-8절). */
  var GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
  var COMB_TYPES = ['육합', '삼합', '반합', '방합'];

  /* 나를 뜻하는 글자(일간)를 뺀 글자 — 천간 3 + 지지 4, 시간 모름이면 2 + 3 — 의 십신을 다섯 힘으로 센다. 지지는 정기 기준 */
  function godCountsOf(cells) {
    var groups = {}, gods = {}, n = 0;
    GROUPS.forEach(function (g) { groups[g] = 0; });
    function add(god) { groups[D.godGroup[god]]++; gods[god] = (gods[god] || 0) + 1; n++; }
    POS.forEach(function (k) {
      var c = cells[k];
      if (!c) return;
      if (k !== 'day') add(c.stemGod);
      add(c.branchGod);
    });
    return { groups: groups, gods: gods, counted: n };
  }

  function readingOf(p, cells, elements, relations, daeun, seun, now) {
    var R = D.easy.rule, ER = D.text.elemRule, dayStem = p.day.charAt(0);
    var gc = godCountsOf(cells), g = gc.groups;
    function level(x) { return x === 0 ? 'none' : x >= R.many ? 'many' : 'some'; }

    /* 가장 큰 힘 — 동률이면 태어난 달의 아래 글자(월지)가 속한 힘, 그래도 못 고르면 정해 둔 순서 */
    var max = Math.max.apply(null, GROUPS.map(function (k) { return g[k]; }));
    var tied = GROUPS.filter(function (k) { return g[k] === max; });
    var monthGroup = D.godGroup[cells.month.branchGod];
    var main = tied.indexOf(monthGroup) >= 0 ? monthGroup
      : R.tieOrder.filter(function (k) { return tied.indexOf(k) >= 0; })[0];

    var jeong = gc.gods['정재'] || 0, pyeon = gc.gods['편재'] || 0;
    var moneyFlags = [];
    if (g['식상'] >= 1 && g['재성'] >= 1) moneyFlags.push('talent');
    if (g['비겁'] >= R.many) moneyFlags.push('share');

    var dayGroup = D.godGroup[cells.day.branchGod];
    var charm = POS.filter(function (k) { return p[k] && R.charmBranches.indexOf(p[k].charAt(1)) >= 0; }).length;

    /* 나를 나타내는 자리(일지)가 걸린 관계 */
    var dayRel = [];
    relations.forEach(function (r) {
      if (r.positions.indexOf('일지') < 0) return;
      var k = r.type === '충' ? 'clash' : COMB_TYPES.indexOf(r.type) >= 0 ? 'comb' : null;
      if (k && dayRel.indexOf(k) < 0) dayRel.push(k);
    });

    var kind = g['식상'] >= 1 && g['재성'] >= 1 ? 'maker'
      : g['비겁'] >= R.strong ? 'solo'
      : g['관성'] >= R.strong ? 'org'
      : g['인성'] >= R.strong ? 'expert' : 'steady';
    var watch = [];
    if (g['재성'] === 0) watch.push('noMoney');
    if (g['식상'] === 0) watch.push('noExpress');

    var s = elements.surface, h = elements.withHidden, many = [], none = [];
    ELEMS.forEach(function (e) {
      if (s[e] >= ER.manySurface || h[e] >= ER.manyWithHidden) many.push(e);
      else if (s[e] === 0) none.push(e);
    });
    var tense = relations.filter(function (r) { return R.tenseTypes.indexOf(r.type) >= 0; }).length >= R.tenseMin;

    /* 그해 아래 글자와 일지 — 두 기둥만 넣어 원국과 같은 관계 규칙으로 판정한다. 충이 합보다 우선 */
    function withDayOf(gz) {
      var out = null;
      relationsOf({ year: gz, day: p.day }).forEach(function (r) {
        if (r.type === '충') out = 'clash';
        else if (!out && (r.type === '육합' || r.type === '반합')) out = 'comb';
      });
      return out;
    }

    var years = [];
    for (var i = 0; i < 5; i++) {
      var gz = i ? yearGanzhi(seun.year + i) : seun.ganzhi;
      var sg = D.tenGod[dayStem][gz.charAt(0)], bg = godOfBranch(dayStem, gz.charAt(1));
      var tags = [];
      ['work', 'money', 'love', 'study', 'business'].forEach(function (k) {
        if (k === 'love') {
          if (R.charmBranches.indexOf(gz.charAt(1)) >= 0 || withDayOf(gz) === 'comb') tags.push(k);
        } else if (R.yearTags[k].indexOf(D.godGroup[sg]) >= 0 || R.yearTags[k].indexOf(D.godGroup[bg]) >= 0) {
          tags.push(k);
        }
      });
      years.push({ year: seun.year + i, ganzhi: gz, stemGod: sg, branchGod: bg, tags: tags });
    }

    /* 첫 대운이 시작되기 전이면 첫 대운, 계산된 대운(약 90세까지)이 모두 지났으면 마지막 대운을 보여 준다 */
    var idx = daeun.current;
    if (idx < 0 && daeun.list.length) idx = ymdOf(now) < daeun.list[0].from ? 0 : daeun.list.length - 1;

    return {
      counted: gc.counted,
      groups: g,
      main: main,
      work: { type: main, duty: level(g['관성']) },
      money: {
        level: level(g['재성']),
        style: g['재성'] === 0 ? null : jeong > pyeon ? 'steady' : pyeon > jeong ? 'active' : 'mixed',
        flags: moneyFlags
      },
      love: {
        style: dayGroup,
        charm: charm === 0 ? null : charm === 1 ? 'one' : 'many',
        express: g['식상'] === 0 ? 'quiet' : g['식상'] >= R.many ? 'rich' : null
      },
      partner: { style: dayGroup, rel: dayRel },
      business: { kind: kind, watch: watch },
      health: { base: D.stemElem[dayStem], many: many, none: none, tense: tense },
      year: { year: seun.year, ganzhi: seun.ganzhi, stemGod: seun.stemGod, branchGod: seun.branchGod, withDay: withDayOf(seun.ganzhi) },
      years: years,
      daeun: { index: idx, next: idx >= 0 && idx + 1 < daeun.list.length ? idx + 1 : -1 }
    };
  }

  /* ── 공개 함수 ───────────────────────────────────────────────── */
  function chart(input, opts) {
    opts = opts || {};
    var now = opts.now ? new Date(opts.now) : new Date();
    var n = normalize(input);
    var p = pillarsOf(n.solar, n.hasTime);
    var dayStem = p.day.charAt(0);
    var dayElem = D.stemElem[dayStem];

    var cells = {};
    POS.forEach(function (k) { cells[k] = cellOf(dayStem, p[k], k); });
    var counts = elementsOf(POS.map(function (k) { return cells[k]; }));

    var voidPair = D.void[p.day];
    var idx = D.gapjaIndex[p.day];
    var birth = new Date(n.solar.getYear(), n.solar.getMonth() - 1, n.solar.getDay());
    var elements = {
      surface: counts.surface,
      withHidden: counts.withHidden,
      balance: { surface: balanceOf(dayElem, counts.surface), withHidden: balanceOf(dayElem, counts.withHidden) }
    };
    var relations = relationsOf(p);
    var daeun = daeunOf(n, dayStem, birth, now);
    var seun = seunOf(dayStem, now);

    return {
      input: {
        calendar: n.calendar, leap: n.leap, gender: n.gender,
        solarDate: n.solarDate, time: n.time, hasTime: n.hasTime
      },
      daySect: YY.DAY_SECT,
      pillars: p,
      cells: cells,
      dayMaster: { stem: dayStem, elem: dayElem, yang: D.yangStems.indexOf(dayStem) >= 0 },
      ilju: {
        ganzhi: p.day,
        index: idx,
        nayin: D.nayin[p.day],
        kind: D.branchKind[p.day.charAt(1)],
        url: '/encyclopedia/gapja/' + pad(idx) + '.html'
      },
      elements: elements,
      relations: relations,
      void: {
        branches: voidPair,
        hits: POS.filter(function (k) { return k !== 'day' && p[k] && voidPair.indexOf(p[k].charAt(1)) >= 0; })
      },
      daeun: daeun,
      seun: seun,
      warnings: warningsOf(n),
      reading: readingOf(p, cells, elements, relations, daeun, seun, now)
    };
  }

  YY.chart = chart;
  YY.chartRelations = relationsOf;
})();
