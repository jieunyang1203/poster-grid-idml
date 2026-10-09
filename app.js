(function () {
  const SIZES_BY_MODE = {
    poster: [
      ['A0', 841, 1189], ['A1', 594, 841], ['A2', 420, 594], ['A3', 297, 420], ['A4', 210, 297], ['A5', 148, 210],
      ['B1', 728, 1030], ['B2', 515, 728], ['B3', 364, 515], ['B4', 257, 364], ['B5', 182, 257],
    ],
    accordion: [],
    book: [
      ['신국판', 152, 225], ['국판', 148, 210], ['46판', 128, 188], ['크라운판', 176, 248],
      ['46배판', 188, 257], ['국배판', 210, 297], ['B6', 128, 182], ['A5', 148, 210], ['B5', 182, 257],
    ],
  };

  const BASE = {
    mode: 'poster', facing: false,
    size: 'A1', width: 594, height: 841, bleed: 3,
    margin: { top: 12, bottom: 12, left: 12, right: 12 }, marginLinked: true,
    cols: 12, colGutter: 12,
    rows: 0, rowGutter: 12, rowGutterLinked: true,
    baseline: { on: true, division: 28, unit: 'pt', start: 0, relative: 'margin' },
    pages: 1,
  };

  // 책: 여백 left = 안쪽, right = 바깥쪽 (인디자인 마주보기와 같음)
  const BOOK_BASE = {
    mode: 'book', facing: true,
    size: '신국판', width: 152, height: 225, bleed: 3,
    margin: { top: 18, bottom: 24, left: 20, right: 16 }, marginLinked: false,
    cols: 6, colGutter: 4,
    rows: 0, rowGutter: 4, rowGutterLinked: true,
    baseline: { on: true, division: 14, unit: 'pt', start: 0, relative: 'margin' },
    pages: 8,
  };
  // 병풍: 면(페이지) N개를 한 스프레드에 가로로. 앞·뒤 스프레드 두 개
  const ACC_BASE = {
    mode: 'accordion', facing: false,
    size: 'custom', width: 100, height: 210, bleed: 3,
    margin: { top: 12, bottom: 15, left: 8, right: 8 }, marginLinked: false,
    cols: 2, colGutter: 4,
    rows: 6, rowGutter: 4, rowGutterLinked: true,
    baseline: { on: true, division: 14, unit: 'pt', start: 0, relative: 'margin' },
    pages: 1, panels: 8, bothSides: true, perforation: 8,
  };
  // 위싱웰 리플렛: 110×180 4칸, 칸 3|4 사이 절취선
  const ACC_4 = {
    ...ACC_BASE,
    width: 110, height: 180,
    margin: { top: 10, bottom: 12, left: 8, right: 8 },
    rows: 4,
    baseline: { on: true, division: 12, unit: 'pt', start: 0, relative: 'margin' },
    panels: 4, perforation: 4,
    fileName: 'wishingwell_leaflet_110x180_4panel',
  };
  const BASES = { poster: BASE, book: BOOK_BASE, accordion: ACC_BASE };

  const BUILTIN = [
    { name: '12단 그리드', builtin: true, s: BASE },
    { name: '격자 그리드', builtin: true, s: { ...BASE, cols: 19, colGutter: 15, baseline: { on: true, division: 15, unit: 'mm', start: 0, relative: 'margin' } } },
    { name: '신국판 6단', builtin: true, s: BOOK_BASE },
    { name: '국판 2단', builtin: true, s: { ...BOOK_BASE, size: '국판', width: 148, height: 210, margin: { top: 17, bottom: 22, left: 18, right: 14 }, cols: 2, colGutter: 6, rowGutter: 6, baseline: { on: true, division: 13, unit: 'pt', start: 0, relative: 'margin' } } },
    { name: '위싱웰 병풍', builtin: true, s: ACC_BASE },
    { name: '아코디언 4칸', builtin: true, s: ACC_4 },
  ];
  const presetMode = (p) => p.s.mode || 'poster';

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  // 모드별로 마지막 설정을 따로 기억한다
  const states = store.get('pg.states', { poster: store.get('pg.state', null) });
  // 예전 버전의 전역 파일 이름은 포스터 설정으로 옮긴다
  const oldName = store.get('pg.fileName', null);
  if (oldName && states.poster && !('fileName' in states.poster)) states.poster.fileName = oldName;
  const startMode = BASES[store.get('pg.mode', 'poster')] ? store.get('pg.mode', 'poster') : 'poster';
  let s = Object.assign(clone(BASES[startMode]), states[startMode] || {});
  const sizes = () => SIZES_BY_MODE[s.mode];
  let view = Object.assign({ margin: true, cols: true, rows: true, baseline: true }, store.get('pg.view', {}));
  let userPresets = store.get('pg.presets', []);

  const PT = 72 / 25.4;
  const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toString();
  const baselineMm = () => (s.baseline.unit === 'pt' ? s.baseline.division / PT : s.baseline.division);
  const isPortrait = () => s.height >= s.width;
  const autoName = () => {
    if (s.mode === 'accordion') return 'wishingwell_accordion_' + s.panels + 'p';
    const size = s.size === 'custom' ? fmt(s.width, 1) + 'x' + fmt(s.height, 1) : s.size;
    return size + '_' + s.cols + '단' + (s.rows > 1 ? '_' + s.rows + '행' : '') + (isPortrait() ? '' : '_가로') + (s.mode === 'book' ? '_' + s.pages + 'p' : '');
  };

  // ── DOM 헬퍼 ──
  const syncers = [];
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null) el.append(c);
    return el;
  };
  const num = (v, fallback) => { const x = parseFloat(v); return Number.isFinite(x) ? x : fallback; };

  function numberField(label, get, set, { unit = 'mm', step = 0.5, min = 0, max = 10000 } = {}) {
    const labelEl = h('span', {}, typeof label === 'function' ? '' : label);
    if (typeof label === 'function') syncers.push(() => { labelEl.textContent = label(); });
    const input = h('input', { type: 'number', step, min, max, inputmode: 'decimal' });
    input.addEventListener('input', () => { if (input.value !== '') { set(Math.min(max, Math.max(min, num(input.value, get())))); update(input); } });
    input.addEventListener('blur', () => { input.value = fmt(get(), 3); });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const d = (e.shiftKey ? 10 : 1) * step * (e.key === 'ArrowUp' ? 1 : -1);
      set(Math.min(max, Math.max(min, Math.round((get() + d) * 1000) / 1000)));
      input.value = fmt(get(), 3);
      update(input);
    });
    syncers.push((active) => { if (active !== input) input.value = fmt(get(), 3); });
    return h('label', { class: 'control number-field' }, labelEl, input, unit ? h('span', { class: 'field-unit' }, unit) : null);
  }

  function rangeField(label, get, set, min, max) {
    const range = h('input', { type: 'range', min, max, step: 1 });
    const input = h('input', { type: 'number', min, max, step: 1 });
    const apply = (v, src) => { set(Math.round(Math.min(max, Math.max(min, v)))); update(src); };
    range.addEventListener('input', () => apply(num(range.value, get()), range));
    input.addEventListener('input', () => { if (input.value !== '') apply(num(input.value, get()), input); });
    input.addEventListener('blur', () => { input.value = get(); });
    syncers.push((active) => { if (active !== range) range.value = get(); if (active !== input) input.value = get(); });
    return h('div', { class: 'control range-field' }, h('span', {}, label), range, input);
  }

  function segment(options, get, set) {
    const btns = options.map(([value, label]) => h('button', { class: 'button', type: 'button', onclick: () => { set(value); update(); } }, label));
    syncers.push(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === get()))));
    return h('div', { class: 'segment' }, btns);
  }

  function toggle(label, get, set) {
    const input = h('input', { type: 'checkbox' });
    input.addEventListener('change', () => { set(input.checked); update(); });
    syncers.push(() => { input.checked = !!get(); });
    return h('label', { class: 'control toggle-field' }, h('span', {}, label), input);
  }

  function selectField(label, options, get, set) {
    const sel = h('select');
    let shown = null;
    sel.addEventListener('change', () => { set(sel.value); update(); });
    syncers.push(() => {
      const opts = typeof options === 'function' ? options() : options;
      if (opts !== shown) { sel.replaceChildren(...opts.map(([v, l]) => h('option', { value: v }, l))); shown = opts; }
      sel.value = get();
    });
    return h('label', { class: 'control select-field' }, h('span', {}, label), sel);
  }

  const section = (title, open, ...kids) => h('details', { class: 'section', ...(open ? { open: '' } : {}) },
    h('summary', {}, title), h('div', { class: 'section-body' }, kids));
  const row = (...kids) => h('div', { class: 'row' }, kids);

  // ── 설정 변경 ──
  function setSize(name) {
    s.size = name;
    const found = sizes().find((x) => x[0] === name);
    if (!found) return;
    const [, w, hh] = found;
    if (isPortrait()) { s.width = w; s.height = hh; } else { s.width = hh; s.height = w; }
  }
  function matchSize() {
    const f = sizes().find(([, w, hh]) => (w === s.width && hh === s.height) || (w === s.height && hh === s.width));
    s.size = f ? f[0] : 'custom';
  }
  function setOrient(portrait) {
    if (portrait !== isPortrait()) [s.width, s.height] = [s.height, s.width];
  }
  function setMargin(side, v) {
    if (s.marginLinked) s.margin = { top: v, bottom: v, left: v, right: v };
    else s.margin[side] = v;
  }
  function setColGutter(v) {
    s.colGutter = v;
    if (s.rowGutterLinked) s.rowGutter = v;
  }

  // ── 패널 ──
  const presetList = h('div', { class: 'preset-list' });
  const presetName = h('input', { type: 'text', placeholder: '이름', spellcheck: 'false' });

  function renderPresets() {
    presetList.replaceChildren(...BUILTIN.concat(userPresets).filter((p) => presetMode(p) === s.mode).map((p) => {
      const item = h('div', { class: 'preset-item' },
        h('button', { class: 'button', type: 'button', onclick: () => applyPreset(p) }, p.name));
      if (!p.builtin) item.append(h('button', { class: 'button', 'data-variant': 'quiet', type: 'button', title: '삭제', onclick: () => {
        userPresets = userPresets.filter((x) => x !== p);
        store.set('pg.presets', userPresets);
        renderPresets();
      } }, '×'));
      return item;
    }));
  }
  function setMode(mode) {
    if (mode === s.mode) return;
    states[s.mode] = clone(s);
    s = Object.assign(clone(BASES[mode]), states[mode] ? clone(states[mode]) : {});
    renderPresets();
  }
  // 프리셋은 그리드만 바꾸고 지금 판형(크기·방향·도련·쪽수)은 그대로 둔다
  const PAGE_KEYS = ['size', 'width', 'height', 'bleed', 'pages', 'panels', 'bothSides', 'perforation', 'fileName'];
  function applyPreset(p) {
    const page = presetMode(p) === s.mode ? Object.fromEntries(PAGE_KEYS.filter((k) => k in s).map((k) => [k, s[k]])) : {};
    s = Object.assign(clone(BASES[presetMode(p)]), clone(p.s), page);
    renderPresets();
    update();
    toast(p.name);
  }
  function savePreset() {
    const name = presetName.value.trim() || autoName();
    const existing = userPresets.findIndex((p) => p.name === name);
    const entry = { name, s: clone(s) };
    if (existing >= 0) userPresets[existing] = entry; else userPresets.push(entry);
    store.set('pg.presets', userPresets);
    presetName.value = '';
    renderPresets();
    toast('저장됨 · ' + name);
  }
  presetName.addEventListener('keydown', (e) => { if (e.key === 'Enter') savePreset(); });

  const SIZE_OPTIONS = Object.fromEntries(Object.entries(SIZES_BY_MODE).map(([m, list]) =>
    [m, list.map(([n, w, hh]) => [n, `${n}  ${w}×${hh}`]).concat([['custom', '사용자 정의']])]));
  const panel = document.getElementById('panel');
  const modeSwitch = h('div', { class: 'mode-switch' }, segment([['poster', '포스터'], ['book', '책'], ['accordion', '병풍']], () => s.mode, setMode));
  // 특정 모드에서만 보이는 요소
  const only = (modes, el) => { syncers.push(() => { el.hidden = !modes.includes(s.mode); }); return el; };
  panel.append(
    modeSwitch,
    section('프리셋', true,
      presetList,
      h('div', { class: 'row fill-auto' },
        h('label', { class: 'control text-field' }, presetName),
        h('button', { class: 'button', type: 'button', onclick: savePreset }, '현재 설정 저장'))),

    section('판형', true,
      only(['poster', 'book'], selectField('크기', () => SIZE_OPTIONS[s.mode], () => s.size, setSize)),
      only(['poster', 'book'], segment([[true, '세로'], [false, '가로']], isPortrait, setOrient)),
      row(numberField(() => (s.mode === 'accordion' ? '면 폭' : '폭'), () => s.width, (v) => { s.width = v; matchSize(); }, { min: 10 }),
        numberField(() => (s.mode === 'accordion' ? '면 높이' : '높이'), () => s.height, (v) => { s.height = v; matchSize(); }, { min: 10 })),
      numberField('도련', () => s.bleed, (v) => { s.bleed = v; }, { max: 50 })),

    only(['accordion'], section('병풍', true,
      rangeField('면 수', () => s.panels, (v) => { s.panels = v; if (s.perforation > v) s.perforation = v; }, 2, 16),
      toggle('앞뒤 스프레드', () => s.bothSides, (v) => { s.bothSides = v; }),
      rangeField('절취선 면', () => s.perforation, (v) => { s.perforation = Math.min(v, s.panels); }, 0, 16))),

    section('여백', true,
      row(numberField('위', () => s.margin.top, (v) => setMargin('top', v)),
        numberField('아래', () => s.margin.bottom, (v) => setMargin('bottom', v))),
      row(numberField(() => (s.facing ? '안쪽' : '왼쪽'), () => s.margin.left, (v) => setMargin('left', v)),
        numberField(() => (s.facing ? '바깥쪽' : '오른쪽'), () => s.margin.right, (v) => setMargin('right', v))),
      toggle('모두 같게', () => s.marginLinked, (v) => { s.marginLinked = v; if (v) setMargin('top', s.margin.top); })),

    section('단', true,
      rangeField('단 수', () => s.cols, (v) => { s.cols = v; }, 1, 48),
      numberField('단 간격', () => s.colGutter, setColGutter)),

    section('행', true,
      rangeField('행 수', () => s.rows, (v) => { s.rows = v; }, 0, 48),
      numberField('행 간격', () => s.rowGutter, (v) => { s.rowGutter = v; s.rowGutterLinked = false; }),
      toggle('단 간격과 같게', () => s.rowGutterLinked, (v) => { s.rowGutterLinked = v; if (v) s.rowGutter = s.colGutter; })),

    section('기준선 격자', true,
      toggle('표시', () => s.baseline.on, (v) => { s.baseline.on = v; }),
      h('div', { class: 'row fill-auto' },
        numberField('간격', () => s.baseline.division, (v) => { s.baseline.division = v; }, { unit: '', step: 0.5, min: 1 }),
        segment([['pt', 'pt'], ['mm', 'mm']], () => s.baseline.unit, (u) => {
          if (u === s.baseline.unit) return;
          s.baseline.division = Math.round((u === 'mm' ? s.baseline.division / PT : s.baseline.division * PT) * 1000) / 1000;
          s.baseline.unit = u;
        })),
      numberField('시작', () => s.baseline.start, (v) => { s.baseline.start = v; }),
      segment([['margin', '위쪽 여백 기준'], ['page', '페이지 위 기준']], () => s.baseline.relative, (v) => { s.baseline.relative = v; })),

    only(['poster', 'book'], section('문서', false,
      rangeField('페이지 수', () => s.pages, (v) => { s.pages = v; }, 1, 64),
      toggle('페이지 마주보기', () => s.facing, (v) => { s.facing = v; }))),

    section('보기', false,
      toggle('여백', () => view.margin, (v) => { view.margin = v; }),
      toggle('단', () => view.cols, (v) => { view.cols = v; }),
      toggle('행', () => view.rows, (v) => { view.rows = v; }),
      toggle('기준선', () => view.baseline, (v) => { view.baseline = v; })),
  );
  // 세그먼트 안 버튼 두 개짜리는 폭을 줄인다
  panel.querySelectorAll('.row.fill-auto > .segment').forEach((el) => { el.style.width = '7rem'; });

  const fileInput = document.getElementById('fileName');
  // 파일 이름은 모드별로 따로. 비우면 자동 이름
  fileInput.addEventListener('input', () => { s.fileName = fileInput.value.trim().replace(/\.idml$/i, '') || null; update(fileInput); });
  fileInput.addEventListener('blur', () => { fileInput.value = s.fileName || autoName(); });
  syncers.push((active) => { if (active !== fileInput) fileInput.value = s.fileName || autoName(); });

  // ── 계산 ──
  function metrics() {
    const iw = s.width - s.margin.left - s.margin.right;
    const ih = s.height - s.margin.top - s.margin.bottom;
    const cw = (iw - s.colGutter * (s.cols - 1)) / s.cols;
    const rh = s.rows > 1 ? (ih - s.rowGutter * (s.rows - 1)) / s.rows : ih;
    return { iw, ih, cw, rh };
  }

  const readout = document.getElementById('readout');
  function renderReadout() {
    const m = metrics();
    const items = [['판형', `${fmt(s.width, 1)} × ${fmt(s.height, 1)} mm`], ['단 너비', fmt(m.cw) + ' mm']];
    if (s.mode === 'accordion') items.splice(1, 0, ['펼친 크기', `${fmt(s.width * s.panels, 1)} × ${fmt(s.height, 1)} mm`], ['페이지', (s.panels * (s.bothSides ? 2 : 1)) + 'p']);
    if (s.rows > 1) {
      items.push(['행 높이', fmt(m.rh) + ' mm']);
      if (s.baseline.on) items.push(['행 / 기준선', fmt((m.rh + s.rowGutter) / baselineMm()) + '줄']);
    }
    if (s.baseline.on) items.push(['기준선', s.baseline.unit === 'pt' ? `${fmt(s.baseline.division)} pt · ${fmt(baselineMm())} mm` : `${fmt(s.baseline.division)} mm · ${fmt(s.baseline.division * PT)} pt`]);
    const bad = m.cw <= 0 || m.rh <= 0;
    readout.replaceChildren(...items.map(([k, v]) => h('span', {}, k, h('b', {}, v))));
    readout.style.color = bad ? '#ff8a80' : '';
    exportBtn.disabled = bad;
  }

  // ── 미리보기 ──
  const canvas = document.getElementById('preview');
  const ctx = canvas.getContext('2d');
  const COLORS = {
    bleed: 'rgba(255, 80, 80, .7)',
    margin: '#d63cc4',
    col: '#8a4fd8',
    colFill: 'rgba(138, 79, 216, .07)',
    row: '#16b3d6',
    baseline: 'rgba(90, 170, 240, .45)',
    fold: '#2bb24c',
    perforation: '#e8318a',
  };

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) { canvas.width = cw * dpr; canvas.height = ch * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const pad = 56, bottomPad = 64;
    const acc = s.mode === 'accordion';
    const facing = !acc && s.facing;
    const perRow = acc ? s.panels : facing ? 2 : 1;           // 한 스프레드의 페이지 수
    const rowsOfSpreads = acc && s.bothSides ? 2 : 1;          // 병풍 앞·뒤를 위아래로
    const labelPx = acc ? 24 : 0;                              // 앞면/뒷면 글씨 자리
    const gapPx = acc ? 24 : 0;
    const fullW = s.width * perRow + 2 * s.bleed, fullH = s.height + 2 * s.bleed;
    const fixedPx = rowsOfSpreads * labelPx + (rowsOfSpreads - 1) * gapPx;
    const k = Math.min((cw - 2 * pad) / fullW, (ch - pad - bottomPad - fixedPx) / (rowsOfSpreads * fullH));
    if (!(k > 0)) return;
    const sx = Math.round((cw - s.width * perRow * k) / 2);
    const top0 = pad + (ch - pad - bottomPad - fixedPx - rowsOfSpreads * fullH * k) / 2;
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const crisp = (v) => Math.round(v) + 0.5;
    const m = metrics();
    const T = s.margin.top;
    let oy, Y;

    for (let side = 0; side < rowsOfSpreads; side++) {
      oy = Math.round(top0 + side * (fullH * k + labelPx + gapPx) + labelPx + s.bleed * k);
      Y = (mmv) => oy + mmv * k;

      if (acc) {
        ctx.fillStyle = 'rgba(255, 255, 255, .5)';
        ctx.font = '500 12px "Pretendard Variable", Pretendard, sans-serif';
        ctx.textBaseline = 'bottom';
        const first = side * s.panels + 1;
        ctx.fillText((side ? '뒷면' : '앞면') + '  ' + first + '–' + (first + s.panels - 1), sx - s.bleed * k, Y(-s.bleed) - 8);
      }

      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, oy, s.width * perRow * k, s.height * k);
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      if (s.bleed > 0) {
        ctx.strokeStyle = COLORS.bleed;
        ctx.strokeRect(crisp(sx - s.bleed * k), crisp(Y(-s.bleed)), Math.round(fullW * k), Math.round(fullH * k));
      }

      // 마주보기: 왼쪽 페이지는 바깥쪽 여백이 왼쪽에 온다
      const pageLefts = facing ? [s.margin.right, s.margin.left] : Array(perRow).fill(s.margin.left);
      pageLefts.forEach((L, pi) => drawPage(sx + pi * s.width * k, L));

      if (facing) {
        ctx.strokeStyle = 'rgba(0, 0, 0, .25)';
        line(crisp(sx + s.width * k), Y(-s.bleed), crisp(sx + s.width * k), Y(s.height + s.bleed));
      }

      if (acc) {
        // 접는 선
        ctx.strokeStyle = COLORS.fold;
        ctx.setLineDash([]);
        const perfOn = side === 0 && s.perforation > 1 && s.perforation <= perRow;
        for (let i = 1; i < perRow; i++) if (!(perfOn && i === s.perforation - 1)) line(crisp(sx + i * s.width * k), Y(-s.bleed), crisp(sx + i * s.width * k), Y(s.height + s.bleed));
        // 절취선 (앞면만)
        if (perfOn) {
          const x = crisp(sx + (s.perforation - 1) * s.width * k);
          ctx.strokeStyle = COLORS.perforation;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          line(x, Y(-s.bleed), x, Y(s.height + s.bleed));
          ctx.setLineDash([]);
          ctx.lineWidth = 1;
        }
      }
    }

    function drawPage(ox, L) {
      const X = (mmv) => ox + mmv * k;
      const colX = [];
      for (let i = 0; i < s.cols; i++) colX.push(L + i * (m.cw + s.colGutter));
      const rowY = [];
      const rows = s.rows > 1 ? s.rows : 1;
      for (let j = 0; j < rows; j++) rowY.push(T + j * (m.rh + s.rowGutter));

      if (view.cols && m.cw > 0 && m.rh > 0) {
        ctx.fillStyle = COLORS.colFill;
        const useRows = view.rows && s.rows > 1;
        for (const x of colX) {
          if (useRows) for (const y of rowY) ctx.fillRect(X(x), Y(y), m.cw * k, m.rh * k);
          else ctx.fillRect(X(x), Y(T), m.cw * k, m.ih * k);
        }
      }

      if (view.baseline && s.baseline.on) {
        const step = baselineMm();
        if (step * k >= 2) {
          ctx.strokeStyle = COLORS.baseline;
          let y = (s.baseline.relative === 'page' ? 0 : T) + s.baseline.start;
          for (; y <= s.height + 1e-6; y += step) if (y >= 0) line(ox, crisp(Y(y)), ox + s.width * k, crisp(Y(y)));
        }
      }

      if (view.rows && s.rows > 1) {
        ctx.strokeStyle = COLORS.row;
        for (const y of GridIdml.rowGuides(s)) { const py = crisp(oy + (y / PT) * k); line(ox, py, ox + s.width * k, py); }
      }

      if (view.cols && s.cols > 1 && m.cw > 0) {
        ctx.strokeStyle = COLORS.col;
        for (let i = 0; i < s.cols; i++) {
          if (i > 0) line(crisp(X(colX[i])), Y(T), crisp(X(colX[i])), Y(s.height - s.margin.bottom));
          if (i < s.cols - 1) line(crisp(X(colX[i] + m.cw)), Y(T), crisp(X(colX[i] + m.cw)), Y(s.height - s.margin.bottom));
        }
      }

      if (view.margin) {
        ctx.strokeStyle = COLORS.margin;
        ctx.strokeRect(crisp(X(L)), crisp(Y(T)), Math.round(m.iw * k), Math.round(m.ih * k));
      }
    }
  }

  // ── 저장 ──
  const exportBtn = document.getElementById('export');
  function exportIdml() {
    if (exportBtn.disabled) return;
    const name = (s.fileName || autoName()).replace(/\.idml$/i, '').replace(/[\\/:*?"<>|]/g, '_');
    try {
      const blob = GridIdml.build({ ...clone(s), fileName: name });
      const a = h('a', { href: URL.createObjectURL(blob), download: name + '.idml' });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast(name + '.idml');
    } catch (e) {
      console.error(e);
      toast('저장 실패 · ' + e.message);
    }
  }
  exportBtn.addEventListener('click', exportIdml);
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportIdml(); }
  });

  let toastEl, toastTimer;
  function toast(msg) {
    toastEl?.remove();
    toastEl = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(toastEl);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl?.remove(), 1800);
  }

  function update(active) {
    if (s.rowGutterLinked) s.rowGutter = s.colGutter;
    states[s.mode] = s;
    store.set('pg.states', states);
    store.set('pg.mode', s.mode);
    store.set('pg.view', view);
    syncers.forEach((f) => f(active));
    renderReadout();
    draw();
  }

  new ResizeObserver(draw).observe(canvas);
  renderPresets();
  update();
})();
