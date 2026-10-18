/* Đối chiếu Excel — giao diện */
(function () {
  'use strict';

  var DC = window.DoiChieu, XL = window.XLSX;
  var PAGE = 300;

  var state = {
    A: null, B: null,
    match: null,
    cols: [],          // mỗi cột của file 1: ghép với cột nào của file 2, đóng vai trò gì
    cfg: DC.withDefaults({}),
    result: null,
    tab: 'diffs',
    shown: {},
    q: ''
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- hiển thị giá trị ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtCell(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v.getTime())) {
      var s = pad(v.getDate()) + '/' + pad(v.getMonth() + 1) + '/' + v.getFullYear();
      if (v.getHours() || v.getMinutes() || v.getSeconds()) {
        s += ' ' + pad(v.getHours()) + ':' + pad(v.getMinutes());
      }
      return s;
    }
    if (typeof v === 'number') {
      return v.toLocaleString('vi-VN', { maximumFractionDigits: 6 });
    }
    if (typeof v === 'boolean') return v ? 'Có' : 'Không';
    return String(v);
  }

  function fmtNumber(n) {
    if (n == null || !isFinite(n)) return '';
    return n.toLocaleString('vi-VN', { maximumFractionDigits: 6 });
  }

  function fmtDelta(n) {
    if (n == null || !isFinite(n)) return '';
    var s = fmtNumber(Math.abs(n));
    return (n > 0 ? '+' : n < 0 ? '−' : '') + s;
  }

  function plain(s) { return DC.stripDiacritics(String(s == null ? '' : s)).toLowerCase(); }

  /* ---------- đọc file ---------- */

  function sheetToAoa(ws) {
    return XL.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  }

  function readFile(side, file) {
    setStatus('Đang đọc ' + file.name + ' …', true);
    var fr = new FileReader();
    fr.onerror = function () {
      setStatus('');
      showError('Không đọc được file ' + file.name + '.');
    };
    fr.onload = function () {
      try {
        var wb = XL.read(new Uint8Array(fr.result), { type: 'array', cellDates: true });
        var names = wb.SheetNames.slice();
        if (!names.length) throw new Error('File không có sheet nào.');
        var pick = names[0];
        for (var i = 0; i < names.length; i++) {
          var aoa0 = sheetToAoa(wb.Sheets[names[i]]);
          if (aoa0.length > 1) { pick = names[i]; break; }
        }
        state[side] = { name: file.name, wb: wb, sheets: names, sheet: pick, headerIdx: null, aoa: null, table: null, samples: null };
        loadSheet(side, pick, null);
        showError('');
      } catch (e) {
        setStatus('');
        showError('Không mở được "' + file.name + '": ' + (e && e.message ? e.message : e)
          + ' — hãy thử lưu lại dưới dạng .xlsx hoặc .csv.');
      }
    };
    fr.readAsArrayBuffer(file);
  }

  function loadSheet(side, sheetName, headerIdx) {
    var f = state[side];
    f.sheet = sheetName;
    f.aoa = sheetToAoa(f.wb.Sheets[sheetName]);
    f.headerIdx = headerIdx == null ? DC.detectHeaderRow(f.aoa) : headerIdx;
    f.table = DC.buildTable(f.aoa, f.headerIdx);
    f.samples = null;
    renderCard(side);
    run(false, true);
  }

  /* ---------- thẻ file ---------- */

  function renderCard(side) {
    var box = $('drop' + side), f = state[side];
    clear(box);
    box.classList.toggle('loaded', !!f);
    box.appendChild(el('span', 'tag', side === 'A' ? 'FILE 1' : 'FILE 2'));

    if (!f) {
      box.appendChild(el('div', 'big', '📄'));
      box.appendChild(el('div', null, 'Chọn hoặc thả file Excel vào đây'));
      box.appendChild(el('div', 'hint', '.xlsx, .xls, .xlsm, .csv'));
      return;
    }

    var x = el('button', 'x', '✕');
    x.title = 'Bỏ file này';
    x.onclick = function (ev) {
      ev.stopPropagation();
      state[side] = null;
      state.cols = [];
      renderCard(side);
      run(false, true);
    };
    box.appendChild(x);
    box.appendChild(el('div', 'fname', f.name));

    var r1 = el('div', 'rowline mt-s');
    if (f.sheets.length > 1) {
      var lb = el('label', 'lbl', 'Sheet');
      lb.style.margin = '0';
      var sel = el('select');
      f.sheets.forEach(function (n) {
        var o = el('option', null, n);
        o.value = n;
        if (n === f.sheet) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = function (ev) { ev.stopPropagation(); loadSheet(side, sel.value, null); };
      sel.onclick = function (ev) { ev.stopPropagation(); };
      var wrap = el('div');
      wrap.appendChild(lb);
      wrap.appendChild(sel);
      r1.appendChild(wrap);
    } else {
      r1.appendChild(el('div', 'meta', 'Sheet: ' + f.sheet));
    }

    var hw = el('div');
    var hl = el('label', 'lbl', 'Dòng tiêu đề (0 = không có)');
    hl.style.margin = '0';
    var hi = el('input');
    hi.type = 'number';
    hi.min = '0';
    hi.title = 'Đặt 0 nếu file không có dòng tiêu đề — cột sẽ được gọi là Cột 1, Cột 2…';
    hi.value = String(f.headerIdx + 1);
    hi.style.width = '74px';
    hi.onclick = function (ev) { ev.stopPropagation(); };
    hi.onchange = function (ev) {
      ev.stopPropagation();
      var v = Math.max(0, parseInt(hi.value, 10) || 0) - 1;
      loadSheet(side, f.sheet, Math.min(v, Math.max(-1, f.aoa.length - 1)));
    };
    hw.appendChild(hl);
    hw.appendChild(hi);
    r1.appendChild(hw);
    box.appendChild(r1);

    box.appendChild(el('div', 'meta mt-s',
      f.table.rows.length.toLocaleString('vi-VN') + ' dòng × ' + f.table.headers.length + ' cột'));
    box.appendChild(el('div', 'meta', 'Cột: ' + f.table.headers.slice(0, 6).join(', ')
      + (f.table.headers.length > 6 ? ' …' : '')));
  }

  /* ---------- tùy chọn ---------- */

  /* Nhớ cách ghép cột người dùng đã chọn, theo "chữ ký" tên cột của 2 file,
     để lần sau mở 2 file cùng cấu trúc là dùng lại được ngay. */
  function mapKey() {
    return 'dc-map:' + state.A.table.headers.join('|') + ' >> ' + state.B.table.headers.join('|');
  }

  function saveMap() {
    try {
      localStorage.setItem(mapKey(), JSON.stringify({
        cols: state.cols.map(function (c) { return { a: c.a, b: c.b, role: c.role }; }),
        matchMode: state.cfg.matchMode,
        keyMode: state.cfg.keyMode
      }));
      state.usedSaved = true;
    } catch (e) { /* trình duyệt chặn lưu thì thôi, không sao */ }
  }

  function loadMap() {
    try {
      var raw = localStorage.getItem(mapKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function forgetMap() {
    try { localStorage.removeItem(mapKey()); } catch (e) {}
    state.usedSaved = false;
  }

  function rebuildCols(fresh) {
    var A = state.A.table, B = state.B.table;
    state.usedSaved = false;

    if (!fresh) {
      var saved = loadMap();
      if (saved && saved.cols && saved.cols.length === A.headers.length) {
        state.cfg.matchMode = saved.matchMode || state.cfg.matchMode;
        state.cfg.keyMode = saved.keyMode || state.cfg.keyMode;
        state.match = DC.matchColumnsSmart(A, B, state.cfg, state.cfg.matchMode);
        state.cols = saved.cols.map(function (c) {
          var b = (c.b != null && c.b < B.headers.length) ? c.b : null;
          return { a: c.a, b: b, how: b == null ? '' : 'bạn đã chọn lần trước', role: b == null ? 'skip' : c.role };
        });
        state.usedSaved = true;
        return;
      }
    }

    state.match = DC.matchColumnsSmart(A, B, state.cfg, state.cfg.matchMode);
    var sug = DC.suggestKeys(A, B, state.match.pairs, state.cfg);
    var isKey = {};
    sug.keys.forEach(function (i) { isKey[i] = true; });
    var byA = {};
    state.match.pairs.forEach(function (p, i) { byA[p.a] = { p: p, i: i }; });

    state.cols = [];
    for (var a = 0; a < A.headers.length; a++) {
      var hit = byA[a];
      state.cols.push(hit
        ? { a: a, b: hit.p.b, how: hit.p.how, role: isKey[hit.i] ? 'key' : 'cmp' }
        : { a: a, b: null, how: '', role: 'skip' });
    }
  }

  var ROLES = [['key', 'Cột khóa'], ['cmp', 'Đem ra so'], ['skip', 'Bỏ qua']];

  /* Vài giá trị thật trong cột, để nhìn là biết cột đó chứa gì — quan trọng khi
     tên cột không nói lên điều gì (Column1, F3…). */
  function sampleValues(table, col, n) {
    var out = [], seen = {};
    for (var i = 0; i < table.rows.length && out.length < n; i++) {
      var v = table.rows[i][col];
      if (DC.isBlank(v)) continue;
      var t = fmtCell(v);
      if (t.length > 16) t = t.slice(0, 15) + '…';
      if (seen[t]) continue;
      seen[t] = true;
      out.push(t);
    }
    return out;
  }

  function samplesOf(side) {
    var f = state[side];
    if (!f.samples) {
      f.samples = f.table.headers.map(function (_, j) { return sampleValues(f.table, j, 3); });
    }
    return f.samples;
  }

  function renderOptions() {
    var box = $('optsBox');
    if (!state.A || !state.B || !state.cols.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');

    var A = state.A.table, B = state.B.table;
    var sA = samplesOf('A'), sB = samplesOf('B');
    var used = {};
    state.cols.forEach(function (c) { if (c.b != null) used[c.b] = true; });

    $('fMatch').value = state.cfg.matchMode;
    $('fKey').value = state.cfg.keyMode;

    var host = $('colMap');
    clear(host);
    var wrap = el('div', 'tbl-wrap map-wrap');
    var tbl = el('table');
    var thead = el('thead'), htr = el('tr');
    ['Cột ở file 1', 'Dữ liệu trong cột đó', 'Ghép với cột ở file 2', 'Vai trò', 'Máy ghép theo']
      .forEach(function (h) { htr.appendChild(el('th', null, h)); });
    thead.appendChild(htr);
    tbl.appendChild(thead);

    var tb = el('tbody');
    state.cols.forEach(function (c) {
      var tr = el('tr', c.role === 'key' ? 'is-key' : (c.role === 'skip' ? 'is-skip' : null));
      tr.appendChild(el('td', 'key', A.headers[c.a]));
      tr.appendChild(el('td', 'how', sA[c.a].join(' · ') || '(trống)'));

      var sel = el('select');
      var none = el('option', null, '— không ghép —');
      none.value = '';
      sel.appendChild(none);
      B.headers.forEach(function (h, j) {
        var ex = sB[j].slice(0, 2).join(' · ');
        var o = el('option', null, h + (ex ? '  ·  ' + ex : '') + (used[j] && c.b !== j ? '  (đang dùng)' : ''));
        o.value = String(j);
        if (c.b === j) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = function () {
        var v = sel.value === '' ? null : parseInt(sel.value, 10);
        if (v != null) {
          state.cols.forEach(function (o) {
            if (o !== c && o.b === v) { o.b = null; o.role = 'skip'; o.how = ''; }
          });
        }
        c.b = v;
        c.how = v == null ? '' : 'bạn tự chọn';
        if (v == null) c.role = 'skip';
        else if (c.role === 'skip') c.role = 'cmp';
        saveMap();
        renderOptions();
        run(true);
      };
      var tdSel = el('td');
      tdSel.appendChild(sel);
      tr.appendChild(tdSel);

      var rs = el('select');
      ROLES.forEach(function (r) {
        var o = el('option', null, r[1]);
        o.value = r[0];
        if (c.role === r[0]) o.selected = true;
        rs.appendChild(o);
      });
      rs.disabled = c.b == null;
      rs.onchange = function () {
        c.role = rs.value;
        saveMap();
        renderOptions();
        run(true);
      };
      var tdRole = el('td');
      tdRole.appendChild(rs);
      tr.appendChild(tdRole);

      tr.appendChild(el('td', 'how', c.how || '—'));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    host.appendChild(wrap);

    var free = [];
    B.headers.forEach(function (h, j) { if (!used[j]) free.push(h); });
    $('unmatched').textContent = free.length
      ? 'Cột của file 2 chưa ghép với cột nào: ' + free.join(' · ')
      : 'Mọi cột của file 2 đều đã được ghép.';
    $('memNote').textContent = state.usedSaved
      ? 'Đã nhớ cách ghép này cho 2 file cùng cấu trúc — lần sau mở lên là dùng lại ngay.'
      : '';
  }

  function bindFlags() {
    var map = {
      fTol: 'tol', fCase: 'ignoreCase', fSpace: 'ignoreSpace', fDia: 'ignoreDiacritics',
      fDate: 'dateIgnoreTime', fZero: 'stripLeadingZeros', fAgg: 'aggregateDup'
    };
    Object.keys(map).forEach(function (id) {
      var node = $(id), key = map[id];
      if (!node) return;
      if (node.type === 'checkbox') node.checked = !!state.cfg[key];
      else node.value = String(state.cfg[key]);
      node.onchange = function () {
        if (node.type === 'checkbox') state.cfg[key] = node.checked;
        else {
          var n = parseFloat(String(node.value).replace(',', '.'));
          state.cfg[key] = isFinite(n) && n >= 0 ? n : 0;
        }
        run(true);
      };
    });
    [['fMatch', 'matchMode'], ['fKey', 'keyMode']].forEach(function (pair) {
      var node = $(pair[0]), key = pair[1];
      if (!node) return;
      node.value = state.cfg[key];
      node.onchange = function () {
        state.cfg[key] = node.value;
        if (key === 'matchMode') { forgetMap(); run(false, true); }
        else { saveMap(); run(true); }
      };
    });
    $('btnAuto').onclick = function () { forgetMap(); run(false, true); };
    $('btnClear').onclick = function () {
      state.cols.forEach(function (c) { c.b = null; c.role = 'skip'; c.how = ''; });
      saveMap();
      renderOptions();
      run(true);
      $('optsBox').open = true;
    };
  }

  /* ---------- chạy đối chiếu ---------- */

  function setStatus(msg, spin) {
    var s = $('status');
    clear(s);
    if (!msg) { s.classList.add('hidden'); return; }
    s.classList.remove('hidden');
    if (spin) s.appendChild(el('span', 'spin'));
    s.appendChild(document.createTextNode(' ' + msg));
  }

  function showError(msg) {
    var e = $('error');
    e.textContent = msg || '';
    e.classList.toggle('hidden', !msg);
  }

  var runTimer = null, pendingRemap = false;
  function run(debounce, remap) {
    if (remap) pendingRemap = true;
    if (runTimer) clearTimeout(runTimer);
    runTimer = setTimeout(function () {
      var r = pendingRemap;
      pendingRemap = false;
      doRun(r);
    }, debounce ? 180 : 0);
  }

  function doRun(remap) {
    var A = state.A, B = state.B;
    if (!A || !B || !A.table || !B.table) {
      state.result = null;
      state.match = null;
      state.cols = [];
      $('resultBox').classList.add('hidden');
      $('optsBox').classList.add('hidden');
      setStatus(A || B ? 'Chọn thêm 1 file nữa để bắt đầu đối chiếu.' : '');
      return;
    }
    if (!A.table.rows.length || !B.table.rows.length) {
      showError('Một trong hai file không có dòng dữ liệu nào. Hãy kiểm tra lại ô "Dòng tiêu đề" (đặt 0 nếu file không có dòng tiêu đề).');
      $('resultBox').classList.add('hidden');
      return;
    }

    setStatus('Đang đối chiếu …', true);
    setTimeout(function () {
      try {
        if (remap || !state.cols.length) rebuildCols();

        var keyPairs = [], valuePairs = [];
        state.cols.forEach(function (c) {
          if (c.b == null || c.role === 'skip') return;
          (c.role === 'key' ? keyPairs : valuePairs).push({ a: c.a, b: c.b });
        });

        var byRow = state.cfg.keyMode === 'rowOrder';
        renderOptions();

        if (!byRow && !keyPairs.length) {
          showError('Chưa có cột khóa để ghép dòng của 2 file. Ở bảng "Cột nào so với cột nào" bên dưới, '
            + 'đặt vai trò "Cột khóa" cho một cột — hoặc đổi "Ghép dòng của 2 file theo" sang "Thứ tự dòng".');
          $('optsBox').open = true;
          $('resultBox').classList.add('hidden');
          setStatus('');
          return;
        }
        if (!valuePairs.length) {
          showError('Chưa có cột nào để so sánh giá trị. Hãy đặt vai trò "Đem ra so" cho ít nhất một cột.');
          $('optsBox').open = true;
          $('resultBox').classList.add('hidden');
          setStatus('');
          return;
        }

        var cfg = DC.withDefaults(state.cfg);
        cfg.keyPairs = keyPairs;
        cfg.valuePairs = valuePairs;
        state.result = DC.compare(A.table, B.table, cfg);
        state.shown = {};
        showError('');
        renderResult();
        setStatus('');
      } catch (e) {
        setStatus('');
        showError('Lỗi khi đối chiếu: ' + (e && e.message ? e.message : e));
      }
    }, 10);
  }

  /* ---------- kết quả ---------- */

  var TABS = [
    { id: 'diffs', name: 'Lệch giá trị' },
    { id: 'onlyA', name: 'Chỉ có ở file 1' },
    { id: 'onlyB', name: 'Chỉ có ở file 2' },
    { id: 'dups', name: 'Khóa trùng lặp' },
    { id: 'cols', name: 'Theo cột' }
  ];

  function tabCount(id) {
    var r = state.result;
    if (!r) return 0;
    if (id === 'diffs') return r.diffs.length;
    if (id === 'onlyA') return r.onlyA.length;
    if (id === 'onlyB') return r.onlyB.length;
    if (id === 'dups') return r.dups.length;
    return r.colStats.length;
  }

  function renderResult() {
    var r = state.result;
    $('resultBox').classList.remove('hidden');

    var s = r.summary;
    var cards = $('statCards');
    clear(cards);
    [
      ['ok', s.identical, 'dòng khớp hoàn toàn'],
      ['bad', s.differing, 'dòng lệch giá trị'],
      ['warn', s.onlyA, 'chỉ có ở file 1'],
      ['warn', s.onlyB, 'chỉ có ở file 2'],
      ['info', s.dupKeys, 'khóa bị trùng lặp'],
      ['', s.rowsA + ' / ' + s.rowsB, 'tổng dòng F1 / F2']
    ].forEach(function (c) {
      var d = el('div', 'stat ' + c[0]);
      d.appendChild(el('div', 'n', typeof c[1] === 'number' ? c[1].toLocaleString('vi-VN') : c[1]));
      d.appendChild(el('div', 'k', c[2]));
      cards.appendChild(d);
    });

    var msg = 'Khóa đối chiếu: ' + r.keyNames.join(' + ')
      + ' · so sánh ' + r.colStats.length + ' cột'
      + (s.aggregated ? ' · đang gộp dòng trùng khóa' : '');
    $('keyInfo').textContent = msg;

    var tabs = $('tabs');
    clear(tabs);
    TABS.forEach(function (t) {
      var b = el('button', 'tab');
      b.setAttribute('aria-selected', state.tab === t.id ? 'true' : 'false');
      b.appendChild(document.createTextNode(t.name));
      b.appendChild(el('span', 'c', tabCount(t.id).toLocaleString('vi-VN')));
      b.onclick = function () { state.tab = t.id; renderResult(); };
      tabs.appendChild(b);
    });

    renderTable();
  }

  function filterRows(rows, toText) {
    var q = plain(state.q).trim();
    if (!q) return rows;
    return rows.filter(function (r) { return plain(toText(r)).indexOf(q) >= 0; });
  }

  function makeTable(headers, rows, rowFn, emptyMsg) {
    var host = $('tblWrap');
    clear(host);
    if (!rows.length) {
      host.appendChild(el('div', 'empty', emptyMsg));
      return;
    }
    var shown = state.shown[state.tab] || PAGE;
    var wrap = el('div', 'tbl-wrap');
    var t = el('table');
    var thead = el('thead'), tr = el('tr');
    headers.forEach(function (h) { tr.appendChild(el('th', null, h)); });
    thead.appendChild(tr);
    t.appendChild(thead);
    var tb = el('tbody');
    for (var i = 0; i < Math.min(shown, rows.length); i++) tb.appendChild(rowFn(rows[i], i));
    t.appendChild(tb);
    wrap.appendChild(t);
    host.appendChild(wrap);

    if (rows.length > shown) {
      var m = el('div', 'more');
      var b = el('button', 'btn', 'Hiện thêm ' + Math.min(PAGE * 2, rows.length - shown).toLocaleString('vi-VN')
        + ' dòng (còn ' + (rows.length - shown).toLocaleString('vi-VN') + ')');
      b.onclick = function () {
        state.shown[state.tab] = shown + PAGE * 2;
        renderTable();
      };
      m.appendChild(b);
      host.appendChild(m);
    }
  }

  function td(txt, cls) { return el('td', cls || null, txt); }

  function renderTable() {
    var r = state.result;
    if (!r) return;

    if (state.tab === 'diffs') {
      var flat = [];
      r.diffs.forEach(function (d) {
        d.cells.forEach(function (c) { flat.push({ key: d.key, c: c }); });
      });
      var rows = filterRows(flat, function (x) {
        return x.key + ' ' + x.c.col + ' ' + fmtCell(x.c.a) + ' ' + fmtCell(x.c.b);
      });
      makeTable(['Khóa', 'Cột', 'File 1', 'File 2', 'Chênh lệch'], rows, function (x) {
        var tr = el('tr');
        tr.appendChild(td(x.key, 'key'));
        var c2 = td(x.c.col);
        if (x.c.reason) {
          c2.appendChild(document.createTextNode(' '));
          c2.appendChild(el('span', 'pill', x.c.reason));
        }
        tr.appendChild(c2);
        tr.appendChild(td(fmtCell(x.c.a), 'va'));
        tr.appendChild(td(fmtCell(x.c.b), 'vb'));
        tr.appendChild(td(fmtDelta(x.c.delta), 'delta'));
        return tr;
      }, 'Không có ô nào lệch giá trị. 🎉');
      return;
    }

    if (state.tab === 'onlyA' || state.tab === 'onlyB') {
      var side = state.tab === 'onlyA' ? 'A' : 'B';
      var hdrs = state[side].table.headers;
      var list = state.tab === 'onlyA' ? r.onlyA : r.onlyB;
      var rows2 = filterRows(list, function (x) {
        return x.key + ' ' + x.row.map(fmtCell).join(' ');
      });
      makeTable(['Khóa'].concat(hdrs).concat(['Ghi chú']), rows2, function (x) {
        var tr = el('tr');
        tr.appendChild(td(x.key, 'key'));
        for (var i = 0; i < hdrs.length; i++) {
          var v = x.row[i];
          tr.appendChild(td(fmtCell(v), typeof v === 'number' ? 'num' : null));
        }
        var n = el('td');
        if (x.note) n.appendChild(el('span', 'pill', x.note));
        tr.appendChild(n);
        return tr;
      }, state.tab === 'onlyA'
        ? 'Mọi dòng của file 1 đều có mặt ở file 2.'
        : 'Mọi dòng của file 2 đều có mặt ở file 1.');
      return;
    }

    if (state.tab === 'dups') {
      var rows3 = filterRows(r.dups, function (x) { return x.key; });
      makeTable(['Khóa', 'Số dòng ở file 1', 'Số dòng ở file 2'], rows3, function (x) {
        var tr = el('tr');
        tr.appendChild(td(x.key, 'key'));
        tr.appendChild(td(String(x.countA), 'num'));
        tr.appendChild(td(String(x.countB), 'num'));
        return tr;
      }, 'Không có khóa nào bị trùng lặp — mỗi khóa chỉ xuất hiện 1 lần ở mỗi file.');
      return;
    }

    var rows4 = filterRows(r.colStats, function (x) { return x.name + ' ' + x.nameB; });
    makeTable(['Cột', 'Kiểu', 'Số ô lệch', 'Tổng file 1', 'Tổng file 2', 'Chênh lệch'], rows4, function (x) {
      var tr = el('tr');
      tr.appendChild(td(x.name === x.nameB ? x.name : x.name + ' ↔ ' + x.nameB, 'key'));
      tr.appendChild(td(x.numeric ? 'số' : 'chữ'));
      tr.appendChild(td(x.diffCount.toLocaleString('vi-VN'), 'num'));
      tr.appendChild(td(x.sumA == null ? '' : fmtNumber(x.sumA), 'num'));
      tr.appendChild(td(x.sumB == null ? '' : fmtNumber(x.sumB), 'num'));
      tr.appendChild(td(x.delta == null ? '' : fmtDelta(x.delta), 'delta'));
      return tr;
    }, 'Không có cột nào được so sánh.');
  }

  /* ---------- xuất Excel ---------- */

  function exportXlsx() {
    var r = state.result;
    if (!r) return;
    var wb = XL.utils.book_new();
    var s = r.summary;

    var sum = [
      ['KẾT QUẢ ĐỐI CHIẾU EXCEL'],
      ['Thời điểm', new Date()],
      ['File 1', state.A.name + ' — sheet "' + state.A.sheet + '"'],
      ['File 2', state.B.name + ' — sheet "' + state.B.sheet + '"'],
      ['Cột khóa', r.keyNames.join(' + ')],
      ['Gộp dòng trùng khóa', s.aggregated ? 'Có' : 'Không'],
      ['Dung sai số', state.cfg.tol],
      [],
      ['Chỉ tiêu', 'Số lượng'],
      ['Tổng dòng file 1', s.rowsA],
      ['Tổng dòng file 2', s.rowsB],
      ['Dòng ghép được', s.matched],
      ['Dòng khớp hoàn toàn', s.identical],
      ['Dòng lệch giá trị', s.differing],
      ['Chỉ có ở file 1', s.onlyA],
      ['Chỉ có ở file 2', s.onlyB],
      ['Khóa bị trùng lặp', s.dupKeys],
      [],
      ['Cột', 'Kiểu', 'Số ô lệch', 'Tổng file 1', 'Tổng file 2', 'Chênh lệch']
    ];
    r.colStats.forEach(function (c) {
      sum.push([c.name === c.nameB ? c.name : c.name + ' ↔ ' + c.nameB,
        c.numeric ? 'số' : 'chữ', c.diffCount, c.sumA, c.sumB, c.delta]);
    });
    XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(sum), 'Tóm tắt');

    var d = [['Khóa', 'Cột', 'Giá trị file 1', 'Giá trị file 2', 'Chênh lệch', 'Ghi chú']];
    r.diffs.forEach(function (x) {
      x.cells.forEach(function (c) {
        d.push([x.key, c.col, c.a, c.b, c.delta, c.reason || '']);
      });
    });
    XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(d), 'Lệch giá trị');

    [['onlyA', 'A', 'Chỉ có ở file 1'], ['onlyB', 'B', 'Chỉ có ở file 2']].forEach(function (cfg) {
      var hdrs = state[cfg[1]].table.headers;
      var aoa = [['Khóa'].concat(hdrs).concat(['Ghi chú'])];
      r[cfg[0]].forEach(function (x) {
        aoa.push([x.key].concat(x.row).concat([x.note || '']));
      });
      XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(aoa), cfg[2]);
    });

    var du = [['Khóa', 'Số dòng file 1', 'Số dòng file 2']];
    r.dups.forEach(function (x) { du.push([x.key, x.countA, x.countB]); });
    XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(du), 'Khóa trùng lặp');

    var now = new Date();
    var stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate())
      + '-' + pad(now.getHours()) + pad(now.getMinutes());
    saveWorkbook(wb, 'ket-qua-doi-chieu-' + stamp + '.xlsx');
  }

  /* Tải file về: mở trực tiếp thì dùng cách thường; xem qua link claude.ai thì
     phải xin phép người xem mới lưu được. */
  function saveWorkbook(wb, filename) {
    function direct() { XL.writeFile(wb, filename); }
    var c = window.claude;
    if (!c || typeof c.use !== 'function') { direct(); return; }

    setStatus('Đang chuẩn bị file kết quả …', true);
    c.use('downloads').then(function (dl) {
      if (!dl) {
        setStatus('Bản xem online không cho tải file. Hãy mở file doi-chieu-excel.html trên máy để tải kết quả.');
        return;
      }
      return dl.save({
        filename: filename,
        data: XL.write(wb, { bookType: 'xlsx', type: 'array' })
      }).then(function () { setStatus(''); }, function (err) {
        var code = err && err.code;
        if (code === 'declined') { setStatus(''); return; }
        setStatus('Không tải được file' + (err && err.message ? ': ' + err.message : '') + '.');
      });
    }, function () { setStatus(''); direct(); });
  }

  /* ---------- dữ liệu mẫu ---------- */

  function demo() {
    var A = [
      ['CÔNG TY TNHH ABC'],
      ['BẢNG KÊ XUẤT KHO THÁNG 9/2026'],
      [],
      ['STT', 'Mã vật tư', 'Tên vật tư', 'Đơn vị', 'Số lượng', 'Đơn giá', 'Thành tiền'],
      [1, 'VT-001', 'Bulong M10', 'Con', 500, 1500, 750000],
      [2, 'VT-002', 'Vòng bi 6204', 'Cái', 20, 85000, 1700000],
      [3, 'VT-003', 'Dây curoa A45', 'Sợi', 12, 120000, 1440000],
      [4, 'VT-004', 'Mỡ bò chịu nhiệt', 'Hộp', 8, 95000, 760000],
      [5, 'VT-005', 'Cầu chì 10A', 'Cái', 100, 3500, 350000],
      [6, 'VT-006', 'Công tắc hành trình', 'Cái', 6, 180000, 1080000]
    ];
    var B = [
      ['Ma vat tu', 'Ten vat tu', 'DVT', 'SL', 'Don gia', 'Amount', 'Kho'],
      ['VT-001', 'Bulong M10', 'Con', 500, 1500, 750000, 'Kho A'],
      ['VT-002', 'Vòng bi 6204', 'Cái', 18, 85000, 1530000, 'Kho A'],
      ['VT-003', 'Dây curoa A45', 'Sợi', 12, 125000, 1500000, 'Kho B'],
      ['VT-005', 'Cầu chì 10A', 'Cái', 100, 3500, 350000, 'Kho B'],
      ['VT-007', 'Rơ le trung gian', 'Cái', 4, 210000, 840000, 'Kho A']
    ];
    function mk(aoa, name, sheet) {
      var wb = XL.utils.book_new();
      XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(aoa), sheet);
      return { name: name, wb: wb, sheets: [sheet], sheet: sheet, headerIdx: null, aoa: null, table: null };
    }
    state.A = mk(A, 'mau-xuat-kho.xlsx', 'Xuat kho');
    state.B = mk(B, 'mau-the-kho.xlsx', 'The kho');
    loadSheet('A', 'Xuat kho', null);
    loadSheet('B', 'The kho', null);
  }

  /* ---------- khởi tạo ---------- */

  function bindDrop(side) {
    var box = $('drop' + side), input = $('file' + side);
    box.onclick = function () { if (!state[side]) input.click(); };
    box.ondragover = function (e) { e.preventDefault(); box.classList.add('over'); };
    box.ondragleave = function () { box.classList.remove('over'); };
    box.ondrop = function (e) {
      e.preventDefault();
      box.classList.remove('over');
      var fs = e.dataTransfer && e.dataTransfer.files;
      if (!fs || !fs.length) return;
      // thả 2 file một lúc vào 1 ô: nhận cả hai
      readFile(side, fs[0]);
      if (fs.length > 1) readFile(side === 'A' ? 'B' : 'A', fs[1]);
    };
    input.onchange = function () {
      if (input.files && input.files[0]) readFile(side, input.files[0]);
      input.value = '';
    };
  }

  function init() {
    bindDrop('A');
    bindDrop('B');
    bindFlags();
    renderCard('A');
    renderCard('B');

    $('search').oninput = function () {
      state.q = $('search').value;
      state.shown[state.tab] = PAGE;
      renderTable();
    };
    $('btnExport').onclick = exportXlsx;
    $('btnDemo').onclick = demo;
    $('btnTheme').onclick = function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var dark = cur ? cur === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
      try { localStorage.setItem('dc-theme', dark ? 'light' : 'dark'); } catch (e) {}
    };
    try {
      var saved = localStorage.getItem('dc-theme');
      if (saved) document.documentElement.setAttribute('data-theme', saved);
    } catch (e) {}

    document.body.ondragover = function (e) { e.preventDefault(); };
    document.body.ondrop = function (e) {
      e.preventDefault();
      var fs = e.dataTransfer && e.dataTransfer.files;
      if (!fs || !fs.length) return;
      var side = !state.A ? 'A' : (!state.B ? 'B' : 'A');
      readFile(side, fs[0]);
      if (fs.length > 1) readFile(side === 'A' ? 'B' : 'A', fs[1]);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
