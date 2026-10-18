/* Đối chiếu Excel — lõi xử lý (thuần JS, không phụ thuộc DOM).
   Dùng được cả trong trình duyệt (window.DoiChieu) và Node (module.exports). */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.DoiChieu = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- tiện ích chuỗi ---------- */

  function stripDiacritics(s) {
    return String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  function normHeader(s) {
    return stripDiacritics(s == null ? '' : s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /* Từ đồng nghĩa hay gặp trong file Việt Nam / tiếng Anh */
  var SYNONYM = {
    'sl': 'so luong', 'qty': 'so luong', 'quantity': 'so luong', 'so luong': 'so luong',
    'kl': 'khoi luong', 'khoi luong': 'khoi luong',
    'dvt': 'don vi', 'don vi tinh': 'don vi', 'unit': 'don vi', 'uom': 'don vi', 'don vi': 'don vi',
    'ma': 'ma', 'ma so': 'ma', 'code': 'ma', 'id': 'ma', 'ma hang': 'ma', 'ma vat tu': 'ma',
    'ma sp': 'ma', 'ma san pham': 'ma', 'sku': 'ma', 'item code': 'ma', 'item': 'ma',
    'ma kh': 'ma kh', 'ma khach hang': 'ma kh', 'customer code': 'ma kh',
    'ma nv': 'ma nv', 'ma nhan vien': 'ma nv',
    'ten': 'ten', 'name': 'ten', 'ten hang': 'ten', 'ten san pham': 'ten', 'ten vat tu': 'ten',
    'dien giai': 'dien giai', 'description': 'dien giai', 'mo ta': 'dien giai', 'noi dung': 'dien giai',
    'don gia': 'don gia', 'price': 'don gia', 'unit price': 'don gia', 'gia': 'don gia',
    'thanh tien': 'so tien', 'amount': 'so tien', 'so tien': 'so tien', 'tong tien': 'so tien',
    'total': 'so tien', 'gia tri': 'so tien', 'tong cong': 'so tien',
    'ngay': 'ngay', 'date': 'ngay', 'ngay thang': 'ngay', 'ngay ct': 'ngay', 'ngay chung tu': 'ngay',
    'so hoa don': 'so chung tu', 'invoice': 'so chung tu', 'invoice no': 'so chung tu',
    'so hd': 'so chung tu', 'so ct': 'so chung tu', 'so chung tu': 'so chung tu', 'so phieu': 'so chung tu',
    'tai khoan': 'tai khoan', 'account': 'tai khoan', 'tk': 'tai khoan',
    'no': 'stt', 'stt': 'stt', 'num': 'stt', 'so tt': 'stt', 'thu tu': 'stt', 'index': 'stt', 'tt': 'stt'
  };

  function canonHeader(s) {
    var n = normHeader(s);
    return SYNONYM[n] || n;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  /* Độ giống của 2 tên cột: 0..1 */
  function headerSimilarity(a, b) {
    var na = normHeader(a), nb = normHeader(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (canonHeader(a) === canonHeader(b)) return 0.97;
    var ta = na.split(' ').filter(Boolean), tb = nb.split(' ').filter(Boolean);
    var setB = {}, k;
    for (k = 0; k < tb.length; k++) setB[tb[k]] = true;
    var inter = 0;
    for (k = 0; k < ta.length; k++) if (setB[ta[k]]) inter++;
    var jac = inter / (ta.length + tb.length - inter);
    var lev = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
    return Math.max(jac * 0.95, lev);
  }

  /* ---------- đọc số / ngày ---------- */

  /* Đọc số từ chuỗi kiểu Việt Nam ("1.234,56"), kiểu Anh ("1,234.56"),
     số âm trong ngoặc "(1.200)", có ký hiệu tiền tệ, có %. */
  function parseNumberLoose(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'boolean' || v instanceof Date) return null;
    var s = String(v).trim();
    if (!s) return null;
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    var pct = /%\s*$/.test(s);
    s = s.replace(/[\s\u00a0\u202f]/g, '').replace(/%/g, '');
    s = s.replace(/^[₫$€£¥]/, '').replace(/[₫$€£¥]$/, '');
    s = s.replace(/(?:vn[dđ]|usd|đồng|dong)$/i, '');
    if (/[0-9][đd]$/i.test(s)) s = s.slice(0, -1);
    if (/^[-+]/.test(s)) { if (s[0] === '-') neg = !neg; s = s.slice(1); }
    if (!/^[0-9.,]*$/.test(s) || !/[0-9]/.test(s)) return null;

    var hasDot = s.indexOf('.') >= 0, hasCom = s.indexOf(',') >= 0, dec = null;
    if (hasDot && hasCom) {
      dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    } else if (hasDot || hasCom) {
      var sep = hasDot ? '.' : ',';
      var parts = s.split(sep);
      var tail = parts[parts.length - 1];
      var digits = s.replace(/[.,]/g, '').length;
      // "1.234" / "1,234": nhóm cuối đúng 3 số và tổng ≥ 4 số → dấu phân cách nghìn
      if (parts.length > 2) dec = null;
      else if (tail.length === 3 && digits >= 4 && parts[0].length <= 3) dec = null;
      else dec = sep;
    }
    var out;
    if (dec === null) out = s.replace(/[.,]/g, '');
    else {
      var other = dec === '.' ? ',' : '.';
      out = s.split(other).join('').replace(dec, '.');
    }
    var n = parseFloat(out);
    if (!isFinite(n)) return null;
    if (pct) n = n / 100;
    return neg ? -n : n;
  }

  function isBlank(v) {
    return v == null || (typeof v === 'string' && v.trim() === '');
  }

  function fmtNum(n) {
    if (Math.abs(n) < 1e-10) return '0';
    var r = Math.round(n * 1e10) / 1e10;
    return String(r);
  }

  function toDate(v) {
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    return null;
  }

  function dateKey(d, ignoreTime) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var s = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    if (!ignoreTime) s += ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    return s;
  }

  /* ---------- dò dòng tiêu đề & dựng bảng ---------- */

  function detectHeaderRow(rows, maxScan) {
    maxScan = Math.min(maxScan || 30, rows.length);
    var best = 0, bestScore = -Infinity;
    for (var i = 0; i < maxScan; i++) {
      var r = rows[i] || [];
      var nonEmpty = 0, strings = 0, seen = {}, distinct = 0;
      for (var j = 0; j < r.length; j++) {
        var v = r[j];
        if (isBlank(v)) continue;
        nonEmpty++;
        if (typeof v === 'string' && v.trim().length <= 80 && parseNumberLoose(v) === null) strings++;
        var n = normHeader(v);
        if (n && !seen[n]) { seen[n] = true; distinct++; }
      }
      if (nonEmpty < 2) continue;
      var nx = rows[i + 1] || [], nxNon = 0;
      for (var k = 0; k < nx.length; k++) if (!isBlank(nx[k])) nxNon++;
      var score = strings * 2 + distinct - (nonEmpty - distinct) * 2
        + (nxNon >= nonEmpty * 0.6 ? 3 : 0) - i * 0.35;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  function buildTable(rows, headerIdx) {
    var hRow = rows[headerIdx] || [];
    var width = hRow.length;
    for (var i = headerIdx + 1; i < rows.length; i++) {
      if (rows[i] && rows[i].length > width) width = rows[i].length;
    }
    // bỏ cột rỗng hoàn toàn (không tên, không dữ liệu)
    var keep = [];
    for (var c = 0; c < width; c++) {
      var hasHeader = !isBlank(hRow[c]), hasData = false;
      for (var r = headerIdx + 1; r < rows.length; r++) {
        if (rows[r] && !isBlank(rows[r][c])) { hasData = true; break; }
      }
      if (hasHeader || hasData) keep.push(c);
    }
    var headers = [], used = {};
    for (var q = 0; q < keep.length; q++) {
      var raw = hRow[keep[q]];
      var name = isBlank(raw) ? 'Cột ' + (keep[q] + 1) : String(raw).replace(/\s+/g, ' ').trim();
      var base = name, n = 2;
      while (used[name.toLowerCase()]) { name = base + ' (' + n + ')'; n++; }
      used[name.toLowerCase()] = true;
      headers.push(name);
    }
    var data = [];
    for (var d = headerIdx + 1; d < rows.length; d++) {
      var src = rows[d] || [], out = new Array(keep.length), any = false;
      for (var m = 0; m < keep.length; m++) {
        var val = src[keep[m]];
        out[m] = val === undefined ? null : val;
        if (!isBlank(val)) any = true;
      }
      if (any) data.push(out);
    }
    return { headers: headers, rows: data, headerIdx: headerIdx, srcRowOf: null };
  }

  /* ---------- ghép cột giữa 2 file ---------- */

  function matchColumns(headersA, headersB, minSim) {
    minSim = minSim == null ? 0.8 : minSim;
    var usedA = {}, usedB = {}, pairs = [], i, j;

    function pass(keyFn, label, score) {
      var mapB = {};
      for (j = 0; j < headersB.length; j++) {
        if (usedB[j]) continue;
        var k = keyFn(headersB[j]);
        if (k && mapB[k] === undefined) mapB[k] = j;
      }
      for (i = 0; i < headersA.length; i++) {
        if (usedA[i]) continue;
        var ka = keyFn(headersA[i]);
        if (!ka) continue;
        var bj = mapB[ka];
        if (bj === undefined || usedB[bj]) continue;
        usedA[i] = usedB[bj] = true;
        delete mapB[ka];
        pairs.push({ a: i, b: bj, how: label, score: score });
      }
    }
    pass(normHeader, 'tên giống nhau', 1);
    pass(canonHeader, 'tên tương đương', 0.97);

    // mờ: chọn cặp điểm cao nhất trước
    var cands = [];
    for (i = 0; i < headersA.length; i++) {
      if (usedA[i]) continue;
      for (j = 0; j < headersB.length; j++) {
        if (usedB[j]) continue;
        var s = headerSimilarity(headersA[i], headersB[j]);
        if (s >= minSim) cands.push({ a: i, b: j, score: s });
      }
    }
    cands.sort(function (x, y) { return y.score - x.score; });
    for (var c = 0; c < cands.length; c++) {
      var p = cands[c];
      if (usedA[p.a] || usedB[p.b]) continue;
      usedA[p.a] = usedB[p.b] = true;
      pairs.push({ a: p.a, b: p.b, how: 'tên gần giống', score: p.score });
    }
    // cột cùng vị trí, cùng kiểu tên rỗng → ghép theo thứ tự còn lại
    pairs.sort(function (x, y) { return x.a - y.a; });
    var onlyA = [], onlyB = [];
    for (i = 0; i < headersA.length; i++) if (!usedA[i]) onlyA.push(i);
    for (j = 0; j < headersB.length; j++) if (!usedB[j]) onlyB.push(j);
    return { pairs: pairs, onlyA: onlyA, onlyB: onlyB };
  }

  /* ---------- khóa đối chiếu ---------- */

  var DEFAULTS = {
    tol: 0.01,
    relTol: 0,
    ignoreCase: true,
    ignoreSpace: true,
    ignoreDiacritics: false,
    dateIgnoreTime: true,
    stripLeadingZeros: true,
    keyIgnoreDiacritics: true,
    aggregateDup: false
  };

  function withDefaults(cfg) {
    var out = {}, k;
    for (k in DEFAULTS) out[k] = DEFAULTS[k];
    if (cfg) for (k in cfg) if (cfg[k] !== undefined) out[k] = cfg[k];
    return out;
  }

  function normKeyValue(v, cfg) {
    if (isBlank(v)) return '';
    var d = toDate(v);
    if (d) return dateKey(d, cfg.dateIgnoreTime);
    if (typeof v === 'number') return fmtNum(v);
    var s = String(v).trim().replace(/\s+/g, ' ');
    if (/^[0-9]+$/.test(s)) {
      return cfg.stripLeadingZeros ? s.replace(/^0+(?=[0-9])/, '') : s;
    }
    var n = parseNumberLoose(s);
    if (n !== null && /^[-+(]?[0-9.,\s]+\)?$/.test(s)) return fmtNum(n);
    if (cfg.keyIgnoreDiacritics) s = stripDiacritics(s);
    return s.toUpperCase();
  }

  function keyOf(row, cols, cfg) {
    var parts = [];
    for (var i = 0; i < cols.length; i++) parts.push(normKeyValue(row[cols[i]], cfg));
    return parts.join('\u0001');
  }

  function profileColumn(table, col, cfg) {
    var seen = {}, distinct = 0, nonEmpty = 0, numeric = 0;
    var rows = table.rows;
    for (var i = 0; i < rows.length; i++) {
      var v = rows[i][col];
      if (isBlank(v)) continue;
      nonEmpty++;
      if (typeof v === 'number' || parseNumberLoose(v) !== null) numeric++;
      var k = normKeyValue(v, cfg);
      if (!seen[k]) { seen[k] = true; distinct++; }
    }
    var total = rows.length || 1;
    return {
      set: seen,
      distinct: distinct,
      nonEmpty: nonEmpty,
      fill: nonEmpty / total,
      uniq: nonEmpty ? distinct / nonEmpty : 0,
      numericRatio: nonEmpty ? numeric / nonEmpty : 0
    };
  }

  function nameBonus(h) {
    var n = canonHeader(h), raw = normHeader(h);
    if (n === 'stt') return -0.45;
    if (n === 'ma' || n === 'ma kh' || n === 'ma nv' || n === 'so chung tu') return 0.3;
    if (/\b(ma|code|id|sku|barcode|serial|imei|mst|cccd)\b/.test(raw)) return 0.25;
    if (n === 'ten') return 0.08;
    if (n === 'ngay' || n === 'don vi' || n === 'so luong' || n === 'so tien' || n === 'don gia') return -0.2;
    return 0;
  }

  function overlapRatio(setA, setB, distinctA, distinctB) {
    var inter = 0, k;
    var small = distinctA <= distinctB ? setA : setB;
    var big = small === setA ? setB : setA;
    for (k in small) if (big[k]) inter++;
    var denom = Math.min(distinctA, distinctB) || 1;
    return inter / denom;
  }

  function suggestKeys(tA, tB, pairs, cfg) {
    cfg = withDefaults(cfg);
    var cands = [];
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      var pa = profileColumn(tA, p.a, cfg), pb = profileColumn(tB, p.b, cfg);
      if (pa.nonEmpty === 0 || pb.nonEmpty === 0) continue;
      var ov = overlapRatio(pa.set, pb.set, pa.distinct, pb.distinct);
      var base = 0.3 * ov + 0.25 * pa.uniq + 0.25 * pb.uniq + 0.1 * Math.min(pa.fill, pb.fill);
      var score = base + nameBonus(tA.headers[p.a]);
      cands.push({ pair: p, pairIdx: i, score: score, base: base, overlap: ov, pa: pa, pb: pb });
    }
    if (!cands.length) return { keys: [], candidates: [] };
    cands.sort(function (x, y) { return y.score - x.score; });
    var best = cands[0];
    var result = [best.pairIdx];

    // khóa đơn chưa đủ phân biệt → thử khóa ghép 2 cột
    if (best.pa.uniq < 0.95 || best.pb.uniq < 0.95 || best.overlap < 0.6) {
      var top = cands.slice(0, Math.min(5, cands.length));
      var bestCombo = null;
      for (var x = 0; x < top.length; x++) {
        for (var y = 0; y < top.length; y++) {
          if (x === y) continue;
          var colsA = [top[x].pair.a, top[y].pair.a], colsB = [top[x].pair.b, top[y].pair.b];
          var sA = multiProfile(tA, colsA, cfg), sB = multiProfile(tB, colsB, cfg);
          var ov2 = overlapRatio(sA.set, sB.set, sA.distinct, sB.distinct);
          var sc = 0.3 * ov2 + 0.25 * sA.uniq + 0.25 * sB.uniq + 0.1 * Math.min(sA.fill, sB.fill)
            + Math.max(nameBonus(tA.headers[colsA[0]]), nameBonus(tA.headers[colsA[1]]));
          if (!bestCombo || sc > bestCombo.score) {
            bestCombo = { score: sc, idx: [top[x].pairIdx, top[y].pairIdx], overlap: ov2, uniq: Math.min(sA.uniq, sB.uniq) };
          }
        }
      }
      if (bestCombo && bestCombo.score > best.score + 0.04) result = bestCombo.idx;
      result.sort(function (p1, p2) { return p1 - p2; });
    }
    return { keys: result, candidates: cands };
  }

  function multiProfile(table, cols, cfg) {
    var seen = {}, distinct = 0, nonEmpty = 0, rows = table.rows;
    for (var i = 0; i < rows.length; i++) {
      var k = keyOf(rows[i], cols, cfg);
      if (k.split('\u0001').join('') === '') continue;
      nonEmpty++;
      if (!seen[k]) { seen[k] = true; distinct++; }
    }
    var total = rows.length || 1;
    return {
      set: seen, distinct: distinct, nonEmpty: nonEmpty,
      fill: nonEmpty / total, uniq: nonEmpty ? distinct / nonEmpty : 0
    };
  }

  /* ---------- so sánh giá trị ---------- */

  function normTextValue(v, cfg) {
    var s = String(v);
    if (cfg.ignoreSpace) s = s.replace(/\s+/g, ' ').trim();
    if (cfg.ignoreDiacritics) s = stripDiacritics(s);
    if (cfg.ignoreCase) s = s.toLowerCase();
    return s;
  }

  function compareCell(va, vb, isNum, cfg) {
    var ba = isBlank(va), bb = isBlank(vb);
    if (ba && bb) return { equal: true };
    if (ba !== bb) return { equal: false, reason: 'thiếu dữ liệu' };

    var da = toDate(va), db = toDate(vb);
    if (da && db) {
      return { equal: dateKey(da, cfg.dateIgnoreTime) === dateKey(db, cfg.dateIgnoreTime) };
    }
    if (isNum) {
      var na = parseNumberLoose(va), nb = parseNumberLoose(vb);
      if (na !== null && nb !== null) {
        var diff = na - nb;
        var limit = Math.max(cfg.tol || 0, (cfg.relTol || 0) * Math.max(Math.abs(na), Math.abs(nb)));
        return { equal: Math.abs(diff) <= limit, delta: diff };
      }
      if (na === null && nb === null) {
        return { equal: normTextValue(va, cfg) === normTextValue(vb, cfg) };
      }
      return { equal: false, reason: 'khác kiểu dữ liệu' };
    }
    return { equal: normTextValue(va, cfg) === normTextValue(vb, cfg) };
  }

  function isNumericPair(tA, tB, pair, cfg) {
    var pa = profileColumn(tA, pair.a, cfg), pb = profileColumn(tB, pair.b, cfg);
    if (!pa.nonEmpty || !pb.nonEmpty) return false;
    return pa.numericRatio >= 0.7 && pb.numericRatio >= 0.7;
  }

  function groupByKey(table, cols, cfg) {
    var map = Object.create(null), order = [];
    for (var i = 0; i < table.rows.length; i++) {
      var k = keyOf(table.rows[i], cols, cfg);
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(i);
    }
    return { map: map, order: order };
  }

  function sumNumeric(table, idxs, col) {
    var s = 0, found = false;
    for (var i = 0; i < idxs.length; i++) {
      var n = parseNumberLoose(table.rows[idxs[i]][col]);
      if (n !== null) { s += n; found = true; }
    }
    return found ? s : null;
  }

  /**
   * Đối chiếu 2 bảng.
   * cfg: { keyPairs: [{a,b}], valuePairs: [{a,b}], ...tùy chọn }
   */
  function compare(tA, tB, cfg) {
    cfg = withDefaults(cfg);
    var keyPairs = cfg.keyPairs || [];
    var valuePairs = cfg.valuePairs || [];
    if (!keyPairs.length) throw new Error('Chưa chọn cột khóa để đối chiếu.');

    var colsA = keyPairs.map(function (p) { return p.a; });
    var colsB = keyPairs.map(function (p) { return p.b; });
    var keyNames = keyPairs.map(function (p) { return tA.headers[p.a]; });

    var cols = valuePairs.map(function (p) {
      return {
        a: p.a, b: p.b,
        name: tA.headers[p.a],
        nameB: tB.headers[p.b],
        numeric: isNumericPair(tA, tB, p, cfg),
        diffCount: 0, sumA: 0, sumB: 0, hasNum: false
      };
    });

    var gA = groupByKey(tA, colsA, cfg), gB = groupByKey(tB, colsB, cfg);
    var onlyA = [], onlyB = [], diffs = [], dups = [];
    var identical = 0, matchedRows = 0, dupKeysA = 0, dupKeysB = 0;
    var emptyKey = keyPairs.map(function () { return ''; }).join('\u0001');

    function keyLabel(k) { return k.split('\u0001').join(' | '); }

    function rowOut(table, idx) { return table.rows[idx]; }

    function compareRowPair(k, ia, ib, aggA, aggB) {
      var cells = [], anyDiff = false;
      for (var c = 0; c < cols.length; c++) {
        var col = cols[c];
        var va = aggA ? aggA[c] : rowOut(tA, ia)[col.a];
        var vb = aggB ? aggB[c] : rowOut(tB, ib)[col.b];
        var res = compareCell(va, vb, col.numeric, cfg);
        if (col.numeric) {
          var na = parseNumberLoose(va), nb = parseNumberLoose(vb);
          if (na !== null) { col.sumA += na; col.hasNum = true; }
          if (nb !== null) { col.sumB += nb; col.hasNum = true; }
        }
        if (!res.equal) {
          anyDiff = true;
          col.diffCount++;
          cells.push({
            col: col.name, colB: col.nameB, a: va, b: vb,
            delta: res.delta === undefined ? null : res.delta,
            reason: res.reason || null
          });
        }
      }
      matchedRows++;
      if (anyDiff) {
        diffs.push({
          key: keyLabel(k),
          rowA: ia === null ? null : rowOut(tA, ia),
          rowB: ib === null ? null : rowOut(tB, ib),
          cells: cells
        });
      } else identical++;
    }

    for (var i = 0; i < gA.order.length; i++) {
      var k = gA.order[i];
      var la = gA.map[k], lb = gB.map[k];
      if (la.length > 1) dupKeysA++;
      if (k === emptyKey) {
        // khóa rỗng: không thể đối chiếu, xem như chỉ có ở file tương ứng
        for (var z = 0; z < la.length; z++) onlyA.push({ key: '(khóa trống)', row: rowOut(tA, la[z]), note: 'khóa trống' });
        continue;
      }
      if (!lb) {
        for (var y = 0; y < la.length; y++) onlyA.push({ key: keyLabel(k), row: rowOut(tA, la[y]), note: null });
        continue;
      }
      if (lb.length > 1) dupKeysB++;
      if (la.length > 1 || lb.length > 1) {
        dups.push({ key: keyLabel(k), countA: la.length, countB: lb.length });
        if (cfg.aggregateDup) {
          var aggA = [], aggB = [];
          for (var c2 = 0; c2 < cols.length; c2++) {
            if (cols[c2].numeric) {
              aggA.push(sumNumeric(tA, la, cols[c2].a));
              aggB.push(sumNumeric(tB, lb, cols[c2].b));
            } else {
              aggA.push(rowOut(tA, la[0])[cols[c2].a]);
              aggB.push(rowOut(tB, lb[0])[cols[c2].b]);
            }
          }
          compareRowPair(k, la[0], lb[0], aggA, aggB);
          continue;
        }
      }
      var n = Math.min(la.length, lb.length);
      for (var m = 0; m < n; m++) compareRowPair(k, la[m], lb[m], null, null);
      for (var ea = n; ea < la.length; ea++) {
        onlyA.push({ key: keyLabel(k), row: rowOut(tA, la[ea]), note: 'dòng trùng khóa dư ở file 1' });
      }
      for (var eb = n; eb < lb.length; eb++) {
        onlyB.push({ key: keyLabel(k), row: rowOut(tB, lb[eb]), note: 'dòng trùng khóa dư ở file 2' });
      }
    }

    for (var j = 0; j < gB.order.length; j++) {
      var kb = gB.order[j];
      if (gA.map[kb]) continue;
      var lb2 = gB.map[kb];
      if (lb2.length > 1) dupKeysB++;
      for (var w = 0; w < lb2.length; w++) {
        onlyB.push({
          key: kb === emptyKey ? '(khóa trống)' : keyLabel(kb),
          row: rowOut(tB, lb2[w]),
          note: kb === emptyKey ? 'khóa trống' : null
        });
      }
    }

    var colStats = cols.map(function (c) {
      return {
        name: c.name, nameB: c.nameB, numeric: c.numeric, diffCount: c.diffCount,
        sumA: c.hasNum ? c.sumA : null,
        sumB: c.hasNum ? c.sumB : null,
        delta: c.hasNum ? c.sumA - c.sumB : null
      };
    });

    return {
      keyNames: keyNames,
      summary: {
        rowsA: tA.rows.length,
        rowsB: tB.rows.length,
        keysA: gA.order.length,
        keysB: gB.order.length,
        matched: matchedRows,
        identical: identical,
        differing: diffs.length,
        onlyA: onlyA.length,
        onlyB: onlyB.length,
        dupKeys: dups.length,
        dupKeysA: dupKeysA,
        dupKeysB: dupKeysB,
        aggregated: !!cfg.aggregateDup
      },
      colStats: colStats,
      onlyA: onlyA,
      onlyB: onlyB,
      diffs: diffs,
      dups: dups
    };
  }

  /* Chạy toàn bộ: dò cột, dò khóa, so sánh. */
  function autoCompare(tA, tB, cfg) {
    var m = matchColumns(tA.headers, tB.headers);
    var sug = suggestKeys(tA, tB, m.pairs, cfg);
    var keyPairs = sug.keys.map(function (i) { return m.pairs[i]; });
    var keySet = {};
    keyPairs.forEach(function (p) { keySet[p.a + ':' + p.b] = true; });
    var valuePairs = m.pairs.filter(function (p) { return !keySet[p.a + ':' + p.b]; });
    var merged = {};
    for (var k in cfg || {}) merged[k] = cfg[k];
    merged.keyPairs = keyPairs;
    merged.valuePairs = valuePairs;
    return {
      match: m,
      suggestion: sug,
      keyPairs: keyPairs,
      valuePairs: valuePairs,
      result: keyPairs.length ? compare(tA, tB, merged) : null
    };
  }

  return {
    stripDiacritics: stripDiacritics,
    normHeader: normHeader,
    canonHeader: canonHeader,
    headerSimilarity: headerSimilarity,
    parseNumberLoose: parseNumberLoose,
    isBlank: isBlank,
    fmtNum: fmtNum,
    detectHeaderRow: detectHeaderRow,
    buildTable: buildTable,
    matchColumns: matchColumns,
    profileColumn: profileColumn,
    multiProfile: multiProfile,
    suggestKeys: suggestKeys,
    compareCell: compareCell,
    compare: compare,
    autoCompare: autoCompare,
    withDefaults: withDefaults,
    DEFAULTS: DEFAULTS
  };
});
