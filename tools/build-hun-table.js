/**
 * 한자 훈음 표를 만든다.
 *
 * 부모님이 직접 적어 주신 한자의 뜻을 저희가 알아보기 위한 것이다.
 * 사전(data.js)에는 아이 이름을 짓는 데 쓰는 글자만 담으므로 좁고,
 * 부모님 이름에는 그 밖의 글자가 얼마든지 온다.
 *
 *   npm i --no-save @seyoungsong/hanjadict hanja
 *   node tools/build-hun-table.js > hanja-hun.json
 *
 * 원본 @seyoungsong/hanjadict (MIT) · hanja (MIT).
 * 우리가 받아 주는 범위(CJK 기본 · 확장 A · 호환)만 남긴다.
 *
 * "용 룡(용)" 처럼 두음법칙을 괄호로 적어 둔 것은 "용 룡" 과 "용 용"
 * 둘로 편다. 김대룡 · 박용현 어느 쪽으로 적어 오셔도 알아보아야 한다.
 */

const dict = require("@seyoungsong/hanjadict/data/table.json");
const eum = require("hanja/lib/data/hanjaeum.json");

/* 훈음 사전에 빠진 몇 글자는 손으로 채운다 */
const EXTRA = {
  金: "쇠 금,성씨 김",
  女: "계집 녀,계집 여",
};

const inRange = (ch) => {
  const c = ch.codePointAt(0);
  return (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || (c >= 0xf900 && c <= 0xfaff);
};

/* "믿을 지" 처럼 훈 뒤에 한글 한 글자가 오는 꼴만 받는다 */
const PAIR = /^(.+) ([가-힣])$/;

/** "용 룡(용)" -> ["용 룡", "용 용"] */
function spread(reading) {
  const m = reading.trim().match(/^(.+?)\s+([가-힣])\(([가-힣])\)$/);
  if (m) return [m[1] + " " + m[2], m[1] + " " + m[3]];
  return [reading.trim()];
}

const out = {};
let dropped = 0;

for (const ch of new Set([...Object.keys(dict), ...Object.keys(eum), ...Object.keys(EXTRA)])) {
  if ([...ch].length !== 1 || !inRange(ch)) continue;
  const raw = EXTRA[ch] || dict[ch];
  if (!raw) {
    dropped++; // 음만 알고 뜻은 모르는 글자. 뜻을 지어내느니 담지 않는다.
    continue;
  }
  const reads = [];
  for (const part of String(raw).split(",")) {
    for (const r of spread(part)) {
      if (PAIR.test(r) && !reads.includes(r)) reads.push(r);
    }
  }
  if (!reads.length) {
    dropped++;
    continue;
  }
  out[ch] = reads.join(",");
}

/* 글자 차례로 담아 두면 파일이 조금이나마 덜 흩어진다 */
const sorted = {};
for (const ch of Object.keys(out).sort()) sorted[ch] = out[ch];

process.stderr.write("담은 한자 " + Object.keys(sorted).length + "자, 뜻을 몰라 뺀 것 " + dropped + "자\n");
process.stdout.write(JSON.stringify(sorted));
