/**
 * 결과 카드 이미지를 그려 주는 곳.
 *
 * 카카오톡 공유 카드에 들어갈 그림은 카카오 서버가 가져갈 수 있는 주소라야 해서,
 * 브라우저에서 만든 그림을 그대로 얹을 수가 없다. 그래서 이름·한자·뜻을 물음표
 * 뒤에 실어 보내면 여기서 같은 그림을 그려 돌려준다.
 *
 *   /api/card?n=김도선&h=道善&r=도리 도 道,착함 선 善&m=올곧고 착한 아이
 *
 * 글꼴은 한글(고운바탕)과 이 사전에 쓰인 한자를 한 파일에 담아 둔 것을 쓴다.
 * (tools/build-card-font.py 로 만든다)
 */

const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const FONT = "ByeolCard";
/* 뒤에 세우는 글꼴. 한국어에 쓰는 한자만 담은 앞 글꼴에 없는 글자
   (忯 · 㴗 처럼 부모님 이름에나 나오는 것)를 여기서 찾는다.
   본디 같은 글꼴이라(Noto Serif CJK KR = Source Han Serif K) 티가 안 난다. */
const FONT_TAIL = "ByeolCardTail";
const FONTS = '"' + FONT + '", "' + FONT_TAIL + '"';
const W = 1080;
const H = 1080;

/* 글꼴은 찬 곳에서 한 번만 읽는다 */
const FONT_FILE = "byeol-card.woff2";
const TAIL_FILE = "byeol-card-tail.woff2";
const GLYPH_FILE = "byeol-card-glyphs.txt";
let fontReady = false;

/* 이 글꼴로 그릴 수 있는 한자. tools/build-card-font.py 가 함께 적어 둔다.
   이용자가 직접 적은 한자는 여기에 없을 수 있는데, 없는 글자를 그리면
   두부(□)가 되므로 미리 살펴보고 한자 줄을 통째로 접는다. */
let drawable = null;

function fontCandidates(name) {
  return [
    path.join(__dirname, "fonts", name),
    path.join(process.cwd(), "api/fonts", name),
    path.join(process.cwd(), "fonts", name),
    path.join("/var/task/api/fonts", name),
  ];
}

function loadFont() {
  if (fontReady) return true;
  for (const file of fontCandidates(FONT_FILE)) {
    try {
      if (fs.existsSync(file)) {
        GlobalFonts.register(fs.readFileSync(file), FONT);
        fontReady = true;
        /* 어느 자리에서 읽었는지는 배포 로그에만 남긴다 */
        console.log("[card] 글꼴을 읽었습니다:", file);
        break;
      }
    } catch (e) {
      console.error("[card] 글꼴을 읽지 못했습니다:", file, e.message);
    }
  }
  if (!fontReady) {
    console.error("[card] 글꼴을 찾지 못했습니다. 찾아본 곳:", fontCandidates(FONT_FILE).join(", "));
    return false;
  }
  /* 꼬리 글꼴은 없어도 굴러간다. 그 글자만 못 그릴 뿐이다. */
  for (const file of fontCandidates(TAIL_FILE)) {
    try {
      if (fs.existsSync(file)) {
        GlobalFonts.register(fs.readFileSync(file), FONT_TAIL);
        console.log("[card] 꼬리 글꼴을 읽었습니다:", file);
        break;
      }
    } catch (e) {
      console.error("[card] 꼬리 글꼴을 읽지 못했습니다:", file, e.message);
    }
  }
  if (!drawable) {
    for (const file of fontCandidates(GLYPH_FILE)) {
      try {
        if (fs.existsSync(file)) {
          drawable = new Set(fs.readFileSync(file, "utf-8").trim());
          break;
        }
      } catch (e) {
        console.error("[card] 글자 목록을 읽지 못했습니다:", file, e.message);
      }
    }
    if (!drawable) {
      /* 목록이 없으면 한자를 못 그린다고 보지 않고 그냥 그린다 */
      console.error("[card] 글자 목록을 찾지 못했습니다. 한자를 그대로 그립니다.");
      drawable = new Set();
    }
  }
  return true;
}

/** 이 글의 한자를 다 그릴 수 있는가. 한글과 문장부호는 언제나 그릴 수 있다. */
const CJK_ONE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
function canDraw(text) {
  if (!drawable || !drawable.size) return true;
  for (const ch of text) if (CJK_ONE.test(ch) && !drawable.has(ch)) return false;
  return true;
}

/* ── 들어온 값 살피기 ────────────────────────────
 *
 * 이 주소는 누구나 부를 수 있다. 아무 글이나 그려 주면 우리 이름표가 박힌
 * 그림으로 엉뚱한 말을 퍼뜨릴 수 있으니, 이름은 한글, 한자는 한자,
 * 뜻은 한글과 몇몇 문장부호까지만 받고 길이도 잘라 둔다.
 */
