// 위싱웰 리플렛: 구글 시트(CSV) → 텍스트·박스·메모가 들어간 4칸 병풍 IDML.
// 그리드는 툴의 '아코디언 4칸' 프리셋과 같다.
//   node scripts/wishingwell-leaflet.js <시트.csv | CSV 주소> <저장할 폴더>
const fs = require('fs');
const path = require('path');

global.window = {};
require('../template.js');
require('../idml.js');

const SHEET = 'https://docs.google.com/spreadsheets/d/1BvsjvekSh2Xb9tr_GqwmC-JRPdD2DX6Fvo2MQaUhN3o/export?format=csv';

// app.js 의 ACC_4 와 같게
const GRID = {
  mode: 'accordion', facing: false,
  width: 110, height: 180, bleed: 3,
  margin: { top: 10, bottom: 12, left: 8, right: 8 },
  cols: 2, colGutter: 4,
  rows: 4, rowGutter: 4,
  baseline: { on: true, division: 12, unit: 'pt', start: 0, relative: 'margin' },
  panels: 4, bothSides: true, perforation: 4,
  fileName: 'wishingwell_leaflet_110x180_4panel',
};

const FONT = 'Apple SD Gothic Neo';
const STYLES = [
  { name: 'Title', size: 14, leading: 18, font: FONT },
  { name: 'Body', size: 8.5, leading: 12, font: FONT, alignToBaseline: true },
  { name: 'Label', size: 7, leading: 9, font: FONT },
];
const LAYERS = [
  { name: 'notes', printable: false, color: 'Magenta' },
  { name: 'boxes', below: true, color: 'Green' },
];

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const lines = (s) => s.replace(/\r/g, '').split('\n');
const NO_TEXT = '(텍스트 없음)';

function layout(rows) {
  // 열: 면 / 칸 / 역할 / 제목 / 본문 / 할 것·그래픽 / 뒷면과의 짝
  const panels = rows.slice(1).filter((r) => r[0] === '펼쳐 보는 면' || r[0] === '바깥 면')
    .map(([side, slot, role, title, body, todo]) => ({ side, slot, role, title: title.trim(), body: body.trim(), todo: todo.trim() }));
  const find = (side, role) => {
    const p = panels.find((x) => x.side === side && x.role === role);
    if (!p) throw new Error('시트에 없음: ' + side + ' · ' + role);
    return p;
  };

  const { margin, width: W, height: H } = GRID;
  const X = margin.left, Y = margin.top, CW = W - margin.left - margin.right, CH = H - margin.top - margin.bottom, BOTTOM = Y + CH;
  const items = [];
  const titleParas = (p) => (p.title === NO_TEXT ? [] : lines(p.title).map((text) => ({ style: 'Title', text })));
  const bodyParas = (p) => (p.body === NO_TEXT ? [] : lines(p.body).map((text) => ({ style: 'Body', text })));
  const text = (page, x, y, w, h, paragraphs) => { if (paragraphs.length) items.push({ type: 'text', page, x, y, w, h, paragraphs }); };
  const box = (page, x, y, w, h, name) => items.push({ type: 'rect', page, x, y, w, h, layer: 'boxes', name });
  const note = (page, s) => {
    if (!s) return;
    // 아래 여백 띠에 작은 메모
    items.push({ type: 'text', page, x: X, y: BOTTOM + 1.5, w: CW, h: H - BOTTOM - 3, layer: 'notes',
      paragraphs: lines(s).map((t) => ({ style: 'Label', text: t, color: 'Color/Magenta' })) });
  };

  // ── 스프레드 1: 펼쳐 보는 면 (1–4쪽) ──
  const intro = find('펼쳐 보는 면', '소개·정보');
  text(1, X, Y, CW, CH, [...titleParas(intro), ...bodyParas(intro)]);
  note(1, intro.todo);

  // 돌 탁본: 위 안내문, 아래 94×110 박스(하단 정렬)
  const rub = find('펼쳐 보는 면', '돌 탁본');
  const rubBox = 110;
  text(2, X, Y, CW, CH - rubBox - 4, [...titleParas(rub), ...bodyParas(rub)]);
  box(2, X, BOTTOM - rubBox, CW, rubBox, '탁본');
  note(2, rub.todo);

  // 쓰는 칸: 제목, 94×70 박스 두 개. 본문의 '위 칸: …' '아래 칸: …' 이 각 박스의 질문
  const write = find('펼쳐 보는 면', '쓰는 칸');
  const qs = lines(write.body).map((l) => l.replace(/^(위|아래)\s*칸\s*:\s*/, '').trim()).filter(Boolean);
  const wBox = 70, gap = 4;
  text(3, X, Y, CW, CH - 2 * wBox - gap, titleParas(write));
  [BOTTOM - 2 * wBox - gap, BOTTOM - wBox].forEach((by, i) => {
    box(3, X, by, CW, wBox, '쓰는 칸 ' + (i + 1));
    if (qs[i]) text(3, X + 3, by + 3, CW - 6, 5, [{ style: 'Label', text: qs[i] }]);
  });
  note(3, write.todo);

  // 소원 카드: I WISH ( ) 아래 94×80 박스, 그 아래 안내문
  const wish = find('펼쳐 보는 면', '소원 카드');
  const titleH = 8, cardBox = 80;
  text(4, X, Y, CW, titleH, titleParas(wish));
  box(4, X, Y + titleH + 4, CW, cardBox, '소원');
  const bodyY = Y + titleH + 4 + cardBox + 4;
  text(4, X, bodyY, CW, BOTTOM - bodyY, bodyParas(wish));
  note(4, wish.todo);

  // ── 스프레드 2: 바깥 면 (5–8쪽) — 카드 뒷면 | 지도 | 지도 | 표지 ──
  const back = find('바깥 면', '카드 뒷면');
  // 제목이 (텍스트 없음) → 텍스트 프레임 없음. 본문 칸의 그림 지시는 메모로
  note(5, [back.body, back.todo].filter(Boolean).join('\n'));

  const map = find('바깥 면', '산길 지도');
  text(6, X, Y, CW, 36.5, [...titleParas(map), ...bodyParas(map)]);   // 첫 행
  note(6, map.todo);
  // 스탬프 칸 4곳: 왼쪽 아래 출발 → 오른쪽 위 정상. 이름은 본문 첫 줄에서
  const stops = lines(map.body)[0].split('·').map((s) => s.trim());
  const D = 18;
  [[6, 30, 140], [6, 80, 88], [7, 30, 122], [7, 80, 46]].forEach(([page, cx, cy], i) => {
    items.push({ type: 'oval', page, x: cx - D / 2, y: cy - D / 2, w: D, h: D, layer: 'boxes', name: '스탬프 ' + (i + 1) });
    if (stops[i]) text(page, cx - 20, cy + D / 2 + 2, 40, 5, [{ style: 'Label', text: stops[i], justify: 'CenterAlign' }]);
  });

  const cover = find('바깥 면', '표지');
  text(8, X, Y, CW, CH, [...titleParas(cover), ...bodyParas(cover)]);
  note(8, cover.todo);

  return { paragraphStyles: STYLES, layers: LAYERS, items };
}

async function main() {
  const [src = SHEET, outDir = '.'] = process.argv.slice(2);
  const csv = /^https?:/.test(src) ? await (await fetch(src)).text() : fs.readFileSync(src, 'utf8');
  const blob = window.GridIdml.build({ ...GRID, content: layout(parseCsv(csv)) });
  const out = path.join(outDir, GRID.fileName + '.idml');
  fs.writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
  console.log(out);
}

main().catch((e) => { console.error(e); process.exit(1); });
