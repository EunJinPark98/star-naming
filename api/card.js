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
const HANGUL = /^[가-힣]{1,8}$/;
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
  if (o.pure) rows.push({ kind: "badge", h: 52 });
  rows.push({ kind: "name", h: 132, gap: o.pure ? 44 : 0 });
  if (o.hanja && hanjaOk) rows.push({ kind: "hanja", text: o.hanja, h: 54, gap: 46 });
  if (o.readings.length && hanjaOk) {
    rows.push({ kind: "chars", text: o.readings.join("   ·   "), h: 32, gap: 38 });
  }
  if (o.meaning) {
    /* 순우리말은 이름 아래에 한자 줄과 뜻풀이가 없어 허전하니 더 띄운다.
       140 은 그렇게 띄우면서도 뜻이 한자 카드와 같은 높이(769.5)에 오도록
       맞춘 값이다. 위 줄들의 높이를 바꾸면 이 값도 다시 맞춰야 한다. */
    rows.push({ kind: "rule", h: 1, gap: o.pure ? 140 : 66 });
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