/* 한자 범위는 글자로 적으면 豈(U+F900)처럼 겉모습이 같은 다른 글자를 잘못
   집어 범위가 한글까지 삼킬 수 있어, 번호로 적는다 */
/* 성은 한 자 아니면 두 자(남궁·황보 …), 이름은 세 자까지라 다섯 자를 넘을 수
   없다. 좁게 잡아 두면 장난으로 부른 주소가 그림을 그리기 전에 걸린다. */
const HANGUL = /^[가-힣]{1,5}$/;
const HANJA = /^[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]{1,8}$/;
const MEANING = /^[가-힣0-9 ,.·()]{1,40}$/;
const READING = /^[가-힣 ]{1,14}[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]$/;

const clean = (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

function readParams(query) {
  const name = clean(query.n);
  if (!HANGUL.test(name)) return null;

  const hanja = clean(query.h);
  const meaning = clean(query.m);
  const readings = clean(query.r)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => READING.test(s))
    .slice(0, 3);

  return {
    name,
    hanja: HANJA.test(hanja) ? hanja : "",
    meaning: MEANING.test(meaning) ? meaning : "",
    readings,
    /* 한자가 없는 이름에 얹는 딱지. app.js 가 p=1 로 보낸다.
       2 는 갈래를 순우리말·소리 이름 둘로 두던 때 쓰던 값이라, 그때 나간
       카드 주소가 아직 어딘가에 남아 있을 수 있어 같이 받아 준다. */
    badge: query.p === "1" || query.p === "2" ? "한글 이름" : "",
  };
}

/* ── 그리기 ─────────────────────────────────── */

