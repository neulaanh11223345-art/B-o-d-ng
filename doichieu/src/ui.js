/* Đối chiếu Excel — giao diện */
(function () {
  'use strict';

  var DC = window.DoiChieu, XL = window.XLSX;
  var PAGE = 300;

  var state = {
    A: null, B: null,
    match: null,
    keySel: [], valSel: [],
    autoKey: true,
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
        state[side] = { name: file.name, wb: wb, sheets: names, sheet: pick, headerIdx: null, aoa: null, table: null };
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
    state.autoKey = true;
    renderCard(side);
    run();
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
      state.autoKey = true;
      renderCard(side);
      run();
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
    var hl = el('label', 'lbl', 'Dòng tiêu đề');
    hl.style.margin = '0';
    var hi = el('input');
    hi.type = 'number';
    hi.min = '1';
    hi.value = String(f.headerIdx + 1);
    hi.style.width = '74px';
    hi.onclick = function (ev) { ev.stopPropagation(); };
    hi.onchange = function (ev) {
      ev.stopPropagation();
      var v = Math.max(1, parseInt(hi.value, 10) || 1) - 1;
      loadSheet(side, f.sheet, Math.min(v, Math.max(0, f.aoa.length - 1)));
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

  function pairLabel(p) {
    var a = state.A.table.headers[p.a], b = state.B.table.headers[p.b];
    return a === b ? a : a + ' ↔ ' + b;
  }

  function renderOptions() {
    var box = $('optsBox');
    if (!state.match) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');

    var kl = $('keyList'), vl = $('valList');
    clear(kl); clear(vl);

    state.match.pairs.forEach(function (p, i) {
      [['k', kl, state.keySel], ['v', vl, state.valSel]].forEach(function (cfgRow) {
        var kind = cfgRow[0], host = cfgRow[1], sel = cfgRow[2];
        var lab = el('label');
        var cb = el('input');
        cb.type = 'checkbox';
        cb.checked = sel.indexOf(i) >= 0;
        cb.onchange = function () {
          var arr = kind === 'k' ? state.keySel : state.valSel;
          var at = arr.indexOf(i);
          if (cb.checked && at < 0) arr.push(i);
          if (!cb.checked && at >= 0) arr.splice(at, 1);
          arr.sort(function (x, y) { return x - y; });
          if (kind === 'k') {
            state.autoKey = false;
            // cột đã là khóa thì không so sánh giá trị nữa
            var vat = state.valSel.indexOf(i);
            if (cb.checked && vat >= 0) state.valSel.splice(vat, 1);
            if (!cb.checked && vat < 0) state.valSel.push(i);
            state.valSel.sort(function (x, y) { return x - y; });
          }
          renderOptions();
          run(true);
        };
        var t = el('span');
        t.appendChild(document.createTextNode(pairLabel(p)));
        if (p.how !== 'tên giống nhau') {
          t.appendChild(el('span', 'how', ' (' + p.how + ')'));
        }
        lab.appendChild(cb);
        lab.appendChild(t);
        host.appendChild(lab);
      });
    });

    var un = [];
    state.match.onlyA.forEach(function (i) { un.push('F1: ' + state.A.table.headers[i]); });
    state.match.onlyB.forEach(function (i) { un.push('F2: ' + state.B.table.headers[i]); });
    $('unmatched').textContent = un.length
      ? 'Cột không ghép được (bỏ qua khi so): ' + un.join(' · ')
      : 'Mọi cột của 2 file đều ghép được với nhau.';
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
    $('btnAuto').onclick = function () { state.autoKey = true; run(); };
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

  var runTimer = null;
  function run(debounce) {
    if (runTimer) clearTimeout(runTimer);
    runTimer = setTimeout(doRun, debounce ? 180 : 0);
  }

  function doRun() {
    var A = state.A, B = state.B;
    if (!A || !B || !A.table || !B.table) {
      state.result = null;
      state.match = null;
      $('resultBox').classList.add('hidden');
      $('optsBox').classList.add('hidden');
      setStatus(A || B ? 'Chọn thêm 1 file nữa để bắt đầu đối chiếu.' : '');
      return;
    }
    if (!A.table.rows.length || !B.table.rows.length) {
      showError('Một trong hai file không có dòng dữ liệu nào bên dưới dòng tiêu đề. Hãy kiểm tra lại số "Dòng tiêu đề".');
      $('resultBox').classList.add('hidden');
      return;
    }

    setStatus('Đang đối chiếu …', true);
    setTimeout(function () {
      try {
        if (state.autoKey || !state.match) {
          state.match = DC.matchColumns(A.table.headers, B.table.headers);
          var sug = DC.suggestKeys(A.table, B.table, state.match.pairs, state.cfg);
          state.keySel = sug.keys.slice();
          state.valSel = [];
          state.match.pairs.forEach(function (p, i) {
            if (state.keySel.indexOf(i) < 0) state.valSel.push(i);
          });
        }
        if (!state.keySel.length) {
          showError('Chưa tìm được cột khóa chung giữa 2 file. Hãy mở "Tùy chọn đối chiếu" và tự chọn cột khóa.');
          renderOptions();
          $('resultBox').classList.add('hidden');
          setStatus('');
          return;
        }
        var cfg = DC.withDefaults(state.cfg);
        cfg.keyPairs = state.keySel.map(function (i) { return state.match.pairs[i]; });
        cfg.valuePairs = state.valSel.map(function (i) { return state.match.pairs[i]; });
        state.result = DC.compare(A.table, B.table, cfg);
        state.shown = {};
        showError('');
        renderOptions();
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
    XL.writeFile(wb, 'ket-qua-doi-chieu-' + stamp + '.xlsx');
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
