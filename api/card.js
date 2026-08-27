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
const W = 1080;
const H = 1080;

/* 글꼴은 찬 곳에서 한 번만 읽는다 */
const FONT_FILE = "byeol-card.woff2";
let fontReady = false;
let fontFrom = "";

function fontCandidates() {
  return [
    path.join(__dirname, "fonts", FONT_FILE),
    path.join(process.cwd(), "api/fonts", FONT_FILE),
    path.join(process.cwd(), "fonts", FONT_FILE),
    path.join("/var/task/api/fonts", FONT_FILE),
  ];
}

function loadFont() {
  if (fontReady) return true;
  for (const file of fontCandidates()) {
    try {
      if (fs.existsSync(file)) {
        GlobalFonts.register(fs.readFileSync(file), FONT);
        fontReady = true;
        fontFrom = file;
        return true;
      }
    } catch (e) {
      console.error("[card] 글꼴을 읽지 못했습니다:", file, e.message);
    }
  }
  console.error("[card] 글꼴을 찾지 못했습니다. 찾아본 곳:", fontCandidates().join(", "));
  return false;
}

/* ── 들어온 값 살피기 ────────────────────────────
 *
 * 이 주소는 누구나 부를 수 있다. 아무 글이나 그려 주면 우리 이름표가 박힌
 * 그림으로 엉뚱한 말을 퍼뜨릴 수 있으니, 이름은 한글, 한자는 한자,
 * 뜻은 한글과 몇몇 문장부호까지만 받고 길이도 잘라 둔다.
 */
const HANGUL = /^[가-힣]{1,8}$/;
const HANJA = /^[一-鿿㐀-䶿豈-﫿]{1,8}$/;
const MEANING = /^[가-힣0-9 ,.·()]{1,40}$/;
const READING = /^[가-힣 ]{1,14}[一-鿿㐀-䶿豈-﫿]$/;

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
    pure: query.p === "1",
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
  ctx.font = '400 32px "' + FONT + '"';
  ctx.fillStyle = "rgba(245,197,66,0.9)";
  ctx.fillText(head, W / 2, 128);
  const hw = ctx.measureText(head).width;
  drawSpark(ctx, W / 2 - hw / 2 - 34, 145, 11);
  drawSpark(ctx, W / 2 + hw / 2 + 34, 145, 11);

  /* 담을 줄을 먼저 모아 두고 가운데에 놓는다 */
  const rows = [];
  if (o.pure) rows.push({ kind: "badge", h: 52 });
  rows.push({ kind: "name", h: 132, gap: o.pure ? 44 : 0 });
  if (o.hanja) rows.push({ kind: "hanja", text: o.hanja, h: 54, gap: 46 });
  if (o.readings.length) {
    rows.push({ kind: "chars", text: o.readings.join("   ·   "), h: 32, gap: 38 });
  }
  if (o.meaning) {
    /* 순우리말은 이름 아래에 한자 줄과 뜻풀이가 없어 허전하니 더 띄운다.
       140 은 그렇게 띄우면서도 뜻이 한자 카드와 같은 높이(769.5)에 오도록
       맞춘 값이다. 위 줄들의 높이를 바꾸면 이 값도 다시 맞춰야 한다. */
    rows.push({ kind: "rule", h: 1, gap: o.pure ? 140 : 66 });
    ctx.font = '700 46px "' + FONT + '"';
    wrapLines(ctx, o.meaning, W - 220).forEach((line, i) => {
      rows.push({ kind: "meaning", text: line, h: 46, gap: i === 0 ? 66 : 26 });
    });
  }

  const total = rows.reduce((sum, row) => sum + (row.gap || 0) + row.h, 0);
  let y = (250 + 900) / 2 - total / 2;

  for (const row of rows) {
    y += row.gap || 0;
    if (row.kind === "badge") {
      ctx.font = '400 28px "' + FONT + '"';
      const pw = ctx.measureText("순우리말").width + 56;
      const px = (W - pw) / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, y, pw, row.h, 26);
      else ctx.rect(px, y, pw, row.h);
      ctx.strokeStyle = "rgba(245,197,66,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#f5c542";
      ctx.fillText("순우리말", W / 2, y + 11);
    } else if (row.kind === "name") {
      const grad = ctx.createLinearGradient(0, y, 0, y + row.h);
      grad.addColorStop(0, "#ffe9a8");
      grad.addColorStop(1, "#d9a215");
      ctx.font = '700 132px "' + FONT + '"';
      ctx.fillStyle = grad;
      ctx.fillText(o.name, W / 2, y);
    } else if (row.kind === "hanja") {
      ctx.font = '700 54px "' + FONT + '"';
      ctx.fillStyle = "#9aa1b0";
      ctx.fillText(row.text, W / 2, y);
    } else if (row.kind === "chars") {
      ctx.font = '400 32px "' + FONT + '"';
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
      ctx.font = '700 46px "' + FONT + '"';
      ctx.fillStyle = "#ffe9a8";
      ctx.fillText(row.text, W / 2, y);
    }
    y += row.h;
  }

  ctx.font = '400 28px "' + FONT + '"';
  ctx.fillStyle = "rgba(154,161,176,0.75)";
  ctx.fillText("naming.byeolmamapapa.com", W / 2, H - 96);

  return c.toBuffer("image/png");
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

  /* 어디서 걸렸는지 눈으로 보려고 둔 자리. 비밀은 담지 않는다. */
  if (query.debug) {
    const found = loadFont();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).end(
      JSON.stringify(
        {
          ok: found,
          node: process.version,
          fontLoadedFrom: fontFrom || null,
          triedPaths: fontCandidates().map((p) => ({ path: p, exists: fs.existsSync(p) })),
          cwd: process.cwd(),
          dirname: __dirname,
          sawQuery: query,
        },
        null,
        2
      )
    );
    return;
  }


  /* 이 자리가 살아 있는지만 묻는 것. 그림은 그리지 않는다.
     (정적 서버로 띄워 보는 경우처럼 여기가 없을 수 있어서, 쪽에서 먼저
      물어보고 대답이 없으면 붙박이 대문 그림으로 돌아간다) */
  if (query.ping) {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(204).end();
    return;
  }

  if (!loadFont()) {
    res.status(500).json({ error: "font not available" });
    return;
  }

  const opts = readParams(query);
  if (!opts) {
    res.status(400).json({ error: "bad or missing name" });
    return;
  }

  try {
    const png = drawCard(opts);
    /* 같은 이름이면 같은 그림이라 오래 담아 두어도 된다 */
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Length", png.length);
    res.status(200).end(png);
  } catch (e) {
    console.error("[card] 그리지 못했습니다:", e);
    res.status(500).json({ error: "render failed" });
  }
};
