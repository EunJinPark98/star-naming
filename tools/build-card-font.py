"""
별별 작명소 결과 카드용 폰트를 만든다.

한글은 사이트와 같은 Gowun Batang, 한자는 Noto Serif KR 에서 필요한 글자만
뽑아 한 파일로 합친다. 둘 다 glyf 형식에 unitsPerEm 이 1000 이라 그대로 붙는다.
"""
import glob, json, os, re, shutil, sys, tempfile
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
from fontTools.merge import Merger

OUT = sys.argv[1] if len(sys.argv) > 1 else "byeol-card.ttf"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(ROOT, "data.js")
HUN_JSON = os.path.join(ROOT, "hanja-hun.json")
GOWUN = "node_modules/@fontsource/gowun-batang/files/gowun-batang-korean-700-normal.woff2"
NOTO = sorted(glob.glob("node_modules/@fontsource/noto-serif-kr/files/*700-normal.woff2"))

# 앱 사전에 쓰인 한자에, 부모님이 적어 주실 수 있는 한자까지 담는다.
# 물려받은 글자도 카드에 오르는데, 그 글자는 사전 밖일 수 있다.
# (없는 글자는 카드가 한자 줄을 접으니 두부는 안 나지만, 되도록 보여 드린다)
hanja = {h for h in re.findall(r'c: "([^"]+)"', open(DATA_JS, encoding="utf-8").read()) if h.strip()}
hanja = {ch for h in hanja for ch in h}
dict_hanja = set(hanja)
try:
    hun = json.load(open(HUN_JSON, encoding="utf-8"))
    hanja |= set(hun.keys())
    print("훈음 표까지 합쳐 바라는 한자 %d자 (있는 만큼만 담긴다)" % len(hanja))
except FileNotFoundError:
    print("훈음 표가 없어 사전의 한자만 담는다")

# 한글은 성·이름을 이용자가 직접 적으므로 음절 전체를 담는다
hangul = {chr(c) for c in range(0xAC00, 0xD7A4)}
latin = set(" !\"'(),-./0123456789:;?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz·—…")

def subset_to(path, keep, out):
    font = TTFont(path, fontNumber=0)
    have = set()
    for t in font["cmap"].tables:
        have |= set(t.cmap.keys())
    want = {ord(c) for c in keep} & have
    if not want:
        return None
    opts = Options()
    opts.drop_tables += ["DSIG"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    s = Subsetter(options=opts)
    s.populate(unicodes=want)
    s.subset(font)
    font.flavor = None          # woff2 로 들어와도 순수 ttf 로 뱉는다
    font.save(out)
    font.close()
    return len(want)

tmp = tempfile.mkdtemp()
parts = []

n = subset_to(GOWUN, hangul | latin, os.path.join(tmp, "00-gowun.ttf"))
parts.append(os.path.join(tmp, "00-gowun.ttf"))
print("gowun (한글·라틴): %d자" % n)

taken = set()
total = 0
for i, p in enumerate(NOTO):
    want = hanja - taken
    if not want:
        break
    out = os.path.join(tmp, "%02d-noto.ttf" % (i + 1))
    got = subset_to(p, want, out)
    if got:
        f = TTFont(out)
        got_chars = set()
        for t in f["cmap"].tables:
            got_chars |= {chr(c) for c in t.cmap.keys()}
        f.close()
        taken |= got_chars & hanja
        total += got
        parts.append(out)
print("noto (한자): %d자 / 필요 %d자, 파일 %d개" % (len(taken), len(hanja), len(parts) - 1))

missing = hanja - taken
if missing:
    show = "".join(sorted(missing)[:40])
    print("Noto 에 없어 못 담은 한자 %d자 (앞 40자: %s)" % (len(missing), show))
    dict_missing = missing & dict_hanja
    if dict_missing:
        print("!! 그중 사전(data.js)에 담긴 글자:", "".join(sorted(dict_missing)))

merger = Merger()
merged = merger.merge(parts)
merged["name"].setName("Byeol Card", 1, 3, 1, 0x409)
merged["name"].setName("Byeol Card", 4, 3, 1, 0x409)
merged["name"].setName("ByeolCard-Regular", 6, 3, 1, 0x409)
merged.flavor = "woff2"   # 함수에 딸려 보내는 파일이라 눌러서 담는다
merged.save(OUT)

# 어떤 한자를 그릴 수 있는지 함께 적어 둔다.
# 이용자가 직접 적은 한자는 사전에 없을 수 있고, 없는 글자를 그리면 두부(□)가
# 되므로, 카드 쪽에서 미리 살펴보고 한자 줄을 통째로 접을 수 있게 한다.
cov = set()
for t in merged["cmap"].tables:
    cov |= set(t.cmap.keys())
cjk = "".join(chr(c) for c in sorted(cov) if c > 0x2E7F and not (0xAC00 <= c <= 0xD7A3))
glyph_file = os.path.splitext(OUT)[0] + "-glyphs.txt"
open(glyph_file, "w", encoding="utf-8").write(cjk)
print("=> %s  %d자" % (glyph_file, len(cjk)))

merged.close()
shutil.rmtree(tmp, ignore_errors=True)
print("=> %s  %.0f KB" % (OUT, os.path.getsize(OUT) / 1024))
