/**
 * 별별 작명소 — 이름 짓기
 *
 * 부모 이름에서 성과 이름 글자를 떼어내고, 고른 한자의 뜻을
 * 유사도만큼 아이 이름에 이어 담는다.
 */

(function () {
  "use strict";

  /* 카카오 JavaScript 키. 넣으면 카톡 공유가 카카오톡으로 바로 열린다.
     비워 두면 링크 복사·공유하기로 대신한다.
     (JavaScript 키는 카카오 개발자센터에 등록한 도메인에서만 쓰이는 공개 키다) */
  const KAKAO_JS_KEY = "a5b1b59ffa0ac623d2e69239c53cc6bc";

  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 밤하늘 ───────────────────────────────── */

  (function sky() {
    const canvas = $("sky");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    let stars = [];
    let w = 0;
    let h = 0;

    function seed() {
      const count = Math.min(200, Math.round((w * h) / 7500));
      stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.2 + 0.35,
          base: Math.random() * 0.5 + 0.25,
          speed: Math.random() * 0.0016 + 0.0004,
          phase: Math.random() * Math.PI * 2,
          gold: Math.random() < 0.28,
        });
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = reduceMotion ? s.base : s.base + Math.sin(t * s.speed + s.phase) * 0.28;
        const a = Math.max(0.05, Math.min(1, tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.gold
          ? "rgba(245, 197, 66, " + a + ")"
          : "rgba(255, 255, 255, " + a * 0.85 + ")";
        ctx.fill();
      }
      /* 움직임을 줄여 달라고 하신 분께는 반짝임이 없다.
         같은 그림을 초에 예순 번 다시 그릴 까닭이 없으니 한 번만 그린다. */
      if (!reduceMotion) requestAnimationFrame(frame);
    }

    let timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        resize();
        if (reduceMotion) frame(0); // 멈춰 있는 그림은 크기가 바뀌면 다시 그려야 한다
      }, 180);
    });
    resize();
    requestAnimationFrame(frame);
  })();

  $("year").textContent = String(new Date().getFullYear());

  /* ── 한글 다루기 ──────────────────────────── */

  const isHangulSyllable = (ch) => {
    const code = ch.charCodeAt(0);
    return code >= 0xac00 && code <= 0xd7a3;
  };

  const chosungOf = (ch) => {
    if (!isHangulSyllable(ch)) return null;
    return CHOSUNG[Math.floor((ch.charCodeAt(0) - 0xac00) / 588)];
  };

  /* ── 직접 적은 한자 읽기 ──────────────────── */

  /* 겉모습이 같은 다른 글자를 잘못 집지 않도록 번호로 적는다 */
  const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;

  /** 한자 한 글자로 사전을 뒤지기 위한 색인 */
  const HANJA_INDEX = (() => {
    const idx = {};
    for (const syl of Object.keys(SYL)) {
      for (const h of SYL[syl].h) if (!idx[h.c]) idx[h.c] = h;
    }
    return idx;
  })();

  /** 우리 사전이 아는 읽기. 樂(락·악)처럼 여럿일 수 있다. */
  const SYL_READINGS = (() => {
    const idx = {};
    for (const syl of Object.keys(SYL)) {
      for (const h of SYL[syl].h) (idx[h.c] = idx[h.c] || []).push(syl);
    }
    return idx;
  })();

  /* ── 온 한자의 훈음 ──────────────────────────
   *
   * 사전(data.js)에는 아이 이름을 짓는 데 쓰는 글자만 담는다. 그런데
   * 부모님 이름에는 그 밖의 글자가 얼마든지 온다 — 忯(믿을 지) · 㴗(깊을 유)
   * 처럼. 그런 글자의 뜻까지 알아보려고 2만 7천 자짜리 표를 따로 둔다.
   *
   * 화면을 여는 데 짐이 되지 않게, 부모님 이름을 적으실 때 그제야 받아 온다.
   * 받아 오지 못해도 한자는 그대로 쓴다. 뜻만 모를 뿐이다.
   * (tools/build-hun-table.js 로 만든다)
   */
  const ASSET_V = (() => {
    const tag = document.querySelector('script[src*="app.js"]');
    const m = tag && tag.getAttribute("src").match(/[?&]v=([^&]+)/);
    return m ? m[1] : "";
  })();

  let HUN = null;
  let hunAsked = false;

  function loadHun(onReady) {
    if (HUN || hunAsked || !window.fetch) return;
    hunAsked = true;
    fetch("hanja-hun.json" + (ASSET_V ? "?v=" + ASSET_V : ""))
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => {
        if (!t) return;
        HUN = t;
        if (onReady) onReady();
      })
      .catch(() => {
        /* 못 받아도 하던 대로 굴러간다 */
      });
  }

  /** 그 한자를 어떻게 읽는지. 우리 사전을 먼저 보고, 없으면 훈음 표를 본다. */
  function readingsOf(ch) {
    if (SYL_READINGS[ch]) return SYL_READINGS[ch].slice();
    if (!HUN || !HUN[ch]) return [];
    const out = [];
    for (const r of HUN[ch].split(",")) {
      const eum = r.slice(-1);
      if (out.indexOf(eum) < 0) out.push(eum);
    }
    return out;
  }

  /** 훈음 표에서 이 글자의 훈을 찾는다. 그 자리의 소리로 읽는 것을 먼저 본다. */
  function hunOf(ch, syl) {
    if (!HUN || !HUN[ch]) return "";
    const reads = HUN[ch].split(",");
    const fit = reads.filter((r) => r.slice(-1) === syl);
    const pick = (fit.length ? fit : reads)[0];
    return pick.slice(0, -1).trim();
  }

  /**
   * 소리마다 그 소리로 읽는 한자를 모아 둔다. 처음 찾을 때 한 번만 만든다.
   * 지 자리에 210자, 유 자리에 492자가 걸린다. 고르는 칸에 다 늘어놓으면
   * 쓸 수 없으니, 뜻으로 좁혀 찾아 드리는 데에 쓴다.
   */
  let HUN_BY_SYL = null;

  function buildHunIndex() {
    if (HUN_BY_SYL || !HUN) return;
    HUN_BY_SYL = {};
    for (const ch in HUN) {
      const reads = HUN[ch].split(",");
      const huns = [];
      const eums = [];
      for (const r of reads) {
        const eum = r.slice(-1);
        const hun = r.slice(0, -1).trim();
        if (eums.indexOf(eum) < 0) eums.push(eum);
        if (hun && huns.indexOf(hun) < 0) huns.push(hun);
      }
      for (const eum of eums) (HUN_BY_SYL[eum] = HUN_BY_SYL[eum] || []).push({ c: ch, huns });
    }
  }

  /**
   * 그 소리로 읽는 한자 가운데 적어 주신 말이 든 뜻을 찾는다.
   *
   * "사랑"만 적으셔도 "사랑할"이 걸리도록 품은 말로 견준다. 새김이 그 소리에
   * 매인 것만 보면 忯(믿을 지 · 사랑할 기)에서 사랑을 찾을 수 없으니,
   * 그 글자의 새김은 소리를 가리지 않고 모두 본다 — 어떻게 읽고 어떤 뜻으로
   * 쓰시는지는 그 이름을 가진 분이 가장 잘 아신다.
   */
  function searchHanja(text, syl, limit, exactOnly) {
    buildHunIndex();
    const want = (text || "").trim();
    if (!HUN_BY_SYL || !want) return [];
    /* 우리 사전에 담아 둔 뜻으로도 찾을 수 있어야 한다.
       智 를 훈음 표는 "슬기"로, 우리는 "지혜"로 적어 두었다. */
    const list = (SYL[syl] ? SYL[syl].h.map((h) => ({ c: h.c, huns: [h.m] })) : []).concat(
      HUN_BY_SYL[syl] || []
    );
    const forms = hunForms(want);
    const exact = [];
    const partial = [];
    const seen = new Set();
    for (const item of list) {
      if (seen.has(item.c + "/" + item.huns[0])) continue;
      for (const hun of item.huns) {
        const key = item.c + "/" + hun;
        if (seen.has(key)) continue;
        if (forms.some((f) => f === hun)) {
          seen.add(key);
          exact.push({ c: item.c, hun });
          break;
        }
        if (forms.some((f) => hun.indexOf(f) >= 0)) {
          seen.add(key);
          partial.push({ c: item.c, hun });
          break;
        }
      }
    }
    /* 우리 사전에 담긴 글자를 앞에 둔다. 눈에 익은 글자가 먼저 보이도록. */
    const rank = (x) => (HANJA_INDEX[x.c] ? 0 : 1);
    const sort = (a, b) => rank(a) - rank(b) || a.hun.length - b.hun.length;
    const out = exact.sort(sort);
    const all = exactOnly ? out : out.concat(partial.sort(sort));
    /* 같은 글자를 같은 뜻으로 두 번 늘어놓지 않는다 — 우리 사전은 "믿음",
       훈음 표는 "믿을"로 적어 두어 둘 다 걸린다. */
    const kept = [];
    for (const x of all) {
      if (kept.some((y) => y.c === x.c && sameHun(y.hun, x.hun))) continue;
      kept.push(x);
      if (kept.length >= (limit || 12)) break;
    }
    return kept;
  }

  /** "깊을" 을 유 자리에 적으셨을 때 㴗 을 찾아 준다. 여럿이면 여럿 그대로.
      여기서는 딱 맞는 새김만 본다. 적어 주신 말 그대로 쓸 것이기 때문이다. */
  function charsByHun(hun, syl) {
    return searchHanja(hun, syl, 6, true).map((x) => x.c);
  }

  const JONG = ["", "ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

  function jongOf(word) {
    const ch = word[word.length - 1];
    if (!ch || !isHangulSyllable(ch)) return "";
    return JONG[(ch.charCodeAt(0) - 0xac00) % 28];
  }

  /** 받침에 맞춰 "로 / 으로"를 고른다. 지로 · 성으로 처럼. */
  function ro(word) {
    const jong = jongOf(word);
    return !jong || jong === "ㄹ" ? "로" : "으로";
  }

  /** 받침에 맞춰 "은 / 는"을 고른다. 성은 · 지는 처럼. */
  const eun = (word) => (jongOf(word) ? "은" : "는");

  /** 끝 받침을 바꾼 말을 만든다. 빛남 ↔ 빛날 처럼. */
  function swapJong(word, from, to) {
    const ch = word[word.length - 1];
    if (!ch || !isHangulSyllable(ch)) return null;
    const code = ch.charCodeAt(0) - 0xac00;
    const jong = code % 28;
    if (JONG[jong] !== from) return null;
    return word.slice(0, -1) + String.fromCharCode(0xac00 + code - jong + JONG.indexOf(to));
  }

  /** 받침 없는 끝 글자에 받침을 붙인다. 고 → 곱 처럼. */
  function addJong(word, jong) {
    const ch = word[word.length - 1];
    if (!ch || !isHangulSyllable(ch)) return null;
    const code = ch.charCodeAt(0) - 0xac00;
    if (code % 28 !== 0) return null;
    const i = JONG.indexOf(jong);
    if (i < 0) return null;
    return word.slice(0, -1) + String.fromCharCode(0xac00 + code + i);
  }

  /**
   * 훈음 표의 새김은 "깊을 · 사랑할" 처럼 ㄹ로 끝난다.
   * 그대로 이어 붙이면 "사랑할 옥" · "사랑함과 깊음이 담긴 아이" 처럼
   * 어색해지므로, 꾸미는 꼴(a)과 잇는 꼴(j)을 만들어 둔다.
   *
   *   깊을    → 깊은     · 깊고
   *   사랑할  → 사랑이 가득한 · 사랑이
   *   고울    → 고운     · 곱고     (ㅂ이 빠진 말은 되돌린다)
   *   클      → 큰       · 크고
   */
  function inflectHun(hun) {
    if (!hun || jongOf(hun) !== "ㄹ") return null;
    const last = hun[hun.length - 1];

    /* "사랑할"처럼 -하다에서 온 말은 이름씨를 되찾는 쪽이 훨씬 낫다.
       "사랑하고 깊은" 보다 "사랑이 깊은" 이 우리 말에 가깝다. */
    if (last === "할" && hun.length >= 2) {
      const noun = hun.slice(0, -1);
      const josa = jongOf(noun) ? "이" : "가";
      return { a: noun + josa + " 가득한", j: noun + josa };
    }

    const a = swapJong(hun, "ㄹ", "ㄴ");
    if (!a) return null;

    let stem;
    if (last === "을") stem = hun.slice(0, -1);
    else if (last === "울" && hun.length >= 2) {
      /* 고울 ← 곱다, 아름다울 ← 아름답다. 이을 때 ㅂ을 되돌린다. */
      stem = addJong(hun.slice(0, -1), "ㅂ") || hun.slice(0, -1);
    } else stem = swapJong(hun, "ㄹ", "") || hun;

    return { a, j: stem + "고" };
  }

  /** 흔히 다르게 부르는 훈 */
  const HUN_ALIAS = { 한: "하나", 두: "둘", 석: "셋", 온: "온전할" };

  /**
   * 사전의 뜻과 견줄 수 있는 꼴들을 모은다.
   * "빛날"로 적어도 사전의 "빛남"을 찾아내기 위한 것.
   */
  function hunForms(hun) {
    const out = new Set([hun]);
    if (HUN_ALIAS[hun]) out.add(HUN_ALIAS[hun]);
    const toM = swapJong(hun, "ㄹ", "ㅁ");
    if (toM) out.add(toM);
    const toR = swapJong(hun, "ㅁ", "ㄹ");
    if (toR) out.add(toR);
    return [...out];
  }

  /** "빛날"과 "빛남"처럼 같은 뜻을 다르게 적은 것인지 본다 */
  function sameHun(a, b) {
    if (!a || !b) return false;
    return hunForms(a).some((f) => f === b || b.indexOf(f) >= 0 || f.indexOf(b) >= 0);
  }

  /** 이 글자를 달리 새기는 말들. 忯 이면 지금 쓰는 "믿을" 말고 "사랑할". */
  function otherHuns(ch, using) {
    if (!HUN || !HUN[ch]) return [];
    const out = [];
    for (const r of HUN[ch].split(",")) {
      const hun = r.slice(0, -1).trim();
      if (!hun || sameHun(hun, using)) continue;
      if (out.indexOf(hun) < 0) out.push(hun);
    }
    return out.slice(0, 3);
  }

  /** "한 일"처럼 뒤에 붙은 음을 떼어낸다 */
  function stripReading(text, syl) {
    let t = (text || "").replace(/[()（）·,]/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return "";
    const parts = t.split(" ");
    if (parts.length > 1 && parts[parts.length - 1] === syl) parts.pop();
    t = parts.join(" ").trim();
    if (t.length > 1 && t.endsWith(syl)) t = t.slice(0, -syl.length).trim();
    return t;
  }

  /** 사전에 없는 뜻으로 임시 항목을 만든다 */
  function customHanja(hun, ch) {
    const m = hun || "뜻 모름";
    /* 한 글자거나 "밝을"처럼 이미 꾸며 주는 꼴이면 그대로 쓰고,
       "은혜"처럼 이름씨면 "의"를 붙여야 말이 된다. */
    const adnominal = m.length === 1 || jongOf(m) === "ㄹ";
    /* 훈음 표의 새김은 ㄹ로 끝난다. 우리 말에 맞는 꼴로 두른다. */
    const bent = inflectHun(m);
    return {
      c: ch || "",
      m,
      a: bent ? bent.a : adnominal ? m : m + "의",
      j: bent ? bent.j : m + (jongOf(m) ? "과" : "와"),
      t: null,
      custom: true,
      short: adnominal,
    };
  }

  /**
   * 직접 적은 값을 읽는다.
   * "一", "한 일", "하나", "一 하나" 를 모두 받는다.
   */
  function parseCustom(text, syl) {
    const raw = (text || "").trim();
    if (!raw) return null;

    const hit = raw.match(CJK);
    if (hit) {
      const ch = hit[0];
      const typed = stripReading(raw.replace(CJK, " "), syl);
      const found = HANJA_INDEX[ch];
      /* 뜻을 함께 적어 주셨으면 그 뜻이 먼저다. 忯 을 사전에 "믿음"으로
         담아 두었어도 "사랑할 지 忯" 이라 적으셨으면 사랑으로 쓴다.
         한 글자에 뜻이 여럿인데 우리가 하나만 골라 둔 탓이다. */
      if (typed && !(found && sameHun(typed, found.m))) return customHanja(typed, ch);
      if (found) return found; // 사전에 있으면 뜻풀이까지 그대로 쓴다
      return customHanja(hunOf(ch, syl), ch);
    }

    const hun = stripReading(raw, syl);
    const entry = SYL[syl];
    if (entry && hun) {
      const forms = hunForms(hun);
      const found = entry.h.find((h) => forms.some((f) => f === h.m || h.m.includes(f) || f.includes(h.m)));
      if (found) return found;
    }

    /* 사전에 없는 뜻이라도 훈음 표에서 글자를 찾아 드린다.
       "깊을"을 유 자리에 적으시면 㴗 이 나온다. */
    const hits = charsByHun(hun, syl);
    if (hits.length === 1) return customHanja(hun, hits[0]);
    const out = customHanja(hun, "");
    if (hits.length > 1) out.candidates = hits;
    return out;
  }

  /** 이름을 성과 이름으로 나눈다. 두 글자 성도 알아본다. */
  function splitName(raw) {
    const n = (raw || "").replace(/\s+/g, "");
    if (n.length < 2) return null;
    for (const ch of n) if (!isHangulSyllable(ch)) return null;
    for (const ds of DOUBLE_SURNAMES) {
      if (n.startsWith(ds) && n.length >= 3) return { sur: ds, given: n.slice(2) };
    }
    return { sur: n[0], given: n.slice(1) };
  }

  /* ── 부모 이름 · 한자 고르기 ──────────────── */

  /** 화면에 그려 둔 한자 선택 줄 [{who, syl, sel}] */
  let hanjaRows = [];

  function renderHanjaPick() {
    const dad = splitName($("dadName").value);
    const mom = splitName($("momName").value);

    /* 이미 고른 값은 다시 그려도 유지한다 */
    const prev = {};
    for (const r of hanjaRows) {
      prev[r.who + r.syl + r.idx] = { v: r.sel.value, c: r.custom ? r.custom.value : "" };
    }

    hanjaRows = [];

    const build = (who, parsed, line, nativeBox) => {
      line.innerHTML = "";
      if (!parsed) {
        nativeBox.checked = false;
        return false;
      }

      [...parsed.given].forEach((syl, i) => {
        const entry = SYL[syl];
        const row = document.createElement("div");
        row.className = "hrow";

        const chip = document.createElement("span");
        chip.className = "hrow__syl";
        chip.textContent = syl;

        row.append(chip);

        const sel = document.createElement("select");
        if (entry) {
          entry.h.forEach((h, hi) => {
            const o = document.createElement("option");
            o.value = String(hi);
            o.textContent = h.c + " · " + h.m + " " + syl;
            sel.append(o);
          });
        }
        /* 곁에 놓인 글자 상자가 눈에는 이름표 노릇을 하지만
           읽어 주는 쪽에는 닿지 않아, 따로 붙여 둔다 */
        sel.setAttribute("aria-label", who + " 이름 '" + syl + "' 의 한자");

        const own = document.createElement("option");
        own.value = "custom";
        own.textContent = entry ? "✎ 직접 입력 · 찾기" : "✎ 한자 찾기 · 직접 입력";
        sel.append(own);

        /* 사전에 없는 글자는 처음부터 직접 입력으로 연다 */
        if (!entry) sel.value = "custom";

        const key = who + syl + i;
        if (prev[key] !== undefined) sel.value = prev[key].v;

        const custom = document.createElement("input");
        custom.type = "text";
        custom.className = "hrow__custom";
        /* 보기말에는 반드시 한자를 넣는다. 한글만 적어도 되는 것처럼
           보여 놓고 "한자를 적어 주세요"라고 하면 앞뒤가 맞지 않는다.
           그 자리의 소리로 읽는 글자를 보기로 들면 가장 알아보기 쉽다. */
        const sampleC = entry ? entry.h[0].c : "恩";
        const sampleH = (entry ? hunOf(sampleC, syl) : "") || (entry ? entry.h[0].m : "은혜");
        /* 한자를 알면 그대로, 뜻만 알면 뜻으로 — 두 길을 다 보여 준다 */
        custom.placeholder = sampleC + "  ·  " + sampleH;
        custom.maxLength = 12;
        /* 딸린 이름표가 없는 칸이라, 읽어 주는 이름을 붙여 둔다 */
        custom.setAttribute("aria-label", who + " 이름 '" + syl + "' 의 한자 직접 입력");
        if (prev[key] !== undefined) custom.value = prev[key].c;

        const note = document.createElement("p");
        note.className = "hrow__note";

        /* 찾은 글자를 눌러 고를 수 있게 늘어놓는 자리.
           지 자리에만 210자, 유 자리에는 492자가 걸려 고르는 칸에 다
           담을 수가 없다. 뜻을 적으시면 그때 좁혀서 보여 드린다. */
        const finds = document.createElement("div");
        finds.className = "hrow__finds";
        finds.hidden = true;

        const showFinds = (text) => {
          finds.innerHTML = "";
          const hits = searchHanja(text, syl, 12);
          if (!hits.length) {
            finds.hidden = true;
            return;
          }
          for (const hit of hits) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "hchip";
            chip.textContent = hit.c + " · " + hit.hun;
            chip.title = hit.hun + " " + syl + " " + hit.c;
            chip.addEventListener("click", () => {
              custom.value = hit.hun + " " + syl + " " + hit.c;
              syncNote();
              custom.focus();
            });
            finds.append(chip);
          }
          finds.hidden = false;
        };

        /* 적어 준 값을 어떻게 알아들었는지 그때그때 알려 준다 */
        const syncNote = () => {
          const raw = custom.value.trim();
          if (sel.value !== "custom" || !raw) {
            note.textContent = "";
            note.hidden = true;
            finds.hidden = true;
            return;
          }
          /* 한자를 이미 짚으셨으면 더 찾아 드릴 것이 없다 */
          showFinds(CJK.test(raw) ? "" : stripReading(raw, syl));
          const parsed = parseCustom(custom.value, syl);
          note.hidden = false;
          if (!parsed) {
            note.textContent = "";
            note.hidden = true;
          } else if (parsed.c && (parsed.m !== "뜻 모름" || !parsed.custom)) {
            /* 지 자리에 盛(성)을 적는 것처럼, 읽는 소리가 어긋나면 짚어 드린다.
               잘못 적으신 것일 수도 있고, 우리가 모르는 읽기일 수도 있어
               막지는 않는다. */
            const reads = readingsOf(parsed.c);
            if (reads.length && reads.indexOf(syl) < 0) {
              note.textContent =
                parsed.c + " " + eun(reads[0]) + " '" + reads.join("' · '") + "'" +
                ro(reads[reads.length - 1]) + " 읽어요. '" + syl +
                "' 자리가 맞나요? 그대로 쓰셔도 됩니다.";
              note.className = "hrow__note is-warn";
            } else {
              note.textContent = parsed.custom
                ? "✓ " + parsed.c + " · " + parsed.m + " " + syl + ro(syl) + " 씁니다"
                : "✓ 사전에서 찾았어요 — " + parsed.c + " · " + parsed.m + " " + syl;
              note.className = "hrow__note is-ok";

              /* 한 글자를 여러 뜻으로 새기는 일이 있다. 忯 을 우리는 "믿을"로
                 담아 두었지만 "사랑할"로 쓰시는 분도 계신다. 뜻을 따로 적지
                 않으셨을 때만, 다른 새김이 있다고 알려 드린다. */
              const others = custom.value.trim() === parsed.c ? otherHuns(parsed.c, parsed.m) : [];
              if (others.length) {
                note.textContent +=
                  " · '" + others.join("' · '") + "'로도 새기는 글자예요 — " +
                  "그 뜻이면 '" + others[0] + " " + syl + " " + parsed.c + "'라고 적어 주세요.";
              }
            }
          } else if (parsed.candidates) {
            note.textContent = "아래에서 쓰실 한자를 골라 주세요.";
            note.className = "hrow__note is-warn";
          } else if (parsed.c) {
            /* 글자는 그대로 쓴다. 우리가 뜻을 모를 뿐이라는 것을 분명히 한다.
               보기로 그분의 한자를 다시 보여 주면 엉뚱한 뜻을 붙인 것처럼
               읽히므로, 붙박이 보기를 쓴다. */
            note.textContent =
              "✓ " + parsed.c + ro(syl) + " 씁니다. 뜻만 저희가 몰라요 — " +
              "뒤에 뜻도 적어 주세요. (예: 一 하나)";
            note.className = "hrow__note is-ok";
          } else {
            note.textContent = finds.hidden
              ? "그 소리로 그런 뜻을 가진 한자를 못 찾았어요. 한자를 그대로 적어 주세요."
              : "아래에서 쓰실 한자를 골라 주세요.";
            note.className = "hrow__note is-warn";
          }
        };

        const syncCustom = () => {
          const open = sel.value === "custom";
          /* 700KB 짜리 표라, 직접 적으려 하실 때 그제야 받는다.
             안 여시는 분이 훨씬 많다. */
          if (open) wantHun();
          custom.hidden = !open;
          /* 직접 입력을 열면 적을 칸과 찾은 글자가 들어와 자리가 좁다.
             그 줄만 한 줄을 다 쓰게 한다. */
          row.classList.toggle("is-open", open);
          syncNote();
        };
        syncCustom();
        sel.addEventListener("change", syncCustom);
        custom.addEventListener("input", syncNote);
        /* 한글 이름 여부·고른 한자가 바뀌면 물려줄 글자도 달라진다 */
        sel.addEventListener("change", syncChosungOptions);
        /* 고른 한자가 바뀌면 두 분 이름의 뜻 계열도 바뀐다 */
        sel.addEventListener("change", syncSimil);

        row.append(sel, custom, note, finds);
        line.append(row);

        /* 훈음 표가 늦게 닿았을 때, 화면을 다시 그리지 않고 이 줄만 손본다.
           다시 그리면 고르던 자리와 글 쓰던 자리를 잃는다. */
        const refresh = () => {
          const c = entry ? entry.h[0].c : "恩";
          const h = (entry ? hunOf(c, syl) : "") || (entry ? entry.h[0].m : "은혜");
          custom.placeholder = c + "  ·  " + h;
          syncNote();
        };

        hanjaRows.push({ who, syl, idx: i, sel, custom, has: !!entry, refresh });
      });

      return true;
    };

    $("hanjaPickDad").hidden = !build("아빠", dad, $("hanjaRowsDad"), $("hanjaNativeDad"));
    $("hanjaPickMom").hidden = !build("엄마", mom, $("hanjaRowsMom"), $("hanjaNativeMom"));
    syncHanjaNative();

    /* 앞서 직접 입력을 골라 두셨으면 표가 있어야 한다 */
    if (hanjaRows.some((r) => r.sel.value === "custom")) wantHun();
  }

  /** 훈음 표를 받아 두고, 닿으면 적어 두신 값을 다시 읽어 드린다 */
  function wantHun() {
    loadHun(() => {
      for (const r of hanjaRows) if (r.refresh) r.refresh();
    });
  }

  /** 한글 이름 체크박스를 켜면 그 부모의 한자 선택 칸을 접어 둔다 */
  function syncHanjaNative() {
    for (const who of ["Dad", "Mom"]) {
      const on = $("hanjaNative" + who).checked;
      $("hanjaRowsWrap" + who).hidden = on;
      /* 한자 고르는 줄이 접히면 위가 허전해 여백을 줄인다 */
      $("hanjaPick" + who).classList.toggle("is-native", on);
    }
    /* 한자를 접으면 그 분 이름의 뜻 계열도 사라진다. 닮음 안내가 달라진다. */
    syncSimil();
  }
  $("hanjaNativeDad").addEventListener("change", syncHanjaNative);
  $("hanjaNativeMom").addEventListener("change", syncHanjaNative);

  $("dadName").addEventListener("input", onNamesChanged);
  $("momName").addEventListener("input", onNamesChanged);

  /* ── 아이의 성 ────────────────────────────── */

  /* 직접 고른 적이 있으면 그 뜻을 함부로 바꾸지 않는다 */
  let surPicked = false;

  document.querySelectorAll('input[name="sur"]').forEach((el) => {
    el.addEventListener("change", () => {
      surPicked = true;
    });
  });

  /**
   * 이름을 적지 않은 쪽의 성은 고를 수 없다.
   * 고를 수 없게 된 것을 골라 두었다면 고를 수 있는 쪽으로 옮겨 준다.
   */
  function syncSurnamePick() {
    const dad = splitName($("dadName").value);
    const mom = splitName($("momName").value);
    const pairs = [
      ["dad", dad, "surDad", "surTickDad"],
      ["mom", mom, "surMom", "surTickMom"],
    ];

    for (const [value, parsed, surId, tickId] of pairs) {
      const input = document.querySelector('input[name="sur"][value="' + value + '"]');
      input.disabled = !parsed;
      $(tickId).classList.toggle("is-off", !parsed);
      /* 이름을 적기 전에는 어떤 성이 될지 알 수 없다 */
      $(surId).textContent = parsed ? " " + parsed.sur : "";
    }

    /* 고를 수 없게 된 쪽을 고른 채로 두지 않는다. 직접 고르신 것은 그대로 둔다. */
    const cur = document.querySelector('input[name="sur"]:checked');
    if (cur && cur.disabled) {
      const other = cur.value === "dad" ? mom : dad;
      if (other) {
        document.querySelector(
          'input[name="sur"][value="' + (cur.value === "dad" ? "mom" : "dad") + '"]'
        ).checked = true;
      }
    } else if (!surPicked && dad) {
      /* 아직 손대지 않았으면 적은 쪽을 기본으로 둔다 */
      document.querySelector('input[name="sur"][value="dad"]').checked = true;
    } else if (!surPicked && mom) {
      document.querySelector('input[name="sur"][value="mom"]').checked = true;
    }
  }

  function onNamesChanged() {
    renderHanjaPick();
    syncSurnamePick();
    syncSimil();
    /* 물려받을 글자가 달라지면 한글 이름에서 고를 수 있는 초성도 달라진다 */
    syncChosungOptions();
  }

  /**
   * 부모에게서 물려받을 수 있는 글자들.
   *
   * 사전에 없는 글자도 소리는 물려받을 수 있으므로 함께 넘긴다.
   * (한자 이름에서는 한자가 있어야 하니 뒤에서 걸러 낸다)
   */
  function parentSyllables() {
    const nativeDad = $("hanjaNativeDad").checked;
    const nativeMom = $("hanjaNativeMom").checked;
    return hanjaRows.map((r) => {
      /* 한글 이름으로 체크한 쪽은 한자 없이 소리만 물려준다 */
      const isNative = r.who === "아빠" ? nativeDad : nativeMom;
      let hanja = null;
      if (!isNative) {
        if (r.sel.value === "custom") {
          hanja = parseCustom(r.custom.value, r.syl);
          /* 한자도 뜻도 안 적었으면 소리만 물려준다 */
          if (hanja && !hanja.c && hanja.m === "뜻 모름") hanja = null;
        } else if (r.has) {
          hanja = SYL[r.syl].h[Number(r.sel.value) || 0];
        }
      }
      return { who: r.who, syl: r.syl, hanja };
    });
  }

  /** 이름 → 뜻 계열. 부모님이 한글 이름일 때 그 뜻을 찾는 데 쓴다. */
  const TAG_BY_NAME = (() => {
    const m = Object.create(null);
    for (const x of HANGUL_NAMES) m[x.n] = x.t;
    return m;
  })();

  /**
   * 두 분 이름의 뜻 계열.
   *
   * 한자를 고르셨으면 그 한자에 달린 계열을 그대로 쓴다. 한글 이름이라
   * 한자가 없으면, 그 이름이 우리 목록에 있을 때 거기 달아 둔 계열을 쓴다.
   * (김한별 → "한별"의 계열) 목록에 없는 이름이면 뜻을 알 길이 없다.
   *
   * 이걸 두지 않으면 두 분 다 한글 이름일 때 뜻 계열이 텅 비어,
   * 25% · 75%가 아무 일도 하지 않고 지나간다.
   */
  function parentTagsOf(parents, given) {
    const tags = new Set();
    for (const p of parents) if (p.hanja && p.hanja.t) tags.add(p.hanja.t);
    for (const n of given || []) if (n && TAG_BY_NAME[n]) tags.add(TAG_BY_NAME[n]);
    return [...tags];
  }

  /**
   * 이 글자를 한자 이름에 물려줄 수 있는가.
   *
   * 고르신 한자가 있으면 그대로 쓴다. 한글 이름이라 한자가 없어도, 그 소리를
   * 적는 한자가 사전에 있으면 거기서 골라 넣는다. 물려받는 것은 소리이지
   * 한자가 아니기 때문이다.
   */
  function canLendHanja(p) {
    if (p.hanja && p.hanja.c) return true;
    return !!(SYL[p.syl] && SYL[p.syl].h.length);
  }

  /** 물려받은 글자에 붙일 한자. 고르신 것이 있으면 그대로. */
  function lentHanja(p) {
    if (p.hanja && p.hanja.c) return p.hanja;
    const all = (SYL[p.syl] && SYL[p.syl].h) || [];
    const open = all.filter((h) => !h.x);
    const list = open.length ? open : all;
    return list.length ? list[(Math.random() * list.length) | 0] : null;
  }

  /* ── 유사도 ───────────────────────────────── */

  /** 화면에 적어 드릴 때 쓰는 이름 (안내문 · 결과 딱지 · 공유 글) */
  const HANGUL_LABEL = "한글 이름";
  /**
   * 한글 이름인가 (= 한자를 쓰지 않는가).
   *
   * 한글 이름은 글자를 짜맞추지 않는다. 낱자를 이어 붙이면 말이 되지 않아
   * (미르의 "르", 여울의 "울") 손질해 담아 둔 목록에서 통째로 골라 온다.
   */
  const fromList = (script) => script !== "hanja";

  /**
   * 닮음 눈금.
   *
   *   parent  꼭 물려받을 글자 수
   *   tag     한 단 더 닮게 하는 몫. 두 갈래에서 뜻이 다르다.
   *             한자 이름 — 부모님 한자의 뜻 계열(빛 · 지혜 · 덕 …)로 한 자리를 채운다
   *             한글 이름 — 한자가 없어 뜻 계열이 없다. 대신 한 글자 더 닮은 이름을
   *                         먼저 보여 준다 (없으면 조용히 아래 단으로 내려간다)
   *
   * 하는 일이 갈래마다 다르니 안내문도 갈래마다 따로 적는다.
   * 한쪽 말만 띄우면 다른 쪽에서는 거짓말이 된다.
   */
  const SIMIL_PLAN = {
    0: {
      parent: 0, tag: 0,
      desc: "두 분 이름과 상관없이 새로 지어 드립니다.",
    },
    25: {
      parent: 0, tag: 1,
      desc: "글자는 안 물려받고, 두 분 이름과 뜻이 같은 갈래로 지어 드립니다.",
    },
    /* "아빠나 엄마" 와 "아빠도 엄마도" 를 또렷이 갈라 적는다.
       50과 100을 헷갈리시는 자리가 바로 여기다. */
    50: {
      parent: 1, tag: 0,
      desc: "아빠나 엄마 이름에서 한 글자만 물려받습니다.",
    },
    75: {
      parent: 1, tag: 1,
      desc: "한 글자만 물려받고, 뜻도 같은 갈래로 맞춥니다.",
    },
    100: {
      parent: 2, tag: 0,
      desc: "아빠 이름에서 한 글자, 엄마 이름에서 한 글자를 물려받습니다.",
    },
  };

  /* 잠기기 직전에 고르던 닮음. 이름을 적으면 이 값으로 되돌린다. */
  let similHeld = "0";

  /**
   * 닮음 눈금 밑에 적어 드릴 말.
   *
   * 한자 이름과 한글 이름은 하는 일이 완전히 같으므로(글자 물려받기 +
   * 뜻 계열 맞추기) 같은 말을 쓴다. 다만 형편에 따라 다른 말로 바뀐다.
   * 한 분 이름만 적으셨으면 "아빠에게서 하나, 엄마에게서 하나"가 될 수 없고,
   * 외자는 자리가 하나뿐이라 두 글자를 물려받을 수 없다. 두 분 이름의 뜻을
   * 알 수 없으면 뜻 계열을 맞추는 단(25 · 75)도 그 몫을 못 한다.
   */
  function similDesc(v, len, whoCount, hasTag) {
    /* 두 글자를 물려받을 수 있는 형편인가 */
    const canTwo = whoCount >= 2 && len >= 2;

    if (v === 100 && !canTwo) {
      if (len === 1) return "외자는 자리가 하나예요. 두 분 중 한 분의 글자를 그대로 가져옵니다.";
      return "아빠 · 엄마 이름을 모두 적어 주셔야 한 글자씩 가져올 수 있어요.";
    }
    /* 뜻을 모르면 25는 0과, 75는 50과 같아진다. 숨기지 말고 그렇다고 적는다. */
    if ((v === 25 || v === 75) && !hasTag) {
      return SIMIL_PLAN[v === 25 ? 0 : 50].desc +
        " 두 분 이름의 뜻을 알 수 없어 뜻 계열은 맞추지 못해요.";
    }

    return SIMIL_PLAN[v].desc;
  }

  function syncSimil() {
    /* 물려받을 이름이 없으면 닮음을 고를 수가 없다. 0%에 묶어 둔다. */
    const hasParent = !!(splitName($("dadName").value) || splitName($("momName").value));
    const slider = $("simil");

    if (!hasParent) {
      /* 잠그는 동안에는 손잡이도 0 에 둔다. 고르던 값은 기억했다가 되돌린다. */
      if (!slider.disabled) similHeld = slider.value;
      slider.value = "0";
      slider.disabled = true;
      $("simil").closest(".simil-block").classList.add("is-off");
      $("similPct").textContent = "0%";
      $("similDesc").textContent = "위에 엄마 아빠 이름을 적어 주세요.";
      return;
    }

    if (slider.disabled) {
      slider.value = similHeld;
      slider.disabled = false;
    }
    $("simil").closest(".simil-block").classList.remove("is-off");

    const v = Number(slider.value);
    const len = Number(document.querySelector('input[name="len"]:checked').value);
    const dad = splitName($("dadName").value);
    const mom = splitName($("momName").value);
    const whoCount = (dad ? 1 : 0) + (mom ? 1 : 0);
    /* 뜻 계열을 맞출 수 있는 형편인지 미리 본다 */
    const hasTag = parentTagsOf(parentSyllables(), [
      dad && dad.given,
      mom && mom.given,
    ]).length > 0;
    $("similPct").textContent = v + "%";
    $("similDesc").textContent = similDesc(v, len, whoCount, hasTag);
  }
  document.querySelectorAll('input[name="len"]').forEach((el) =>
    el.addEventListener("change", syncSimil)
  );
  $("simil").addEventListener("input", () => {
    syncSimil();
    /* 닮음이 달라지면 한글 이름에서 고를 수 있는 초성도 달라진다 */
    syncChosungOptions();
  });
  /* 첫 화면은 이름이 비어 있으니 성 고르기와 닮음도 그에 맞춰 둔다 */
  syncSurnamePick();
  syncSimil();

  /* ── 원하는 초성 ──────────────────────────── */

  /** 아이 이름 후보로 쓸 한자 글자. 부모님 세대 글자(o)는 뺀다. */
  const POOL_HANJA = Object.keys(SYL).filter((s) => !SYL[s].o);

  /**
   * 그 소리를 아이 이름에 쓸 때 고를 수 있는 한자.
   *
   * 사전에는 부모님 이름을 읽어 드리려고 담아 둔 한자(x)도 함께 있다.
   * 어른 이름에는 흔해도 요즘 아이 이름으로는 잘 쓰지 않는 글자라,
   * 새로 지을 때는 뺀다. 물려받는 글자는 부모님이 고른 그대로 쓴다.
   */
  const childHanja = (syl) => {
    const all = (SYL[syl] && SYL[syl].h) || [];
    const open = all.filter((h) => !h.x);
    return open.length ? open : all;
  };

  /** 글자 정보. 한자 사전에 없으면 순우리말 글자 사전에서 찾는다. */
  const info = (syl) => SYL[syl] || PURE[syl] || null;

  /**
   * 그 자리를 이 초성으로 두고도 지을 이름이 남는지 본다.
   *
   * 지을 수 없는 초성을 고르면 "이름이 없어요"로 끝나 버리니,
   * 아예 고르지 못하게 막아 둔다. picked 는 다른 자리에서 이미 고른 초성이라,
   * 한글 이름처럼 이름을 통째로 골라 오는 쪽은 짝이 맞는지까지 본다.
   *
   * 한자 이름은 자리·성별을 놓아 가며 다시 찾고 자리마다 글자를 따로
   * 고르므로, 그 소리를 적는 글자가 하나라도 있으면 지을 수 있다.
   */
  function chosungAvailable(c, i, picked, len, script, gender) {
    if (!fromList(script)) return POOL_HANJA.some((s) => chosungOf(s) === c);

    /* 목록에서 고르는 쪽은 닮음도 함께 지켜야 한다. 이름을 통째로 가져오므로
       "부모님 글자를 품은 이름" 안에서 그 초성이 나와야 고를 수 있다. */
    const parents = parentSyllables();
    const want = pureWant({ simil: Number($("simil").value), len, parents });
    const dad = new Set(parents.filter((p) => p.who === "아빠").map((p) => p.syl));
    const mom = new Set(parents.filter((p) => p.who === "엄마").map((p) => p.syl));
    const any = new Set([...dad, ...mom]);
    const has = (name, set) => [...name].some((ch) => set.has(ch));

    return HANGUL_NAMES.some((x) => {
      if (x.n.length !== len) return false;
      if (gender !== "N" && x.g !== "N" && x.g !== gender) return false;
      if (chosungOf(x.n[i]) !== c) return false;
      if (want >= 2 && dad.size && mom.size && !(has(x.n, dad) && has(x.n, mom))) return false;
      if (want === 1 && any.size && !has(x.n, any)) return false;
      return picked.every((p, j) => j === i || !p || chosungOf(x.n[j]) === p);
    });
  }


  /** 지금 그려 둔 초성 선택 상자 (이름 자리 순서대로) */
  let chosungSelects = [];

  /** 고를 수 없게 된 초성을 잠그고, 골라 둔 것이 막히면 '상관없음'으로 되돌린다 */
  function syncChosungOptions() {
    const len = chosungSelects.length;
    const script = document.querySelector('input[name="script"]:checked').value;
    const gender = document.querySelector('input[name="gender"]:checked').value;
    const picked = chosungSelects.map((s) => s.value);

    chosungSelects.forEach((sel, i) => {
      /* 이 자리 값은 스스로를 막지 않도록 빼고 본다 */
      for (const o of sel.options) {
        if (!o.value) continue;
        o.disabled = !chosungAvailable(o.value, i, picked, len, script, gender);
        o.textContent = o.disabled ? o.value + " (없음)" : o.value;
      }
      if (sel.value && sel.selectedOptions[0] && sel.selectedOptions[0].disabled) {
        sel.value = "";
        picked[i] = "";
      }
    });
  }

  function renderChosungPicks() {
    const len = Number(document.querySelector('input[name="len"]:checked').value);
    const box = $("chosungPicks");
    const prev = chosungSelects.map((s) => s.value);

    box.innerHTML = "";
    chosungSelects = [];

    for (let i = 0; i < len; i++) {
      const field = document.createElement("label");
      field.className = "field chosung-field";

      const label = document.createElement("span");
      label.className = "field__label";
      label.textContent = (i + 1) + "번째 글자";

      const sel = document.createElement("select");
      const any = document.createElement("option");
      any.value = "";
      any.textContent = "상관없음";
      sel.append(any);
      CHOSUNG_PICKABLE.forEach((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        sel.append(o);
      });
      if (prev[i]) sel.value = prev[i];
      sel.addEventListener("change", syncChosungOptions);

      field.append(label, sel);
      box.append(field);
      chosungSelects.push(sel);
    }
    syncChosungOptions();
  }
  document
    .querySelectorAll('input[name="len"]')
    .forEach((el) => el.addEventListener("change", renderChosungPicks));
  document
    .querySelectorAll('input[name="script"], input[name="gender"]')
    .forEach((el) => el.addEventListener("change", syncChosungOptions));
  /* 닮음이 하는 일은 이름 표기마다 다르다. 표기를 바꾸면 안내문도 바꿔 준다. */
  document
    .querySelectorAll('input[name="script"]')
    .forEach((el) => el.addEventListener("change", syncSimil));
  renderChosungPicks();

  /* ── 조건 칸 여닫기 ───────────────────────── */

  document.querySelectorAll('input[name="must"]').forEach((el) => {
    el.addEventListener("change", () => {
      const v = document.querySelector('input[name="must"]:checked').value;
      $("mustChar").hidden = v !== "char";
    });
  });

  /* ── 이름 짓기 ────────────────────────────── */

  /**
   * 목록에서 한글 이름 고르기.
   *
   * 한자에서 온 소리를 섞지 않으려면 글자를 짜맞출 수 없다.
   * 이미 손질해 담아 둔 이름 가운데서 조건에 맞는 것을 고른다.
   *
   * wantParent 는 꼭 물려받아야 할 글자 수.
   *
   * wantTag 를 켜면 두 분 이름과 뜻 계열이 같은 이름을 먼저 내놓는다.
   * 한자 이름의 "뜻 계열 잇기"와 똑같은 일이다 — 이름마다 달아 둔 t 를
   * 보고 맞춘다. 그런 이름이 동나면 조용히 걸림이 풀려 아래 단으로 내려간다.
   *
   * wantTag 는 고를 순서만 바꾼다. 지을 수 있나 없나는 바꾸지 않으므로,
   * 까닭을 짚어 주는 whyNone 에서는 켜지 않아도 된다.
   */
  function pickPureName(o, wantParent, wantTag) {
    const from = (who) => new Set(o.parents.filter((p) => p.who === who).map((p) => p.syl));
    const dadSyls = from("아빠");
    const momSyls = from("엄마");
    const anySyl = new Set([...dadSyls, ...momSyls]);
    const has = (name, set) => [...name].some((c) => set.has(c));
    /* 두 분 글자를 다 품었나 · 한 분 것이라도 품었나 */
    const bothOk = dadSyls.size && momSyls.size;
    const holds = (n, want) =>
      want >= 2
        ? bothOk && has(n, dadSyls) && has(n, momSyls)
        : !!anySyl.size && has(n, anySyl);

    let list = HANGUL_NAMES.filter((x) => {
      if (x.n.length !== o.len) return false;
      if (o.gender !== "N" && x.g !== "N" && x.g !== o.gender) return false;
      if (o.mustChar && !x.n.includes(o.mustChar)) return false;
      if (!chosungMatchAll(x.n, o.chosung)) return false;
      /* BLOCKED 는 글자를 짜맞추다 나온 뜻밖의 말을 거르려는 것이라,
         통째로 손질해 담아 둔 이름에는 대지 않는다.
         (은하수의 "하수"처럼 멀쩡한 이름이 애먼 데서 걸린다) */
      if (o.exclude.has(o.surname + x.n)) return false;
      return true;
    });
    if (!list.length) return null;

    /* 1) 꼭 지켜야 할 만큼은 걸러 낸다. 못 지키면 이름을 내놓지 않고 위로
          돌려보내, 조건을 한 단 풀었다고 알려 드린 뒤 다시 찾게 한다.
          (조용히 아무 이름이나 내면 부모님 이름을 썼는 줄 아시게 된다) */
    if (wantParent >= 1) {
      const strict = list.filter((x) => holds(x.n, wantParent));
      /* 100%인데 한 분만 적으셨으면 두 분 글자를 다 품을 수가 없다.
         그때는 pureWant 가 이미 1로 낮춰 두므로 여기 걸리지 않는다. */
      list = strict;
    }
    if (!list.length) return null;

    /* 2) 두 분 이름과 뜻이 같은 갈래인 이름을 먼저 내놓는다.
          동나면 이 걸림이 저절로 풀려 아래 단으로 내려간다. */
    if (wantTag) {
      const tags = o.parentTags || [];
      if (tags.length) {
        const near = list.filter((x) => tags.includes(x.t));
        if (near.length) list = near;
      }
    }

    const pick = list[(Math.random() * list.length) | 0];
    const inherited = o.parents.filter((p) => pick.n.includes(p.syl));
    return {
      slots: [...pick.n].map((syl) => ({ syl, hanja: null, from: null })),
      given: pick.n,
      full: o.surname + pick.n,
      inherited,
      pure: pick,
    };
  }

  function genderOk(syl, want) {
    if (want === "N") return true;
    const d = info(syl);
    if (!d) return true; // 사전에 없는 글자는 가리지 않는다
    return d.g === "N" || d.g === want;
  }

  /** 그 자리에 원하는 초성을 골라 두지 않았거나, 골라 둔 초성과 같으면 된다. */
  function chosungOk(syl, i, chosung) {
    const want = chosung && chosung[i];
    if (!want) return true;
    return chosungOf(syl) === want;
  }

  function chosungMatchAll(str, chosung) {
    return [...str].every((c, i) => chosungOk(c, i, chosung));
  }

  function posOk(syl, i, len) {
    const d = info(syl);
    if (!d) return true;
    const p = d.p;
    if (p === "b") return true;
    /* 외자는 첫 글자이면서 끝 글자라, 앞자리/끝자리를 가리면 아무것도 남지 않는다 */
    if (len === 1) return true;
    if (i === 0) return p === "1";
    if (i === len - 1) return p === "2";
    return true; // 세 글자 이름의 가운데는 가리지 않는다
  }

  function blocked(sur, given) {
    const full = sur + given;
    for (const bad of BLOCKED) {
      if (given.includes(bad) || full.includes(bad)) return true;
    }
    return false;
  }

  /**
   * 조건에 맞는 이름 하나를 찾는다.
   * 못 찾으면 조건을 하나씩 풀면서 다시 찾는다.
   */
  /** 목록에서 고르는 이름이 물려받아야 할 글자 수.
      이름을 적어 주신 분 수만큼만 물려받을 수 있다 —
      아빠만 적으셨으면 100%라도 한 글자가 최대다. */
  function pureWant(o) {
    const whoCount = new Set(o.parents.map((p) => p.who)).size;
    return Math.min(SIMIL_PLAN[o.simil].parent, o.len, whoCount);
  }

  function buildName(o) {
    /* 한글 이름은 담아 둔 목록에서만 고른다.
       닮음을 지킬 수 없으면 몰래 풀지 않고 못 지었다고 돌려보낸다.
       한자 이름도 물려받기는 풀지 않으므로 결이 같다. */
    if (fromList(o.script)) {
      /* tag 는 두 갈래에서 같은 일을 한다 — 두 분 이름의 뜻 계열 잇기. */
      return pickPureName(o, pureWant(o), !!SIMIL_PLAN[o.simil].tag);
    }

    /* 앞에서부터 차례로 시도한다. 뒤로 갈수록 조건을 하나씩 놓아 준다. */
    const steps = [
      { tag: true, pos: true, gender: true },
      { tag: false, pos: true, gender: true },
      { tag: false, pos: false, gender: true },
      { tag: false, pos: false, gender: false },
    ];

    for (const keep of steps) {
      const found = attempt(o, keep);
      if (found) return found;
    }
    return null;
  }

  /** keep.tag/pos/gender 가 true 면 그 조건을 지킨다. */
  function attempt(o, keep) {
    const plan = SIMIL_PLAN[o.simil];
    const parents = o.parents;
    const wantParent = Math.min(plan.parent, o.len, parents.length);
    const wantTag = keep.tag ? plan.tag : 0;
    const pool = POOL_HANJA; // 여기는 한자 이름만 온다

    /* 두 분 이름의 뜻 계열. 한글 이름을 적으신 분 것도 함께 들어 있다. */
    const parentTags = o.parentTags || [];

    const results = [];
    /* 뜻이 겹치는 이름. 달리 낼 것이 없을 때만 쓴다. */
    const spare = [];
    const seen = new Set();

    for (let n = 0; n < 6000 && results.length < 40; n++) {
      /* 자리별 글자 고르기 */
      const slots = new Array(o.len).fill(null);
      const used = new Set();

      /* 1) 부모에게서 물려받을 글자 배치 */
      let inherited = [];
      if (wantParent > 0) {
        /* 물려받을 글자도 고른 성별에 맞는 것을 먼저 본다.
           그것만으로 수가 모자라면 그때 나머지도 함께 본다. */
        let source = o.script === "hanja" ? parents.filter(canLendHanja) : parents;
        if (keep.gender && o.gender !== "N") {
          const fit = source.filter((p) => genderOk(p.syl, o.gender));
          const whos = new Set(fit.map((p) => p.who));
          const enough = wantParent >= 2 ? whos.size >= 2 : fit.length > 0;
          if (enough) source = fit;
        }
        const shuffled = source.slice().sort(() => Math.random() - 0.5);
        const picked = [];
        for (const p of shuffled) {
          if (picked.length >= wantParent) break;
          if (picked.some((q) => q.syl === p.syl)) continue;
          /* 100%일 때는 아빠·엄마 한 글자씩 */
          if (wantParent >= 2 && picked.length === 1 && picked[0].who === p.who) continue;
          picked.push(p);
        }
        if (picked.length < wantParent) continue;

        const spots = [...Array(o.len).keys()].sort(() => Math.random() - 0.5);
        let ok = true;
        picked.forEach((p, i) => {
          const spot = spots[i];
          const posGood = !keep.pos || posOk(p.syl, spot, o.len);
          const chosungGood = chosungOk(p.syl, spot, o.chosung);
          if (posGood && chosungGood) {
            /* 한자가 없는 글자는 그 소리를 적는 한자를 골라 넣는다 */
            const h = o.script === "hanja" ? lentHanja(p) : p.hanja;
            if (h === null && o.script === "hanja") {
              ok = false;
              return;
            }
            slots[spot] = { syl: p.syl, hanja: h, from: p.who };
            used.add(p.syl);
          } else {
            ok = false;
          }
        });
        if (!ok) continue;
        inherited = picked;
      }

      /* 2) 나머지 자리 채우기 */
      let tagLeft = wantTag;
      let fail = false;
      for (let i = 0; i < o.len; i++) {
        if (slots[i]) continue;
        const cands = pool.filter((s) => {
          if (used.has(s)) return false;
          if (keep.gender && !genderOk(s, o.gender)) return false;
          if (keep.pos && !posOk(s, i, o.len)) return false;
          if (!chosungOk(s, i, o.chosung)) return false;
          if (tagLeft > 0 && !childHanja(s).some((h) => parentTags.includes(h.t))) return false;
          return true;
        });
        if (!cands.length) {
          fail = true;
          break;
        }
        const syl = cands[(Math.random() * cands.length) | 0];

        let hs = childHanja(syl);
        if (tagLeft > 0) {
          const tagged = hs.filter((h) => parentTags.includes(h.t));
          if (tagged.length) {
            hs = tagged;
            tagLeft--;
          }
        }
        /* 마지막 글자는 뜻풀이의 받침이 되니 손에 잡히는 뜻을 먼저 고른다 */
        if (i === o.len - 1) {
          const solid = hs.filter((h) => CONCRETE.has(h.m));
          if (solid.length) hs = solid;
        }
        slots[i] = { syl, hanja: hs[(Math.random() * hs.length) | 0], from: null };
        used.add(syl);
      }
      if (fail) continue;

      /* 3) 조건 확인 */
      const given = slots.map((s) => s.syl).join("");
      if (seen.has(given)) continue;
      seen.add(given);

      if (o.mustChar && !given.includes(o.mustChar)) continue;
      if (blocked(o.surname, given)) continue;

      const full = o.surname + given;
      if (o.exclude.has(full)) continue;

      /* 뜻이 겹치면 "하늘 같은 하늘" · "향기로운 향기" 처럼 읽힌다.
         글자는 다른데 뜻이 같아 생기는 일이라 글자만 보아서는 못 거른다.
         뜻풀이를 만들어 보고 같은 말이 두 번 나오면 뒤로 미룬다. */
      (repeatsWord(meaningOf(slots)) ? spare : results).push({ slots, given, full, inherited });
    }

    /* 겹치지 않는 것이 하나도 없으면 그때는 겹쳐도 내놓는다.
       뜻이 조금 겹치는 이름이 "없어요" 보다는 낫다. */
    const pool2 = results.length ? results : spare;
    if (!pool2.length) return null;
    return pool2[(Math.random() * pool2.length) | 0];
  }

  /* ── 뜻풀이 ───────────────────────────────── */

  /**
   * 뜻을 이어 붙인다.
   *
   * 마지막 글자의 뜻이 손에 잡히는 말이면 그대로 받침으로 쓰고
   * ("은혜로운 보배"), 성질을 가리키는 말이면 "아이"를 붙여 풀어 쓴다
   * ("은혜롭고 준수한 아이").
   */
  function meaningOf(slots) {
    const h = slots.map((s) => s.hanja);
    /* 뜻을 모르는 글자가 섞이면 억지로 풀지 않는다 */
    if (h.some((x) => !x || x.m === "뜻 모름")) return "";
    const last = h[h.length - 1];
    const head = CONCRETE.has(last.m);

    /* 외자는 꾸밀 앞글자가 없다. 손에 잡히는 뜻이면 그대로,
       아니면 "아이"를 받쳐 이름씨로 만든다. */
    if (h.length === 1) {
      return head ? last.m : last.a + " 아이";
    }

    if (h.length === 2) {
      return head ? h[0].a + " " + last.m : h[0].j + " " + last.a + " 아이";
    }
    return head
      ? h[0].j + " " + h[1].a + " " + last.m
      : h[0].j + " " + h[1].j + " " + last.a + " 아이";
  }

  /**
   * 뜻풀이에 같은 말이 두 번 나오는지 본다.
   * "하늘 같은 하늘" · "향기로운 향기" · "기둥 같은 기둥" 같은 것.
   * 한쪽이 다른 쪽을 품는 것도 본다 — "볕처럼 환하고 아침 볕처럼 환한".
   */
  function repeatsWord(text) {
    if (!text) return false;
    const words = text.replace(" 아이", "").split(/\s+/).filter(Boolean);
    const same = (a, b) => {
      if (a === b) return true;
      const [x, y] = a.length < b.length ? [a, b] : [b, a];
      /* 한 글자짜리("복")도 잡되, 남의 말 가운데에 우연히 든 것은 넘긴다.
         "복된 복"은 잡고 "글이 깊은 볕"은 넘긴다. */
      return y.indexOf(x) === 0 || y.lastIndexOf(x) === y.length - x.length;
    };
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        if (same(words[i], words[j])) return true;
      }
    }
    return false;
  }

  /** 글자마다 "보배 진 珍" 처럼 뜻 · 음 · 한자를 늘어놓는다. */
  function readingOf(slots, script) {
    return slots
      .map((s) => {
        /* 뜻과 소리가 같으면("빛 빛") 한 번만 적는다 */
        const known = s.hanja && s.hanja.m && s.hanja.m !== "뜻 모름" && s.hanja.m !== s.syl;
        /* 한자를 쓰지 않는 표기를 골랐으면 한자는 보여 주지 않는다 */
        const ch = !fromList(script) && s.hanja && s.hanja.c ? ' <i>' + s.hanja.c + "</i>" : "";
        return '<span class="ch">' + (known ? s.hanja.m + " " : "") + s.syl + ch + "</span>";
      })
      .join("");
  }

  /* ── 화면에 보여주기 ──────────────────────── */

  const LOADING_LINES = [
    "밤하늘에서 별을 모으는 중",
    "엄마 아빠 이름의 뜻을 읽는 중",
    "가장 어울리는 한자를 고르는 중",
    "이름에 마음을 담는 중",
  ];

  let loadTimer = null;

  function showLoading() {
    const box = $("loading");
    const text = $("loadingText");
    let i = 0;
    text.textContent = LOADING_LINES[0];
    box.hidden = false;
    loadTimer = setInterval(() => {
      i = (i + 1) % LOADING_LINES.length;
      text.textContent = LOADING_LINES[i];
    }, 620);
  }

  function hideLoading() {
    clearInterval(loadTimer);
    $("loading").hidden = true;
  }

  /* ── 이미 보여 준 이름 기억하기 ───────────────
   *
   * 창을 닫았다 열어도 앞서 나온 이름은 다시 내놓지 않는다.
   * 부모 이름이 바뀌면 다른 이야기이므로 그 조합마다 따로 담아 둔다.
   * 창을 닫으면 잊는다. 브라우저가 저장을 막아 두었으면(사생활 보호 창 등)
   * 조용히 넘기고 이번 판 동안만 기억한다.
   */

  const HISTORY_KEY = "byeolStarNaming.shown.v1";
  /** 한 부모 조합당 기억할 이름 수. 넘치면 오래된 것부터 잊는다. */
  const HISTORY_MAX = 500;
  /** 부모 조합 수. 넘치면 가장 오래 안 쓴 것부터 잊는다. */
  const HISTORY_KEYS_MAX = 20;

  /* 창을 닫으면 잊는다(sessionStorage). 며칠 뒤에 다시 오셨는데 "모두
     보여 드렸어요"부터 뜨면 막다른 길처럼 느껴지기 때문이다. 새로고침이나
     뒤로 가기로는 지워지지 않으니 한 번 앉은 자리에서는 이어진다. */
  function loadHistory() {
    try {
      /* 예전에 localStorage 에 남겨 둔 것이 있으면 치운다 */
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      /* 못 지워도 그만 — 이제 읽지 않는다 */
    }
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      const all = raw ? JSON.parse(raw) : null;
      return all && typeof all === "object" ? all : {};
    } catch (e) {
      return {};
    }
  }

  function saveHistory(all) {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(all));
    } catch (e) {
      /* 저장할 수 없으면 이번 판 동안만 기억한다 */
    }
  }

  /** 부모 이름 두 개로 만드는 열쇠 */
  function historyKey(dad, mom) {
    return (dad || "").replace(/\s+/g, "") + "|" + (mom || "").replace(/\s+/g, "");
  }

  function readShown(key) {
    const rec = loadHistory()[key];
    const list = Array.isArray(rec) ? rec : rec && Array.isArray(rec.n) ? rec.n : [];
    return new Set(list.filter((x) => typeof x === "string"));
  }

  function writeShown(key, set) {
    const all = loadHistory();
    all[key] = { n: [...set].slice(-HISTORY_MAX), t: Date.now() };

    /* 오래 안 쓴 부모 조합부터 덜어 낸다 */
    const keys = Object.keys(all);
    if (keys.length > HISTORY_KEYS_MAX) {
      keys
        .sort((a, b) => (all[a].t || 0) - (all[b].t || 0))
        .slice(0, keys.length - HISTORY_KEYS_MAX)
        .forEach((k) => delete all[k]);
    }
    saveHistory(all);
  }

  function clearShown(key) {
    const all = loadHistory();
    delete all[key];
    saveHistory(all);
  }

  /** 지금 보여 주고 있는 이름 */
  let current = null;
  /** 이제까지 보여 준 이름들 (이 부모 조합에서) */
  let shown = new Set();
  /** 지금 쓰고 있는 기억 열쇠 */
  let shownKey = "";
  /** 마지막으로 제출한 조건 */
  let lastOpts = null;

  function openModal(result, opts) {
    current = { result, opts };
    const hanjaEl = $("modalHanja");
    const charsEl = $("modalChars");
    const meaningEl = $("modalMeaning");

    if (fromList(opts.script)) {
      /* 한글 이름은 한자가 없다. 뜻은 목록에 담아 둔 그대로 보여 준다.
         한자 자리가 비니, 물려받은 글자가 있으면 그 자리에 적어 드린다. */
      $("modalTag").textContent = HANGUL_LABEL;
      $("modalTag").hidden = false;
      hanjaEl.textContent = "";
      charsEl.textContent = "";
      meaningEl.textContent = result.pure ? result.pure.d : "";
    } else {
      $("modalTag").hidden = true;
      hanjaEl.textContent = result.slots.map((s) => s.hanja.c).join("");
      charsEl.innerHTML = readingOf(result.slots, opts.script);
      meaningEl.textContent = meaningOf(result.slots);
    }

    $("modalName").textContent = result.full;

    $("modalResult").hidden = false;
    $("modalExhausted").hidden = true;
    $("againBtn").disabled = false;
    $("modal").hidden = false;
  }

  function closeModal() {
    $("modal").hidden = true;
  }

  /** 더 지어 드릴 이름이 남지 않았을 때, 이름 없이 안내만 단독으로 보여 준다. */
  function showExhausted(msg) {
    current = null;
    $("modalResult").hidden = true;
    $("modalExhausted").hidden = false;
    $("modalExhaustedText").textContent = msg;
    $("modal").hidden = false;
  }

  document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("modal").hidden) closeModal();
  });

  /* ── 토스트 ───────────────────────────────── */

  let toastTimer = null;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    /* 안내가 길어질 때가 있어 넉넉히 읽을 틈을 준다 */
    toastTimer = setTimeout(() => (el.hidden = true), 6500);
  }

  /* ── 제출 ─────────────────────────────────── */

  /** 직접 입력을 골라 두고 한자를 적지 않은 칸. 없으면 null. */
  function badCustomRow() {
    const nativeDad = $("hanjaNativeDad").checked;
    const nativeMom = $("hanjaNativeMom").checked;
    for (const r of hanjaRows) {
      if (r.sel.value !== "custom") continue;
      if (r.who === "아빠" ? nativeDad : nativeMom) continue;
      const parsed = parseCustom(r.custom.value, r.syl);
      if (!parsed || !parsed.c) return r;
    }
    return null;
  }

  function readOptions() {
    const dadRaw = $("dadName").value.trim();
    const momRaw = $("momName").value.trim();
    const dad = splitName(dadRaw);
    const mom = splitName(momRaw);

    /* 이름은 적지 않아도 된다. 다만 적다 말면 알려 준다. */
    if (dadRaw && !dad) return { error: "아빠 이름을 두 글자 이상 한글로 적어 주세요." };
    if (momRaw && !mom) return { error: "엄마 이름을 두 글자 이상 한글로 적어 주세요." };

    /* 아이의 성 — 고른 쪽 이름에서 떼어 온다.
       두 분 다 적지 않았으면 따올 성이 없으니 이름만 지어 준다. */
    const surMode = document.querySelector('input[name="sur"]:checked').value;
    const surFrom = surMode === "mom" ? mom : dad;
    const surname = surFrom ? surFrom.sur : (dad ? dad.sur : mom ? mom.sur : "");

    const script = document.querySelector('input[name="script"]:checked').value;

    /* 직접 입력을 골라 두고 한자를 적지 않으셨으면 여기서 멈춘다.
       아무 글자나 받아 두면 그 자리는 소리만 남은 채 이름이 지어져,
       적어 주신 것이 쓰인 줄 아시게 된다. */
    const blank = badCustomRow();
    if (blank) {
      blank.custom.focus();
      return {
        error:
          "'" + blank.syl + "' 자리에 한자를 적어 주세요. " +
          "한자가 없는 이름이면 아래 '한글 이름이에요'를 골라 주세요.",
      };
    }

    const parents = parentSyllables();
    /* 한글 이름을 적으신 분은 한자가 없다. 그 이름이 목록에 있으면
       거기 달아 둔 뜻 계열을 대신 쓴다. */
    const parentTags = parentTagsOf(parents, [
      dad && dad.given,
      mom && mom.given,
    ]);

    /* 한자 이름에 물려줄 수 있는 글자.
       한자를 고르셨으면 그 한자를 그대로 쓰고, 한글 이름이라 한자가 없으면
       그 소리를 적는 한자를 사전에서 찾아 넣는다. 김한별 · 이은결 두 분이
       모두 한글 이름이어도 김한결 같은 한자 이름을 지어 드릴 수 있다. */
    const usable = fromList(script) ? parents : parents.filter(canLendHanja);

    const mustMode = document.querySelector('input[name="must"]:checked').value;
    let mustChar = "";

    if (mustMode === "char") {
      mustChar = $("mustCharInput").value.trim();
      if (!mustChar) return { error: "꼭 넣을 글자를 한 글자 적어 주세요." };
      if (!isHangulSyllable(mustChar)) return { error: "꼭 넣을 글자는 한글 한 글자여야 해요." };
      /* 한자를 쓰지 않는 표기는 소리만 있으면 되니 어떤 글자든 넣어 드린다.
         한자 이름은 그 글자의 한자를 알아야 한다. */
      if (!fromList(script) && !SYL[mustChar]) {
        /* "별"처럼 한자의 뜻(훈)일 뿐 소리(음)가 아닌 글자가 많다.
           별을 한자로 적으면 星이고, 읽는 소리는 "성"이다. */
        const pure = PURE[mustChar];
        const why = pure
          ? '"' + mustChar + '"은(는) 한자의 뜻이에요. 한자로는 ' + pure.why +
            "처럼 쓰고 소리는 다르게 읽습니다. "
          : '"' + mustChar + '" 소리로 읽는 한자가 사전에 없어요. ';
        /* 한글 이름으로 옮기시라 하려면 그쪽에 그 글자가 실제로 있어야 한다.
           없는데 옮기시라 하면 거기서 또 막힌다. */
        const inHangul = HANGUL_NAMES.some((x) => x.n.includes(mustChar));
        return {
          error: inHangul
            ? why + "이름 표기를 한글 이름으로 바꾸면 그대로 넣어 드릴게요."
            : why + '"' + mustChar + '"이(가) 든 이름은 아직 담아 두지 못했어요.',
        };
      }
    }

    const simil = parents.length ? Number($("simil").value) : 0;

    if (simil > 0 && !usable.length) {
      return {
        error: fromList(script)
          ? "두 분 이름을 다시 확인해 주세요."
          : "두 분 이름의 글자를 한자로 옮길 수가 없어요. 이름 표기를 한글 이름으로 바꾸거나 닮음을 0%로 해 주세요.",
      };
    }
    const len = Number(document.querySelector('input[name="len"]:checked').value);
    const chosung = chosungSelects.slice(0, len).map((s) => s.value);

    if (len > 1 && simil === 100 && new Set(usable.map((p) => p.who)).size < 2) {
      return {
        error: "닮음 100%는 아빠·엄마 이름에서 각각 한 글자씩 가져와요. 닮음을 조금 낮춰 주세요.",
      };
    }

    /* 성의 한자는 사전에 없을 수 있으니 한글 그대로 둔다 */
    return {
      surname,
      surHanja: null,
      key: historyKey(dadRaw + "/" + surname, momRaw),
      len,
      gender: document.querySelector('input[name="gender"]:checked').value,
      script,
      simil,
      mustChar,
      chosung,
      parents,
      parentTags,
      exclude: shown,
    };
  }

  /**
   * 이름을 못 지었을 때 무엇이 걸렸는지 짚어 준다.
   *
   * 한글 이름은 손질해 담아 둔 목록에서 통째로 고르므로, 닮음을 지킬
   * 이름이 아예 없을 수 있다. 그럴 때 무엇을 낮추면 되는지 알려 드려야 한다.
   */
  function whyNone(opts) {
    const plain = "이 조건에 맞는 이름을 찾지 못했어요. 조건을 조금 풀어 주세요.";
    if (!fromList(opts.script)) return plain;

    const label = HANGUL_LABEL;
    const fresh = Object.assign({}, opts, { exclude: new Set() });
    const LEN = { 1: "외자", 2: "두 글자", 3: "세 글자" };

    /* 꼭 넣을 글자가 아예 없는 목록이면, 자수나 닮음을 아무리 손봐도 안 나온다.
       그것부터 짚어 드려야 엉뚱한 데를 만지지 않으신다. */
    if (opts.mustChar && !HANGUL_NAMES.some((x) => x.n.includes(opts.mustChar))) {
      const josa = jongOf(opts.mustChar) ? "이" : "가";
      return (
        '"' + opts.mustChar + '"' + josa + " 든 " + label + "이 없어요. " +
        "꼭 넣을 글자를 바꾸거나 이름 표기를 한자로 바꿔 보세요."
      );
    }
    /* 이 자수로는 담아 둔 이름이 애초에 하나도 없을 수 있다.
       그때는 닮음을 아무리 낮춰도 안 나오므로 닮음 탓으로 돌리면 안 된다.
       (소리로 지은 이름에는 외자가 없다 — "닮음 0%로는" 하고 운을 떼면
        0%보다 더 낮출 데가 없어 무엇을 만져야 할지 알 수 없게 된다) */
    const anyAt = (n) => !!pickPureName(Object.assign({}, fresh, { len: n }), 0);
    if (!anyAt(opts.len)) {
      const roomy = [1, 2, 3].filter((n) => n !== opts.len && anyAt(n));
      return (
        LEN[opts.len] + " " + label + "이 없어요." +
        (roomy.length ? " " + roomy.map((n) => LEN[n]).join("나 ") + "로 두시면 나와요." : "")
      );
    }

    const canDo = (n) =>
      !!pickPureName(
        Object.assign({}, fresh, { len: n }),
        pureWant(Object.assign({}, opts, { len: n }))
      );

    /* 자수만 바꾸면 나오는가 — 이 쪽이 가장 손쉬운 길이라 먼저 권한다 */
    const other = [1, 2, 3].filter((n) => n !== opts.len && canDo(n));
    if (other.length) {
      return (
        "닮음 " + opts.simil + "%로는 " + LEN[opts.len] + " " + label + "이 없어요. " +
        other.map((n) => LEN[n]).join("나 ") + "로 두시면 나와요."
      );
    }

    /* 닮음을 낮추면 나오는가 */
    for (let w = pureWant(opts) - 1; w >= 0; w--) {
      if (!pickPureName(fresh, w)) continue;
      return (
        "닮음 " + opts.simil + "%로 지을 수 있는 " + label + "이 없어요. " +
        (w > 0 ? "두 분 글자를 다 품은 이름이 없거든요." : "부모님 이름 글자를 품은 이름이 없거든요.") +
        " 닮음을 낮춰 주세요."
      );
    }
    return plain;
  }

  function run(opts, isAgain) {
    showLoading();
    const wait = reduceMotion ? 200 : 1900 + Math.random() * 500;
    setTimeout(() => {
      const result = buildName(opts);
      hideLoading();

      if (!result) {
        /* 앞서 나온 이름을 빼고 나니 남은 것이 없을 수 있다.
           그럴 때는 기억을 지우고 처음부터 볼 수 있게 해 준다. */
        /* 조건 자체가 맞는 이름이 없는 것인지, 앞서 다 보여 드려서
           남은 것이 없는 것인지 가려낸다. 기억을 비우고 한 번 더 찾아본다. */
        const exhausted =
          shown.size > 0 && !!buildName(Object.assign({}, opts, { exclude: new Set() }));

        if (!exhausted) {
          showError(whyNone(opts));
          return;
        }

        /* 보여 줄 이름이 화면에 없으면(다시 들어와 지은 첫 판) 빈 창이 뜬다.
           막다른 길이 되지 않게 기억을 비우고 곧바로 다시 지어 준다. */
        if (!current) {
          const many = shown.size;
          clearShown(shownKey);
          shown = new Set();
          opts.exclude = shown;
          const again = buildName(opts);
          if (!again) {
            showError(whyNone(opts));
            return;
          }
          shown.add(again.full);
          writeShown(opts.key, shown);
          openModal(again, opts);
          toast("이 조건의 이름 " + many + "개를 모두 보여 드려서, 처음부터 다시 보여 드려요.");
          return;
        }

        /* 더 지어 드릴 이름이 없다. 이름 없이 안내만 단독으로 보여 준다. */
        showExhausted("지어 드릴 수 있는 이름을 모두 보여 드렸어요.");
        return;
      }

      shown.add(result.full);
      writeShown(opts.key, shown);
      openModal(result, opts);
    }, wait);
  }

  function showError(msg) {
    const el = $("formError");
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }

  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    $("formError").hidden = true;

    const opts = readOptions();
    if (opts.error) {
      showError(opts.error);
      return;
    }

    /* 이 창에서 이미 보여 드린 이름은 빼고 짓는다 */
    shownKey = opts.key;
    shown = readShown(shownKey);
    opts.exclude = shown;
    lastOpts = opts;
    run(opts, false);
  });

  $("againBtn").addEventListener("click", () => {
    if (!lastOpts) return;
    $("modal").hidden = true;
    run(lastOpts, true);
  });

  /* 지금까지 본 이름을 지우고 곧바로 처음부터 다시 지어 준다 */
  $("exhaustedOkBtn").addEventListener("click", () => {
    if (shownKey) clearShown(shownKey);
    shown = new Set();
    $("modal").hidden = true;
    if (!lastOpts) return;
    lastOpts.exclude = shown;
    run(lastOpts, true);
  });

  /* ── 공유 ─────────────────────────────────── */

  /** 지금 이름의 한자와 글자 뜻. "周蓮 · 두루 주 · 연꽃 연" 꼴로 돌려준다. */
  function readingPlain() {
    if (!current || current.opts.script !== "hanja") return "";
    const slots = current.result.slots;
    const hanja = slots.map((s) => s.hanja && s.hanja.c).filter(Boolean).join("");
    if (!hanja) return "";
    const parts = slots
      .filter((s) => s.hanja && s.hanja.m && s.hanja.m !== "뜻 모름")
      .map((s) => s.hanja.m + " " + s.syl);
    return parts.length ? hanja + " · " + parts.join(" · ") : hanja;
  }

  /** 이름에 딸린 뜻 한 줄 */
  function meaningPlain() {
    if (!current) return "";
    const r = current.result;
    return current.opts.script === "hanja" ? meaningOf(r.slots) : r.pure ? r.pure.d : "";
  }

  function shareText() {
    if (!current) return "";
    /* 카카오 카드를 못 띄우고 글로만 나갈 때도 한자와 뜻, 링크가 함께 보이게 한다.
       (이미지 공유는 파일과 이 글만 실어 보내므로, 링크를 안에 넣어 두지 않으면
       사진만 돌아다니고 사이트로 오는 길이 사라진다) */
    const url = location.href.split("#")[0];
    return [
      "별별 작명소에서 지은 이름 ✦ " + current.result.full,
      readingPlain(),
      meaningPlain(),
      url,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** 카카오 카드에 들어갈 설명 */
  function shareDescription() {
    if (!current) return "";
    const lines = [readingPlain(), meaningPlain()].filter(Boolean);
    if (fromList(current.opts.script) && lines.length) {
      lines.unshift(HANGUL_LABEL);
    }
    return lines.join("\n") || "엄마 아빠 이름으로 지은 아이 이름";
  }

  /**
   * 카카오 카드에 얹을 그림 주소.
   *
   * 카카오는 자기 서버가 가져갈 수 있는 주소만 받으므로, 브라우저에서 만든
   * 그림을 바로 얹지 못한다. 대신 같은 그림을 그려 주는 /api/card 에
   * 이름과 뜻을 실어 보낸다. (api/card.js)
   */
  /* /api/card 가 살아 있을 때만 결과 그림을 쓴다. 그 자리가 없거나 탈이 나면
     (정적 서버로 띄워 볼 때, 함수가 죽었을 때) 붙박이 대문 그림으로 돌아간다. */
  let cardApiReady = false;
  (function pingCardApi() {
    if (!window.fetch) return;
    fetch("/api/card?ping=1", { method: "GET" })
      .then((res) => {
        cardApiReady = res.ok;
      })
      .catch(() => {
        cardApiReady = false;
      });
  })();

  /**
   * 카드 그림의 판 번호.
   *
   * 같은 이름이면 같은 그림이라 주소마다 오래 담아 두게 해 두었다
   * (Cache-Control: immutable). 그래서 그리는 쪽을 고치거나 글꼴을
   * 바꾸어도, 한 번 담긴 주소는 옛 그림을 그대로 내놓는다. 카카오도
   * 한 번 가져간 그림을 붙들고 있다.
   *
   * 카드 모양이나 글꼴을 손보았으면 이 번호를 올려 주세요.
   * 주소가 달라지므로 새로 그린 그림이 나갑니다.
   */
  const CARD_V = "4";

  function cardImageUrl() {
    if (!current || !cardApiReady) return "";
    const r = current.result;
    const q = new URLSearchParams();
    q.set("n", r.full);

    if (fromList(current.opts.script)) {
      /* 카드 위에 "한글 이름" 딱지를 올려 달라는 뜻 (api/card.js) */
      q.set("p", "1");
    } else {
      const hanja = r.slots.map((s) => s.hanja && s.hanja.c).filter(Boolean).join("");
      if (hanja) q.set("h", hanja);
      const readings = r.slots
        .filter((s) => s.hanja && s.hanja.c && s.hanja.m && s.hanja.m !== "뜻 모름")
        .map((s) => s.hanja.m + " " + s.syl + " " + s.hanja.c);
      if (readings.length) q.set("r", readings.join(","));
    }

    const meaning = meaningPlain();
    if (meaning) q.set("m", meaning);
    q.set("v", CARD_V);

    return location.origin + "/api/card?" + q.toString();
  }

  if (KAKAO_JS_KEY) {
    const s = document.createElement("script");
    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    s.async = true;
    s.onload = () => {
      try {
        if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
      } catch (e) {
        console.warn("[별별 작명소] 카카오 SDK 초기화 실패:", e);
      }
    };
    s.onerror = () => {
      console.warn("[별별 작명소] 카카오 SDK를 불러오지 못했어요. 공유는 기본 방식으로 대신합니다.");
    };
    document.head.append(s);
  }

  $("shareBtn").addEventListener("click", async () => {
    const text = shareText();
    const url = location.href.split("#")[0];
    const card = cardImageUrl();

    if (KAKAO_JS_KEY && window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: "별별 작명소 ✦ " + current.result.full,
            description: shareDescription(),
            /* 결과 그림을 못 만들면 붙박이 대문 그림으로 돌아간다. 크기도 그에 맞춘다. */
            imageUrl: card || new URL("assets/og-image-v3.png", location.href).href,
            imageWidth: card ? 1080 : 1200,
            imageHeight: card ? 1080 : 630,
            link: { mobileWebUrl: url, webUrl: url },
          },
          buttons: [
            { title: "나도 지어보기", link: { mobileWebUrl: url, webUrl: url } },
          ],
        });
        return;
      } catch (_) {
        /* 아래 방법으로 넘어간다 */
      }
    }

    if (navigator.share) {
      try {
        /* text 안에 링크가 이미 있으니 url 을 따로 또 넘기지 않는다 (겹쳐 보이는 것을 막는다) */
        await navigator.share({ title: "별별 작명소", text });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(text + "\n" + url);
      toast("이름과 링크를 복사했어요");
    } catch (_) {
      toast("복사가 안 돼요. 주소창을 길게 눌러 복사해 주세요.");
    }
  });
})();
