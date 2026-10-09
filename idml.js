// 그리드 설정 → IDML(zip) Blob.
// 단·여백은 인디자인 여백과 단(MarginPreference), 행은 마스터의 눈금자 안내선, 기준선은 문서 기준선 격자로 넣는다.
(function () {
  const PT = 72 / 25.4;
  const mm = (v) => v * PT;
  const n = (v) => String(Math.round(v * 1e6) / 1e6);

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function setAttrs(xml, tag, attrs) {
    const re = new RegExp('<' + tag + '\\s[^>]*>');
    const m = xml.match(re);
    if (!m) throw new Error(tag + ' 없음');
    let el = m[0];
    for (const [k, v] of Object.entries(attrs)) {
      const ar = new RegExp('(\\s' + k + '=")[^"]*(")');
      el = ar.test(el) ? el.replace(ar, '$1' + esc(v) + '$2') : el.replace(/(\s*\/?>)$/, ' ' + k + '="' + esc(v) + '"$1');
    }
    return xml.replace(m[0], el);
  }

  // 인디자인 단 위치: 왼쪽 여백 기준, [단 시작, 단 끝] 쌍
  function columnPositions(width, count, gutter) {
    const cw = (width - gutter * (count - 1)) / count;
    const out = [];
    for (let i = 0; i < count; i++) out.push(i * (cw + gutter), i * (cw + gutter) + cw);
    out[out.length - 1] = width;
    return out;
  }

  // 페이지 위에서부터의 가로 안내선 위치(pt)
  function rowGuides(g) {
    if (!g.rows || g.rows < 2) return [];
    const top = mm(g.margin.top), inner = mm(g.height - g.margin.top - g.margin.bottom), rg = mm(g.rowGutter);
    const rh = (inner - rg * (g.rows - 1)) / g.rows;
    const ys = [];
    for (let i = 1; i < g.rows; i++) {
      const end = top + i * rh + (i - 1) * rg;
      ys.push(end);
      if (rg > 0) ys.push(end + rg);
    }
    return ys;
  }

  function marginPref(g, cols) {
    const inner = mm(g.width - g.margin.left - g.margin.right);
    return '<MarginPreference ColumnCount="' + cols + '" ColumnGutter="' + n(mm(g.colGutter)) +
      '" Top="' + n(mm(g.margin.top)) + '" Bottom="' + n(mm(g.margin.bottom)) +
      '" Left="' + n(mm(g.margin.left)) + '" Right="' + n(mm(g.margin.right)) +
      '" ColumnDirection="Horizontal" ColumnsPositions="' + columnPositions(inner, cols, mm(g.colGutter)).map(n).join(' ') + '" />';
  }

  const GRID_DATA = '<GridDataInformation FontStyle="M" PointSize="12" CharacterAki="0" LineAki="9" HorizontalScale="100" VerticalScale="100" LineAlignment="LeftOrTopLineJustify" GridAlignment="AlignEmCenter" CharacterAlignment="AlignEmCenter"><Properties><AppliedFont type="string">Adobe 명조 Std</AppliedFont></Properties></GridDataInformation>';
  const LAYER_ID = 'u64a1';
  const PERF_LAYER_ID = 'u64b0';

  // 스프레드 전체에 걸친 세로 안내선. Location 은 스프레드 왼쪽 끝 기준(눈금자 원점 = 스프레드)
  function spreadGuideXml(id, x, layer, color) {
    return '<Guide Self="' + id + '" OverriddenPageItemProps="" Orientation="Vertical" Location="' + n(x) +
      '" FitToPage="false" ViewThreshold="5" Locked="false" ItemLayer="' + layer +
      '" PageIndex="-1" GuideType="Ruler" GuideZone="0"><Properties><GuideColor type="enumeration">' + color + '</GuideColor></Properties></Guide>';
  }

  // 점선. 좌표는 스프레드 좌표(가운데가 원점)
  function dashedLineXml(id, x, y1, y2, layer) {
    const pt = (y) => '<PathPointType Anchor="' + n(x) + ' ' + n(y) + '" LeftDirection="' + n(x) + ' ' + n(y) + '" RightDirection="' + n(x) + ' ' + n(y) + '" />';
    return '<GraphicLine Self="' + id + '" ContentType="Unassigned" OverriddenPageItemProps="" Visible="true" Name="perforation" StrokeWeight="0.5" StrokeColor="Color/Magenta" FillColor="Swatch/None" StrokeType="StrokeStyle/$ID/Dashed" ItemLayer="' + layer +
      '" Locked="false" AppliedObjectStyle="ObjectStyle/$ID/[None]" ItemTransform="1 0 0 1 0 0">' +
      '<Properties><PathGeometry><GeometryPathType PathOpen="true"><PathPointArray>' + pt(y1) + pt(y2) +
      '</PathPointArray></GeometryPathType></PathGeometry></Properties></GraphicLine>';
  }

  // ── 내용(선택): 단락 스타일, 레이어, 텍스트 프레임, 박스, 원 ──
  // g.content = { paragraphStyles: [{ name, size, leading, font, fontStyle, alignToBaseline }],
  //               layers: [{ name, printable, color }],
  //               items: [{ type: 'text'|'rect'|'oval', page, x, y, w, h (mm, 페이지 기준), layer, paragraphs: [{ style, text, justify, color }] }] }
  // layers 는 위에서 아래 순서. layer 를 안 주면 '레이어 1'.
  function paragraphStyleXml(p) {
    return '<ParagraphStyle Self="ParagraphStyle/' + esc(p.name) + '" Name="' + esc(p.name) + '" Imported="false" NextStyle="ParagraphStyle/' + esc(p.name) +
      '" KeyboardShortcut="0 0" PointSize="' + n(p.size) + '" FontStyle="' + esc(p.fontStyle || 'Regular') +
      '" GridAlignment="' + (p.alignToBaseline ? 'AlignBaseline' : 'None') + '"><Properties>' +
      '<BasedOn type="string">$ID/[No paragraph style]</BasedOn><PreviewColor type="enumeration">Nothing</PreviewColor>' +
      '<Leading type="unit">' + n(p.leading) + '</Leading><AppliedFont type="string">' + esc(p.font) + '</AppliedFont>' +
      '</Properties></ParagraphStyle>';
  }

  function storyXml(id, paragraphs) {
    const body = paragraphs.map((p, i) =>
      '<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/' + esc(p.style) + '"' + (p.justify ? ' Justification="' + p.justify + '"' : '') + '>' +
      '<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"' + (p.color ? ' FillColor="' + esc(p.color) + '"' : '') + '>' +
      (p.text ? '<Content>' + esc(p.text) + '</Content>' : '') + (i < paragraphs.length - 1 ? '<Br />' : '') +
      '</CharacterStyleRange></ParagraphStyleRange>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="21.0">\n' +
      '<Story Self="' + id + '" UserText="true" IsEndnoteStory="false" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n">' +
      '<StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection" />' +
      body + '</Story>\n</idPkg:Story>\n';
  }

  // 스프레드 좌표의 점 목록 → PathGeometry. 점마다 [x, y] 또는 [x, y, lx, ly, rx, ry]
  function pathXml(points, open) {
    return '<Properties><PathGeometry><GeometryPathType PathOpen="' + (open ? 'true' : 'false') + '"><PathPointArray>' +
      points.map(([x, y, lx = x, ly = y, rx = x, ry = y]) =>
        '<PathPointType Anchor="' + n(x) + ' ' + n(y) + '" LeftDirection="' + n(lx) + ' ' + n(ly) + '" RightDirection="' + n(rx) + ' ' + n(ry) + '" />').join('') +
      '</PathPointArray></GeometryPathType></PathGeometry></Properties>';
  }
  const rectPoints = (x1, y1, x2, y2) => [[x1, y1], [x1, y2], [x2, y2], [x2, y1]];
  function ovalPoints(x1, y1, x2, y2) {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = (x2 - x1) / 2, ry = (y2 - y1) / 2, k = 0.5522847498;
    return [
      [x1, cy, x1, cy + k * ry, x1, cy - k * ry],
      [cx, y1, cx - k * rx, y1, cx + k * rx, y1],
      [x2, cy, x2, cy - k * ry, x2, cy + k * ry],
      [cx, y2, cx + k * rx, y2, cx - k * rx, y2],
    ];
  }

  function guideXml(id, y, pageIndex) {
    return '<Guide Self="' + id + '" OverriddenPageItemProps="" Orientation="Horizontal" Location="' + n(y) +
      '" FitToPage="true" ViewThreshold="5" Locked="false" ItemLayer="' + LAYER_ID +
      '" PageIndex="' + pageIndex + '" GuideType="Ruler" GuideZone="0"><Properties><GuideColor type="enumeration">Cyan</GuideColor></Properties></Guide>';
  }

  function build(g) {
    const T = window.IDML_TEMPLATE;
    const W = mm(g.width), H = mm(g.height), B = mm(g.bleed);
    // 병풍: 면 N개를 한 스프레드에 가로로 이어 붙이고, 앞·뒤 스프레드를 만든다
    const acc = g.mode === 'accordion';
    const panels = acc ? Math.max(1, Math.round(g.panels)) : 1;
    const sides = acc ? (g.bothSides ? 2 : 1) : 1;
    const perf = acc ? Math.round(g.perforation || 0) : 0;   // 절취선이 왼쪽에 오는 앞면 번호 (0 = 없음)
    const pages = acc ? panels * sides : Math.max(1, Math.round(g.pages || 1));
    const cols = Math.max(1, Math.round(g.cols));
    const bounds = '0 0 ' + n(H) + ' ' + n(W);
    const guides = rowGuides(g);

    const facing = !acc && !!g.facing;
    const pageXml = (self, name, master, alt, tx) =>
      '<Page Self="' + self + '" TabOrder="" AppliedMaster="' + master + '" OverrideList="" MasterPageTransform="1 0 0 1 0 0" Name="' + name + '" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" GeometricBounds="' + bounds + '" ItemTransform="1 0 0 1 ' + n(tx) + ' ' + n(-H / 2) + '" AppliedAlternateLayout="' + alt + '" LayoutRule="' + (master === 'n' ? 'Off' : 'UseMaster') + '" SnapshotBlendingMode="IgnoreLayoutSnapshots" OptionalPage="false" GridStartingPoint="TopOutside" UseMasterGrid="true">' +
      '<Properties><PageColor type="enumeration">UseMasterColor</PageColor></Properties>' + marginPref(g, cols) + GRID_DATA + '</Page>';
    // 마주보기: 왼쪽 페이지는 x = -W, 오른쪽 페이지는 x = 0 (책등이 원점)
    const singleTx = facing ? 0 : -W / 2;

    const masterPages = facing
      ? pageXml('uf7', 'A', 'n', 'n', -W) + pageXml('uf8', 'A', 'n', 'n', 0)
      : pageXml('uf7', 'A', 'n', 'n', singleTx);
    let gid = 0x100;
    const masterGuides = (facing ? [0, 1] : [0]).map((pi) => guides.map((y) => guideXml('ub' + (gid++).toString(16), y, pi)).join('')).join('');
    const master = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<idPkg:MasterSpread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="21.0">\n' +
      '<MasterSpread Self="uf2" Name="A-마스터" NamePrefix="A" BaseName="마스터" ShowMasterItems="true" PageCount="' + (facing ? 2 : 1) + '" OverriddenPageItemProps="" PrimaryTextFrame="n" ItemTransform="1 0 0 1 0 0">' +
      '<Properties><PageColor type="enumeration">UseMasterColor</PageColor></Properties>' +
      masterPages + masterGuides +
      '</MasterSpread>\n</idPkg:MasterSpread>\n';

    // 펼침면 나누기: 마주보기면 1쪽 혼자, 다음부터 두 쪽씩
    const layout = [];
    if (acc) {
      for (let side = 0; side < sides; side++) layout.push(Array.from({ length: panels }, (_, k) => side * panels + k + 1));
    } else if (facing) {
      layout.push([1]);
      for (let p = 2; p <= pages; p += 2) layout.push(p + 1 <= pages ? [p, p + 1] : [p]);
    } else {
      for (let p = 1; p <= pages; p++) layout.push([p]);
    }

    const content = g.content || { paragraphStyles: [], layers: [], items: [] };
    const layerIds = { '레이어 1': LAYER_ID };
    (content.layers || []).forEach((l, i) => { layerIds[l.name] = 'u64c' + i.toString(16); });
    const stories = {};
    let itemId = 0x200;
    // 페이지 위 항목 → 스프레드 XML. ox, oy = 페이지 왼쪽 위의 스프레드 좌표
    function itemXml(it, ox, oy) {
      const id = 'ui' + (itemId++).toString(16);
      const x1 = ox + mm(it.x), y1 = oy + mm(it.y), x2 = x1 + mm(it.w), y2 = y1 + mm(it.h);
      const layer = layerIds[it.layer || '레이어 1'];
      if (!layer) throw new Error('레이어 없음: ' + it.layer);
      if (it.type === 'text') {
        const sid = 'us' + (itemId++).toString(16);
        stories['Stories/Story_' + sid + '.xml'] = storyXml(sid, it.paragraphs);
        return '<TextFrame Self="' + id + '" ParentStory="' + sid + '" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" OverriddenPageItemProps="" Visible="true" Name="$ID/" ItemLayer="' + layer +
          '" Locked="false" AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]" ItemTransform="1 0 0 1 0 0">' + pathXml(rectPoints(x1, y1, x2, y2)) +
          '<TextFramePreference TextColumnCount="1" TextColumnGutter="12" AutoSizingType="Off" FirstBaselineOffset="AscentOffset" VerticalJustification="TopAlign" UseMinimumHeightForAutoSizing="false" IgnoreWrap="false" /></TextFrame>';
      }
      const tag = it.type === 'oval' ? 'Oval' : 'Rectangle';
      const pts = it.type === 'oval' ? ovalPoints(x1, y1, x2, y2) : rectPoints(x1, y1, x2, y2);
      return '<' + tag + ' Self="' + id + '" ContentType="Unassigned" OverriddenPageItemProps="" Visible="true" Name="' + esc(it.name || '$ID/') + '" StrokeWeight="' + n(it.stroke ?? 0.5) +
        '" StrokeColor="Color/Black" FillColor="Swatch/None" StrokeType="StrokeStyle/$ID/Solid" ItemLayer="' + layer +
        '" Locked="false" AppliedObjectStyle="ObjectStyle/$ID/[None]" ItemTransform="1 0 0 1 0 0">' + pathXml(pts) + '</' + tag + '>';
    }

    const spreads = {};
    const spreadRefs = [];
    let firstPage = '';
    layout.forEach((nums, i) => {
      const sid = 'ua' + (0x100 + i).toString(16);
      const path = 'Spreads/Spread_' + sid + '.xml';
      spreadRefs.push('<idPkg:Spread src="' + path + '" />');
      // 마주보기에서 1쪽(홀수)은 오른쪽, 짝수 쪽은 왼쪽
      const binding = facing ? (nums[0] % 2 === 0 ? 1 : 0) : 0;
      const pagesXml = nums.map((num, k) => {
        const pid = 'uc' + (0x100 + num - 1).toString(16);
        if (num === 1) firstPage = pid;
        // 병풍: 스프레드 가운데가 원점, 면마다 W 씩 오른쪽으로
        const tx = acc ? -nums.length * W / 2 + k * W : facing ? (num % 2 === 0 ? -W : 0) : singleTx;
        return pageXml(pid, String(num), 'uf2', 'uf1', tx);
      }).join('');
      let extras = '';
      nums.forEach((num, k) => {
        const tx = acc ? -nums.length * W / 2 + k * W : facing ? (num % 2 === 0 ? -W : 0) : singleTx;
        (content.items || []).filter((it) => it.page === num).forEach((it) => { extras += itemXml(it, tx, -H / 2); });
      });
      if (acc) {
        for (let k = 1; k < nums.length; k++) extras += spreadGuideXml('ud' + (0x100 + i * 64 + k).toString(16), k * W, LAYER_ID, 'Green');
        if (i === 0 && perf > 1 && perf <= nums.length) {
          extras += spreadGuideXml('ue' + (0x100 + i).toString(16), (perf - 1) * W, PERF_LAYER_ID, 'Red');
          extras += dashedLineXml('uf' + (0x400 + i).toString(16), -nums.length * W / 2 + (perf - 1) * W, -H / 2 - B, H / 2 + B, PERF_LAYER_ID);
        }
      }
      spreads[path] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="21.0">\n' +
        '<Spread Self="' + sid + '" PageTransitionType="None" PageTransitionDirection="NotApplicable" PageTransitionDuration="Medium" ShowMasterItems="true" PageCount="' + nums.length + '" BindingLocation="' + binding + '" SpreadHidden="false" AllowPageShuffle="' + (acc ? 'false' : 'true') + '" ItemTransform="1 0 0 1 0 ' + n(i * (H + 2 * B + mm(40))) + '" FlattenerOverride="Default">' +
        '<FlattenerPreference LineArtAndTextResolution="400" GradientAndMeshResolution="400" ClipComplexRegions="false" ConvertAllStrokesToOutlines="false" ConvertAllTextToOutlines="false"><Properties><RasterVectorBalance type="double">50</RasterVectorBalance></Properties></FlattenerPreference>' +
        pagesXml + extras + '</Spread>\n</idPkg:Spread>\n';
    });

    const layerXml = (id, name, printable, color) => '\t<Layer Self="' + id + '" Name="' + esc(name) + '" Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="' + (printable ? 'true' : 'false') + '"><Properties><LayerColor type="enumeration">' + color + '</LayerColor></Properties></Layer>';
    // designmap 의 레이어는 아래부터 적는다. 내용 레이어: below 면 '레이어 1' 아래, 아니면 위
    const extraLayers = (below) => (content.layers || []).filter((l) => !!l.below === below).map((l) => layerXml(layerIds[l.name], l.name, l.printable !== false, l.color || 'Gray'));
    const layer = [
      ...extraLayers(true).reverse(),
      layerXml(LAYER_ID, '레이어 1', true, 'LightBlue'),
      ...(perf > 1 ? [layerXml(PERF_LAYER_ID, 'perforation', false, 'Red')] : []),
      ...extraLayers(false).reverse(),
    ].join('\n');

    const designmap = T['designmap.xml']
      .replace('{{NAME}}', esc(g.fileName.replace(/\.idml$/i, '') + '.indd'))
      .replace('{{LAYERS}}', layer)
      .replace('{{MASTERS}}', '<idPkg:MasterSpread src="MasterSpreads/MasterSpread_uf2.xml" />')
      .replace('{{SPREADS}}', spreadRefs.join('\n\t'))
      .replace('{{PAGESTART}}', firstPage)
      .split('{{PAGECOUNT}}').join(String(pages))
      .replace('<idPkg:BackingStory src="XML/BackingStory.xml" />', (m) => [m, ...Object.keys(stories).map((p) => '<idPkg:Story src="' + p + '" />')].join('\n\t'))
      .replace('StoryList="ucd"', 'StoryList="' + ['ucd', ...Object.keys(stories).map((p) => p.match(/Story_(\w+)\.xml/)[1])].join(' ') + '"');

    let styles = T['Resources/Styles.xml'];
    if ((content.paragraphStyles || []).length) {
      styles = styles.replace('</RootParagraphStyleGroup>', content.paragraphStyles.map(paragraphStyleXml).join('\n\t\t') + '\n\t</RootParagraphStyleGroup>');
    }

    let prefs = T['Resources/Preferences.xml'];
    prefs = setAttrs(prefs, 'DocumentPreference', {
      // 쪽은 스프레드가 만든다. 여기에 쪽 수를 넣으면 인디자인이 빈 쪽을 따로 만들고 스프레드를 그 뒤에 붙인다(2026 확인)
      PageWidth: n(W), PageHeight: n(H), PagesPerDocument: 1, FacingPages: facing ? 'true' : 'false',
      DocumentBleedTopOffset: n(B), DocumentBleedBottomOffset: n(B),
      DocumentBleedInsideOrLeftOffset: n(B), DocumentBleedOutsideOrRightOffset: n(B), DocumentBleedUniformSize: 'true',
      AllowPageShuffle: acc ? 'false' : 'true',
    });
    const bl = g.baseline;
    const blDiv = bl.unit === 'pt' ? bl.division : mm(bl.division);
    prefs = setAttrs(prefs, 'GridPreference', {
      BaselineGridShown: bl.on ? 'true' : 'false',
      BaselineStart: n(mm(bl.start)),
      BaselineDivision: n(Math.max(1, blDiv)),
      BaselineGridRelativeOption: bl.relative === 'page' ? 'TopOfPageOfBaselineGridRelativeOption' : 'TopOfMarginOfBaselineGridRelativeOption',
    });
    prefs = setAttrs(prefs, 'MarginPreference', {
      ColumnCount: cols, ColumnGutter: n(mm(g.colGutter)),
      Top: n(mm(g.margin.top)), Bottom: n(mm(g.margin.bottom)), Left: n(mm(g.margin.left)), Right: n(mm(g.margin.right)),
    });

    const files = [
      ['mimetype', T['mimetype']],
      ['META-INF/container.xml', T['META-INF/container.xml']],
      ['designmap.xml', designmap],
      ['Resources/Graphic.xml', T['Resources/Graphic.xml']],
      ['Resources/Fonts.xml', T['Resources/Fonts.xml']],
      ['Resources/Styles.xml', styles],
      ['Resources/Preferences.xml', prefs],
      ['MasterSpreads/MasterSpread_uf2.xml', master],
      ...Object.entries(spreads),
      ...Object.entries(stories),
      ['XML/BackingStory.xml', T['XML/BackingStory.xml']],
      ['XML/Tags.xml', T['XML/Tags.xml']],
    ];
    return zipStore(files);
  }

  // 압축 없는(STORE) zip. IDML 은 mimetype 이 첫 항목, 비압축이어야 한다.
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
    return t;
  })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  function zipStore(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const [name, text] of files) {
      const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, nb, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true);
      c.setUint32(42, offset, true);
      central.push(c.buffer, nb);
      offset += 30 + nb.length + data.length;
    }
    const cdSize = central.reduce((s, b) => s + b.byteLength, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, e.buffer], { type: 'application/vnd.adobe.indesign-idml-package' });
  }

  window.GridIdml = { build, columnPositions, rowGuides, PT };
})();
