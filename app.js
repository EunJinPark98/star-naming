/**
 * 별별 작명소 — 이름 짓기
 *
 * 부모 이름에서 성과 이름 글자를 떼어내고, 고른 한자의 뜻을
 * 유사도만큼 아이 이름에 이어 담는다.
 */

(function () {
  "use strict";

  /* 카카오 JavaScript 키. 넣으면 카톡 공유가 카카오톡으로 바로 열린다.
     비워 두면 링크 복사·공유하기로 대신한다. */
  const KAKAO_JS_KEY = "";

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
      requestAnimationFrame(frame);
    }

    let timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(resize, 180);
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
    const box = $("hanjaPick");
    const rows = $("hanjaRows");

    if (!dad && !mom) {
      box.hidden = true;
      rows.innerHTML = "";
      hanjaRows = [];
      return;
    }

    /* 이미 고른 값은 다시 그려도 유지한다 */
    const prev = {};
    for (const r of hanjaRows) prev[r.who + r.syl + r.idx] = r.sel.value;

    rows.innerHTML = "";
    hanjaRows = [];

    const add = (who, parsed) => {
      if (!parsed) return;
      [...parsed.given].forEach((syl, i) => {
        const entry = SYL[syl];
        const row = document.createElement("div");
        row.className = "hrow";

        const label = document.createElement("span");
        label.className = "hrow__who";
        label.textContent = who;

        const chip = document.createElement("span");
        chip.className = "hrow__syl";
        chip.textContent = syl;

        row.append(label, chip);

        const sel = document.createElement("select");
        if (entry) {
          entry.h.forEach((h, hi) => {
            const o = document.createElement("option");
            o.value = String(hi);
            o.textContent = h.c + " · " + h.m + " " + syl;
            sel.append(o);
          });
          const key = who + syl + i;
          if (prev[key] !== undefined) sel.value = prev[key];
        } else {
          const o = document.createElement("option");
          o.textContent = "사전에 없는 글자예요";
          sel.append(o);
          sel.disabled = true;
        }
        row.append(sel);
        rows.append(row);

        hanjaRows.push({ who, syl, idx: i, sel, has: !!entry });
      });
    };

    add("아빠", dad);
    add("엄마", mom);
    box.hidden = hanjaRows.length === 0;
  }

  $("dadName").addEventListener("input", renderHanjaPick);
  $("momName").addEventListener("input", renderHanjaPick);

  /** 부모에게서 물려받을 수 있는 글자들 */
  function parentSyllables() {
    return hanjaRows
      .filter((r) => r.has)
      .map((r) => ({
        who: r.who,
        syl: r.syl,
        hanja: SYL[r.syl].h[Number(r.sel.value) || 0],
      }));
  }

  /* ── 유사도 ───────────────────────────────── */

  const SIMIL_PLAN = {
    0: { parent: 0, tag: 0, desc: "부모님 이름과 상관없이 새로 짓습니다." },
    25: { parent: 0, tag: 1, desc: "글자는 새로 짓되, 부모님 한자의 뜻 계열을 이어받습니다." },
    50: { parent: 1, tag: 0, desc: "부모님 이름에서 한 글자를 그대로 가져옵니다." },
    75: { parent: 1, tag: 1, desc: "한 글자를 그대로 가져오고, 나머지도 같은 뜻 계열로 맞춥니다." },
    100: { parent: 2, tag: 0, desc: "아빠와 엄마 이름에서 각각 한 글자씩 가져옵니다." },
  };

  function syncSimil() {
    const v = Number($("simil").value);
    $("similPct").textContent = v + "%";
    $("similDesc").textContent = SIMIL_PLAN[v].desc;
  }
  $("simil").addEventListener("input", syncSimil);
  syncSimil();

  /* ── 조건 칸 여닫기 ───────────────────────── */

  document.querySelectorAll('input[name="must"]').forEach((el) => {
    el.addEventListener("change", () => {
      const v = document.querySelector('input[name="must"]:checked').value;
      $("mustChar").hidden = v !== "char";
      $("mustCho").hidden = v !== "cho";
    });
  });

  /* 초성 고르기 채우기 */
  [$("cho1"), $("cho2")].forEach((sel) => {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "고르지 않음";
    sel.append(none);
    CHOSUNG_PICKABLE.forEach((c) => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      sel.append(o);
    });
  });

  /* 이름 자수가 두 글자면 셋째 글자 초성은 의미가 없다 */
  function syncChoLabels() {
    const len = Number(document.querySelector('input[name="len"]:checked').value);
    const labels = $("mustCho").querySelectorAll(".field__label");
    labels[0].textContent = "첫 글자 초성";
    labels[1].textContent = len === 3 ? "둘째 또는 셋째 글자 초성" : "둘째 글자 초성";
  }
  document.querySelectorAll('input[name="len"]').forEach((el) =>
    el.addEventListener("change", syncChoLabels)
  );
  syncChoLabels();

  /* ── 이름 짓기 ────────────────────────────── */

  const POOL = Object.keys(SYL);

  function genderOk(syl, want) {
    if (want === "N") return true;
    const g = SYL[syl].g;
    return g === "N" || g === want;
  }

  function posOk(syl, i, len) {
    const p = SYL[syl].p;
    if (p === "b") return true;
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

  function choOk(given, c1, c2) {
    if (c1) {
      if (chosungOf(given[0]) !== c1) return false;
    }
    if (c2) {
      const rest = [...given].slice(1).map(chosungOf);
      if (!rest.includes(c2)) return false;
    }
    return true;
  }

  /**
   * 조건에 맞는 이름 하나를 찾는다.
   * 못 찾으면 조건을 하나씩 풀면서 다시 찾는다.
   */
  function buildName(o) {
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

    /* 부모 한자의 뜻 계열 */
    const parentTags = [...new Set(parents.map((p) => p.hanja.t))];

    const results = [];
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
        let source = parents;
        if (keep.gender && o.gender !== "N") {
          const fit = parents.filter((p) => genderOk(p.syl, o.gender));
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
          if (!keep.pos || posOk(p.syl, spot, o.len)) {
            slots[spot] = { syl: p.syl, hanja: p.hanja, from: p.who };
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
        const cands = POOL.filter((s) => {
          if (used.has(s)) return false;
          if (keep.gender && !genderOk(s, o.gender)) return false;
          if (keep.pos && !posOk(s, i, o.len)) return false;
          if (tagLeft > 0 && !SYL[s].h.some((h) => parentTags.includes(h.t))) return false;
          return true;
        });
        if (!cands.length) {
          fail = true;
          break;
        }
        const syl = cands[(Math.random() * cands.length) | 0];
        let hs = SYL[syl].h;
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
      if (!choOk(given, o.cho1, o.cho2)) continue;
      if (blocked(o.surname, given)) continue;

      const full = o.surname + given;
      if (o.exclude.has(full)) continue;

      results.push({ slots, given, full, inherited });
    }

    if (!results.length) return null;
    return results[(Math.random() * results.length) | 0];
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
    const last = h[h.length - 1];
    const head = CONCRETE.has(last.m);

    if (h.length === 2) {
      return head ? h[0].a + " " + last.m : h[0].j + " " + last.a + " 아이";
    }
    return head
      ? h[0].j + " " + h[1].a + " " + last.m
      : h[0].j + " " + h[1].j + " " + last.a + " 아이";
  }

  function readingOf(slots) {
    return slots.map((s) => s.hanja.m + " " + s.syl).join(", ");
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

  /** 지금 보여 주고 있는 이름 */
  let current = null;
  /** 이번 판에서 이미 보여 준 이름들 */
  let shown = new Set();
  /** 마지막으로 제출한 조건 */
  let lastOpts = null;

  function openModal(result, opts) {
    current = { result, opts };
    const hanjaEl = $("modalHanja");
    const meaningEl = $("modalMeaning");
    const detailEl = $("modalDetail");

    if (opts.script === "hanja") {
      hanjaEl.textContent = opts.surHanja
        ? opts.surHanja + result.slots.map((s) => s.hanja.c).join("")
        : result.slots.map((s) => s.hanja.c).join("");
      meaningEl.textContent = meaningOf(result.slots);
    } else {
      hanjaEl.textContent = "";
      meaningEl.textContent = "";
    }

    $("modalName").textContent = result.full;

    const rows = [];
    if (opts.script === "hanja") {
      rows.push(["글자 뜻", readingOf(result.slots)]);
    }
    if (result.inherited.length) {
      rows.push([
        "이어받은 글자",
        result.inherited
          .map((p) => p.who + " 이름의 <b>" + p.syl + (opts.script === "hanja" ? "(" + p.hanja.c + ")" : "") + "</b>")
          .join(", "),
      ]);
    } else if (opts.simil === 25) {
      rows.push(["이어받은 뜻", "부모님 한자와 같은 뜻 계열에서 골랐어요"]);
    }
    rows.push([
      "고른 조건",
      [
        opts.gender === "M" ? "남아" : opts.gender === "F" ? "여아" : "성별 무관",
        opts.len + "글자",
        "닮음 " + opts.simil + "%",
      ].join(" · "),
    ]);

    detailEl.innerHTML = rows
      .map((r) => '<div class="dl"><span class="dl__k">' + r[0] + '</span><span class="dl__v">' + r[1] + "</span></div>")
      .join("");

    $("modalNote").textContent = "";
    $("againBtn").disabled = false;
    $("modal").hidden = false;
  }

  function closeModal() {
    $("modal").hidden = true;
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
    toastTimer = setTimeout(() => (el.hidden = true), 2200);
  }

  /* ── 제출 ─────────────────────────────────── */

  function readOptions() {
    const dad = splitName($("dadName").value);
    const mom = splitName($("momName").value);
    const err = [];

    if (!dad) err.push("아빠 이름을 두 글자 이상 한글로 적어 주세요.");
    if (!mom) err.push("엄마 이름을 두 글자 이상 한글로 적어 주세요.");
    if (err.length) return { error: err.join(" ") };

    const parents = parentSyllables();
    if (!parents.length) {
      return { error: "두 분 이름 글자가 사전에 없어요. 다른 이름으로 시도해 주세요." };
    }

    const mustMode = document.querySelector('input[name="must"]:checked').value;
    let mustChar = "";
    let cho1 = "";
    let cho2 = "";

    if (mustMode === "char") {
      mustChar = $("mustCharInput").value.trim();
      if (!mustChar) return { error: "꼭 넣을 글자를 한 글자 적어 주세요." };
      if (!isHangulSyllable(mustChar)) return { error: "꼭 넣을 글자는 한글 한 글자여야 해요." };
      if (!SYL[mustChar]) {
        return { error: '"' + mustChar + '" 는 아직 사전에 없는 글자예요. 다른 글자로 골라 주세요.' };
      }
    } else if (mustMode === "cho") {
      cho1 = $("cho1").value;
      cho2 = $("cho2").value;
      if (!cho1 && !cho2) return { error: "초성을 하나 이상 골라 주세요." };
    }

    const simil = Number($("simil").value);
    if (simil === 100 && new Set(parents.map((p) => p.who)).size < 2) {
      return { error: "닮음 100%는 두 분 이름이 모두 사전에 있어야 해요. 유사도를 낮춰 주세요." };
    }

    /* 성의 한자는 사전에 없을 수 있으니 한글 그대로 둔다 */
    return {
      surname: dad.sur,
      surHanja: null,
      len: Number(document.querySelector('input[name="len"]:checked').value),
      gender: document.querySelector('input[name="gender"]:checked').value,
      script: document.querySelector('input[name="script"]:checked').value,
      simil,
      mustChar,
      cho1,
      cho2,
      parents,
      exclude: shown,
    };
  }

  function run(opts, isAgain) {
    showLoading();
    const wait = reduceMotion ? 200 : 1900 + Math.random() * 500;
    setTimeout(() => {
      const result = buildName(opts);
      hideLoading();

      if (!result) {
        if (isAgain) {
          $("modalNote").textContent = "이 조건으로 더 지어 드릴 이름이 없어요. 조건을 바꿔 보세요.";
          $("againBtn").disabled = true;
          $("modal").hidden = false;
        } else {
          showError("이 조건에 맞는 이름을 찾지 못했어요. 조건을 조금 풀어 주세요.");
        }
        return;
      }

      shown.add(result.full);
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

    shown = new Set();
    opts.exclude = shown;
    lastOpts = opts;
    run(opts, false);
  });

  $("againBtn").addEventListener("click", () => {
    if (!lastOpts) return;
    $("modal").hidden = true;
    run(lastOpts, true);
  });

  /* ── 공유 ─────────────────────────────────── */

  function shareText() {
    if (!current) return "";
    const r = current.result;
    const o = current.opts;
    let t = "별별 작명소에서 지은 이름 ✦ " + r.full;
    if (o.script === "hanja") t += " (" + meaningOf(r.slots) + ")";
    return t;
  }

  if (KAKAO_JS_KEY) {
    const s = document.createElement("script");
    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    s.integrity = "sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4";
    s.crossOrigin = "anonymous";
    s.onload = () => {
      try {
        window.Kakao.init(KAKAO_JS_KEY);
      } catch (_) {}
    };
    document.head.append(s);
  }

  $("shareBtn").addEventListener("click", async () => {
    const text = shareText();
    const url = location.href.split("#")[0];

    if (KAKAO_JS_KEY && window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: "별별 작명소 ✦ " + current.result.full,
            description: current.opts.script === "hanja" ? meaningOf(current.result.slots) : "엄마 아빠 이름으로 지은 아이 이름",
            imageUrl: new URL("assets/og-image.png", location.href).href,
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
        await navigator.share({ title: "별별 작명소", text, url });
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
