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

    const layer = '\t<Layer Self="' + LAYER_ID + '" Name="레이어 1" Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="true"><Properties><LayerColor type="enumeration">LightBlue</LayerColor></Properties></Layer>' +
      (perf > 1 ? '\n\t<Layer Self="' + PERF_LAYER_ID + '" Name="perforation" Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="false"><Properties><LayerColor type="enumeration">Red</LayerColor></Properties></Layer>' : '');

    const designmap = T['designmap.xml']
      .replace('{{NAME}}', esc(g.fileName.replace(/\.idml$/i, '') + '.indd'))
      .replace('{{LAYERS}}', layer)
      .replace('{{MASTERS}}', '<idPkg:MasterSpread src="MasterSpreads/MasterSpread_uf2.xml" />')
      .replace('{{SPREADS}}', spreadRefs.join('\n\t'))
      .replace('{{PAGESTART}}', firstPage)
      .split('{{PAGECOUNT}}').join(String(pages));

    let prefs = T['Resources/Preferences.xml'];
    prefs = setAttrs(prefs, 'DocumentPreference', {
      PageWidth: n(W), PageHeight: n(H), PagesPerDocument: pages, FacingPages: facing ? 'true' : 'false',
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
      ['Resources/Styles.xml', T['Resources/Styles.xml']],
      ['Resources/Preferences.xml', prefs],
      ['MasterSpreads/MasterSpread_uf2.xml', master],
      ...Object.entries(spreads),
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