/** 이름이 같으면 별자리도 같도록, 씨앗을 두고 뽑는다 */
function seeded(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawStars(ctx, rand, n) {
  for (let i = 0; i < n; i++) {
    const x = rand() * W;
    const y = rand() * H;
    ctx.beginPath();
    ctx.arc(x, y, rand() * 1.8 + 0.6, 0, Math.PI * 2);
    ctx.fillStyle =
      rand() < 0.3
        ? "rgba(245,197,66," + (rand() * 0.5 + 0.2).toFixed(2) + ")"
        : "rgba(255,255,255," + (rand() * 0.4 + 0.15).toFixed(2) + ")";
    ctx.fill();
  }
}

/** ✦ 는 글꼴에 없는 글자라 도형으로 그린다 */
function drawSpark(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx - r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.fill();
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCard(o) {
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  const rand = seeded(o.name + o.hanja);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0c16");
  bg.addColorStop(1, "#05060c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.2, 0, W / 2, H * 0.2, W * 0.62);
  glow.addColorStop(0, "rgba(245,197,66,0.17)");
  glow.addColorStop(1, "rgba(245,197,66,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  drawStars(ctx, rand, 110);

  ctx.strokeStyle = "rgba(245,197,66,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  /* 머리말 */
  const head = "별 별  작 명 소";
  ctx.font = "400 32px " + FONTS;
  ctx.fillStyle = "rgba(245,197,66,0.9)";
  ctx.fillText(head, W / 2, 128);
  const hw = ctx.measureText(head).width;
  drawSpark(ctx, W / 2 - hw / 2 - 34, 145, 11);
  drawSpark(ctx, W / 2 + hw / 2 + 34, 145, 11);

  /* 담을 줄을 먼저 모아 두고 가운데에 놓는다.
     그릴 수 없는 한자가 섞였으면 한자 줄과 뜻 줄을 함께 접는다.
     한 글자만 빼면 이름이 잘못 적힌 것처럼 보이기 때문이다. */
  const hanjaOk = canDraw(o.hanja + o.readings.join(""));
  const rows = [];
  if (o.badge) rows.push({ kind: "badge", h: 52 });
  rows.push({ kind: "name", h: 132, gap: o.badge ? 44 : 0 });
  if (o.hanja && hanjaOk) rows.push({ kind: "hanja", text: o.hanja, h: 54, gap: 46 });
  if (o.readings.length && hanjaOk) {
    rows.push({ kind: "chars", text: o.readings.join("   ·   "), h: 32, gap: 38 });
  }
  if (o.meaning) {
    /* 한자가 없는 이름은 이름 아래에 한자 줄과 뜻풀이가 없어 허전하니 더 띄운다.
       140 은 그렇게 띄우면서도 뜻이 한자 카드와 같은 높이(769.5)에 오도록
       맞춘 값이다. 위 줄들의 높이를 바꾸면 이 값도 다시 맞춰야 한다. */
    rows.push({ kind: "rule", h: 1, gap: o.badge ? 140 : 66 });
    ctx.font = "700 46px " + FONTS;
    wrapLines(ctx, o.meaning, W - 220).forEach((line, i) => {
      rows.push({ kind: "meaning", text: line, h: 46, gap: i === 0 ? 66 : 26 });
    });
  }

  const total = rows.reduce((sum, row) => sum + (row.gap || 0) + row.h, 0);
  let y = (250 + 900) / 2 - total / 2;

  for (const row of rows) {
    y += row.gap || 0;
    if (row.kind === "badge") {
      ctx.font = "400 28px " + FONTS;
      const pw = ctx.measureText(o.badge).width + 56;
      const px = (W - pw) / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, y, pw, row.h, 26);
      else ctx.rect(px, y, pw, row.h);
      ctx.strokeStyle = "rgba(245,197,66,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#f5c542";
      ctx.fillText(o.badge, W / 2, y + 11);
    } else if (row.kind === "name") {
      const grad = ctx.createLinearGradient(0, y, 0, y + row.h);
      grad.addColorStop(0, "#ffe9a8");
      grad.addColorStop(1, "#d9a215");
      ctx.font = "700 132px " + FONTS;
      ctx.fillStyle = grad;
      ctx.fillText(o.name, W / 2, y);
    } else if (row.kind === "hanja") {
      ctx.font = "700 54px " + FONTS;
      ctx.fillStyle = "#9aa1b0";
      ctx.fillText(row.text, W / 2, y);
    } else if (row.kind === "chars") {
      ctx.font = "400 32px " + FONTS;
      ctx.fillStyle = "#6e7484";
      ctx.fillText(row.text, W / 2, y);
    } else if (row.kind === "rule") {
      ctx.beginPath();
      ctx.moveTo(W / 2 - 190, y);
      ctx.lineTo(W / 2 + 190, y);
      ctx.strokeStyle = "rgba(245,197,66,0.24)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (row.kind === "meaning") {
      ctx.font = "700 46px " + FONTS;
      ctx.fillStyle = "#ffe9a8";
      ctx.fillText(row.text, W / 2, y);
    }
    y += row.h;
  }

  ctx.font = "400 28px " + FONTS;
  ctx.fillStyle = "rgba(154,161,176,0.75)";
  ctx.fillText("naming.byeolmamapapa.com", W / 2, H - 96);

  return c.toBuffer("image/png");
}

/* ── 문지기 ──────────────────────────────────────
 *
 * 이 자리는 부를 때마다 1080×1080 그림을 새로 그린다. 한 장에 90ms 남짓이라
 * 주소만 바꿔 가며 몰아치면 그대로 함수 실행 시간이 되고, 그게 곧 요금이다.
 * 그래서 세 겹으로 둔다.
 *
 *   1. 그린 그림 잠깐 쟁이기 — 같은 주소면 붓을 다시 들지 않는다. 카톡이 한
 *      카드를 여러 번 가져가도 그리는 것은 한 번뿐이다. 쟁여 둔 것을 내주는
 *      데는 품이 안 드니 아래 두 겹의 셈에도 넣지 않는다.
 *   2. 부른 곳(IP)별 상한 — 한 곳에서 몰아치는 것을 막는다.
 *   3. 인스턴스 전체 상한 — IP를 바꿔 가며 들어오는 것까지 눌러 두는 빗장.
 *
 * 셋 다 이 인스턴스 안에서만 셈한다. Vercel 이 인스턴스를 여럿 띄우면 셈도
 * 갈리므로, 작정하고 흩어서 때리는 것까지 여기서 막지는 못한다. 그건 Vercel
 * 쪽 방화벽이 할 일이고 이것은 그 안쪽 겹이다.
 */

const WINDOW = 60000;
const CAP_IP = 60;        /* 사람이 손으로 공유하는 것은 잘해야 몇 번이다 */
const CAP_IP_BOT = 300;   /* 카톡·페북이 한 IP 로 여럿을 몰아 가져가는 일이 있다 */
const CAP_ALL = 400;      /* 한 인스턴스가 쉬지 않고 그려도 분당 688장이 한계다 */
const CAP_TABLE = 4096;   /* IP 표가 한없이 불어나지 않게 */

/* 미리보기를 만들러 오는 것들. 흉내 낼 수 있는 값이지만 흉내 내 봐야 상한이
   조금 높아질 뿐이고, 전체 상한은 그대로라 새는 구멍이 되지 않는다. */
const BOT = /kakao|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp|googlebot|bingbot|yeti|daumoa|crawler|spider|bot[/ ]/i;

const hits = new Map();   /* IP → 그린 때(ms) 목록 */
let allHits = [];         /* 인스턴스 전체가 그린 때 */

/** 창 밖으로 나간 것을 떨군다 */
function recent(list, now) {
  let i = 0;
  while (i < list.length && now - list[i] >= WINDOW) i++;
  return i ? list.slice(i) : list;
}

function clientIp(req) {
  const h = req.headers || {};
  const fwd = h["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return h["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "?";
}

/** 지금 그려 줘도 되나 */
function overQuota(req, now) {
  allHits = recent(allHits, now);
  if (allHits.length >= CAP_ALL) return true;

  const ip = clientIp(req);
  const list = recent(hits.get(ip) || [], now);
  if (list.length) hits.set(ip, list);
  else hits.delete(ip);

  const ua = (req.headers && req.headers["user-agent"]) || "";
  const cap = BOT.test(ua) ? CAP_IP_BOT : CAP_IP;
  return list.length >= cap;
}

/** 한 장 그렸다고 셈에 적는다 */
function tally(req, now) {
  allHits.push(now);
  const ip = clientIp(req);
  const list = hits.get(ip);
  if (list) list.push(now);
  else hits.set(ip, [now]);

  if (hits.size > CAP_TABLE) {
    for (const [k, v] of hits) if (now - v[v.length - 1] >= WINDOW) hits.delete(k);
    /* 그래도 넘치면 들어온 지 오래된 것부터 버린다 */
    for (const k of hits.keys()) {
      if (hits.size <= CAP_TABLE) break;
      hits.delete(k);
    }
  }
}

/* ── 그린 그림 쟁여 두기 ────────────────────────
   한 장이 100KB 남짓이라 스물넷이면 3MB 안쪽이다. */
const MEMO_MAX = 24;
const memo = new Map();

const memoKey = (o) =>
  [o.name, o.hanja, o.meaning, o.badge, o.readings.join(",")].join("|");

function memoGet(key) {
  const png = memo.get(key);
  if (!png) return null;
  /* 방금 쓴 것을 뒤로 옮겨 둔다. 앞에 있는 것부터 버리므로 */
  memo.delete(key);
  memo.set(key, png);
  return png;
}

function memoPut(key, png) {
  memo.set(key, png);
  while (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value);
}

function sendPng(res, png) {
  res.setHeader("Content-Type", "image/png");
  /* 같은 이름이면 같은 그림이라 오래 담아 두어도 된다. s-maxage 는 Vercel
     앞단더러 쥐고 있으라는 뜻이라, 같은 주소를 다시 부르면 여기까지 오지도
     않는다. 실은 이 한 줄이 제일 크게 아낀다. */
  res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  res.setHeader("Content-Length", png.length);
  res.status(200).end(png);
}

module.exports = (req, res) => {
  /* req.query 는 Vercel 이 채워 주지만, 없으면 주소에서 직접 읽는다 */
  let query = req.query;
  if (!query) {
    try {
      query = Object.fromEntries(
        new URL(req.url, "http://x").searchParams
      );
    } catch (_) {
      query = {};
    }
  }

  /* 이 자리가 살아 있는지만 묻는 것. 그림은 그리지 않는다.
     (정적 서버로 띄워 보는 경우처럼 여기가 없을 수 있어서, 쪽에서 먼저
      물어보고 대답이 없으면 붙박이 대문 그림으로 돌아간다) */
  if (query.ping) {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(204).end();
    return;
  }

  /* 값을 먼저 살핀다. 글꼴을 읽기 전에 걸러야 장난으로 부른 주소가 공짜로
     튕겨 나간다. */
  const opts = readParams(query);
  if (!opts) {
    res.status(400).json({ error: "bad or missing name" });
    return;
  }

  /* 아까 그려 둔 것이 있으면 그대로 내준다 — 붓을 들지 않았으니 셈도 안 한다 */
  const key = memoKey(opts);
  const kept = memoGet(key);
  if (kept) {
    sendPng(res, kept);
    return;
  }

  const now = Date.now();
  if (overQuota(req, now)) {
    /* 이 대답은 잠깐 뒤면 달라지므로 어디에도 담아 두면 안 된다 */
    res.setHeader("Retry-After", "60");
    res.setHeader("Cache-Control", "no-store");
    res.status(429).json({ error: "too many requests" });
    return;
  }

  if (!loadFont()) {
    res.status(500).json({ error: "font not available" });
    return;
  }

  /* 그리다 엎어지는 주소를 되풀이해 부르는 것도 품이 드니, 그리기 전에 적는다 */
  tally(req, now);

  try {
    const png = drawCard(opts);
    memoPut(key, png);
    sendPng(res, png);
  } catch (e) {
    console.error("[card] 그리지 못했습니다:", e);
    res.status(500).json({ error: "render failed" });
  }
};
