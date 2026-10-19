// ===== Giả lập dịch vụ Google Apps Script (dùng cho bản xem thử và kiểm tra) =====
// SpreadsheetApp, CacheService, LockService, PropertiesService, Utilities,
// ContentService, MailApp, UrlFetchApp, ScriptApp, Session.
var __clock = { off: 0 };               // lệch giờ giả (ms), để kiểm tra
var __tz = { off: 7 * 3600000 };         // múi giờ của formatDate (mặc định +07:00)
var __mail = [];                         // thư đã gửi
var __net = { log: [], reply: null };    // yêu cầu mạng đã gửi; reply(url, opt) để giả trả lời
var __triggers = [];

var SpreadsheetApp = (function () {
  function Sheet(name) {
    this.name = name; this.data = []; this.fmt = {}; this.maxRows = 1000; this.maxCols = 26; this.frozen = 0;
  }
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.getLastRow = function () {
    for (var i = this.data.length - 1; i >= 0; i--) {
      var r = this.data[i];
      if (r && r.some(function (v) { return v !== '' && v !== null && v !== undefined; })) return i + 1;
    }
    return 0;
  };
  Sheet.prototype.getMaxRows = function () { return this.maxRows; };
  Sheet.prototype.getMaxColumns = function () { return this.maxCols; };
  Sheet.prototype.insertColumnsAfter = function (after, n) { this.maxCols += n; return this; };
  Sheet.prototype.insertRowsAfter = function (after, n) { this.maxRows += n; return this; };
  Sheet.prototype.setFrozenRows = function (n) { this.frozen = n; return this; };
  Sheet.prototype.setColumnWidth = function () { return this; };
  Sheet.prototype.autoResizeColumns = function () { return this; };
  Sheet.prototype.appendRow = function (arr) {
    var r = this.getLastRow() + 1; if (r > this.maxRows) this.maxRows = r;
    this.getRange(r, 1, 1, arr.length).setValues([arr]); return this;
  };
  Sheet.prototype.getRange = function (row, col, nr, nc) {
    if (typeof row === 'string') throw new Error('A1 notation not supported in mock');
    nr = nr || 1; nc = nc || 1;
    if (row < 1 || col < 1 || row + nr - 1 > this.maxRows || col + nc - 1 > this.maxCols) {
      throw new Error('Range outside sheet: ' + row + ',' + col + ',' + nr + ',' + nc);
    }
    return new Range(this, row, col, nr, nc);
  };
  Sheet.prototype.getDataRange = function () {
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), this.maxCols);
  };
  Sheet.prototype.setName = function (n) { this.name = n; return this; };
  Sheet.prototype.clearContents = function () { this.data = []; return this; };
  Sheet.prototype.clear = Sheet.prototype.clearContents;
  // Chép trang sang file khác (giống Google: tên "Bản sao của …")
  Sheet.prototype.copyTo = function (book) {
    var t = book.insertSheet('Bản sao của ' + this.name);
    t.data = this.data.map(function (r) { return (r || []).map(function (v) { return v instanceof Date ? new Date(v.getTime()) : v; }); });
    t.fmt = Object.assign({}, this.fmt); t.maxRows = this.maxRows; t.maxCols = this.maxCols; t.frozen = this.frozen;
    return t;
  };

  function Range(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  Range.prototype.getValues = function () {
    var out = [];
    for (var i = 0; i < this.nr; i++) {
      var row = this.sh.data[this.r - 1 + i] || [];
      var o = [];
      for (var j = 0; j < this.nc; j++) {
        var v = row[this.c - 1 + j];
        o.push(v === undefined || v === null ? '' : v);
      }
      out.push(o);
    }
    return out;
  };
  Range.prototype.getValue = function () { return this.getValues()[0][0]; };
  Range.prototype.clearContent = function () {
    for (var i = 0; i < this.nr; i++) { var row = this.sh.data[this.r - 1 + i]; if (!row) continue; for (var j = 0; j < this.nc; j++) row[this.c - 1 + j] = ''; }
    return this;
  };
  Range.prototype.setValues = function (vals) {
    if (vals.length !== this.nr) throw new Error('Row count mismatch');
    for (var i = 0; i < this.nr; i++) {
      if (vals[i].length !== this.nc) throw new Error('Column count mismatch');
      var ri = this.r - 1 + i;
      while (this.sh.data.length <= ri) this.sh.data.push([]);
      for (var j = 0; j < this.nc; j++) {
        var v = vals[i][j];
        if (typeof v === 'string' && v.charAt(0) === "'") v = v.slice(1); // dấu ' = ghi chữ
        // Giống Google Sheets: ô không định dạng chữ mà ghi 'yyyy-mm-dd' thì thành ngày
        var f = this.sh.fmt[this.c + j];
        if (typeof v === 'string' && f !== '@' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
          v = new Date(v + 'T00:00:00+07:00');
        }
        this.sh.data[ri][this.c - 1 + j] = v;
      }
    }
    return this;
  };
  Range.prototype.setValue = function (v) {
    var a = []; for (var i = 0; i < this.nr; i++) { var r = []; for (var j = 0; j < this.nc; j++) r.push(v); a.push(r); }
    return this.setValues(a);
  };
  Range.prototype.setNumberFormat = function (f) {
    for (var j = 0; j < this.nc; j++) this.sh.fmt[this.c + j] = f;
    return this;
  };
  Range.prototype.setNumberFormats = function (fs) {
    for (var j = 0; j < this.nc; j++) if (!this.sh.fmt[this.c + j]) this.sh.fmt[this.c + j] = fs[0][j];
    return this;
  };
  ['setFontWeight', 'setBackground', 'setFontColor', 'setWrap', 'setHorizontalAlignment',
    'setVerticalAlignment', 'setFontSize'].forEach(function (k) {
    Range.prototype[k] = function () { return this; };
  });

  function Book(id, name) { this.id = id; this.nm = name; this.sheets = []; }
  Book.prototype.getSheetByName = function (n) { for (var i = 0; i < this.sheets.length; i++) if (this.sheets[i].name === n) return this.sheets[i]; return null; };
  Book.prototype.insertSheet = function (n) { var s = new Sheet(n); this.sheets.push(s); return s; };
  Book.prototype.getSheets = function () { return this.sheets.slice(); };
  Book.prototype.deleteSheet = function (sh) { if (this.sheets.length < 2) throw new Error('Cannot delete the only sheet'); this.sheets = this.sheets.filter(function (x) { return x !== sh; }); };
  Book.prototype.getName = function () { return this.nm; };
  Book.prototype.getId = function () { return this.id; };
  Book.prototype.getUrl = function () { return 'https://docs.google.com/spreadsheets/d/' + this.id; };
  var ss = new Book('demo-sheet', 'Lịch Bảo Dưỡng'), books = {};
  return {
    getActive: function () { return ss; },
    getActiveSpreadsheet: function () { return ss; },
    create: function (name) {
      var id = 'SS' + Math.random().toString(36).slice(2, 14), b = new Book(id, name);
      b.insertSheet('Trang tính1'); books[id] = b;
      DriveApp.__addFile(id, name, 'application/vnd.google-apps.spreadsheet');
      return b;
    },
    openById: function (id) { if (!books[id]) throw new Error('Spreadsheet not found'); return books[id]; },
    __books: books,
    __reset: function () { ss.sheets = []; Object.keys(books).forEach(function (k) { delete books[k]; }); }
  };
})();

var CacheService = (function () {
  var store = {};
  var c = {
    get: function (k) { var o = store[k]; if (!o) return null; if (o.exp < Date.now() + __clock.off) { delete store[k]; return null; } return o.v; },
    put: function (k, v, sec) { store[k] = { v: String(v), exp: Date.now() + __clock.off + (sec || 600) * 1000 }; },
    remove: function (k) { delete store[k]; },
    __clear: function () { store = {}; }
  };
  return { getScriptCache: function () { return c; } };
})();

var LockService = (function () {
  var l = { tryLock: function () { return true; }, waitLock: function () {}, releaseLock: function () {} };
  return { getScriptLock: function () { return l; } };
})();

var PropertiesService = (function () {
  var p = {};
  var sp = {
    getProperty: function (k) { return Object.prototype.hasOwnProperty.call(p, k) ? p[k] : null; },
    setProperty: function (k, v) { p[k] = String(v); return sp; },
    deleteProperty: function (k) { delete p[k]; return sp; },
    getProperties: function () { return Object.assign({}, p); },
    __clear: function () { p = {}; }
  };
  return { getScriptProperties: function () { return sp; } };
})();

var Utilities = (function () {
  // SHA-256 thuần JS (đồng bộ)
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(s) { return Array.from(new TextEncoder().encode(String(s))); }
  function sha256(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var m = bytes.slice(); var bl = bytes.length * 8;
    m.push(0x80); while (m.length % 64 !== 56) m.push(0);
    for (var i = 7; i >= 0; i--) m.push(Math.floor(bl / Math.pow(2, i * 8)) & 255);
    var w = new Array(64);
    for (var o = 0; o < m.length; o += 64) {
      for (var t = 0; t < 16; t++) w[t] = (m[o + t * 4] << 24) | (m[o + t * 4 + 1] << 16) | (m[o + t * 4 + 2] << 8) | m[o + t * 4 + 3];
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = [];
    H.forEach(function (v) { out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); });
    return out;
  }
  function signed(arr) { return arr.map(function (b) { return b > 127 ? b - 256 : b; }); }
  function unsigned(arr) { return arr.map(function (b) { return b < 0 ? b + 256 : b; }); }
  function hmac(msg, key) {
    var k = utf8(key); if (k.length > 64) k = sha256(k);
    while (k.length < 64) k.push(0);
    var ip = k.map(function (b) { return b ^ 0x36; }), op = k.map(function (b) { return b ^ 0x5c; });
    return sha256(op.concat(sha256(ip.concat(utf8(msg)))));
  }
  function b64(bytes, safe) {
    var A = safe ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var s = '', i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += A[(n >> 18) & 63] + A[(n >> 12) & 63] + A[(n >> 6) & 63] + A[n & 63];
    }
    var r = bytes.length - i;
    if (r === 1) { var n1 = bytes[i] << 16; s += A[(n1 >> 18) & 63] + A[(n1 >> 12) & 63] + '=='; }
    if (r === 2) { var n2 = (bytes[i] << 16) | (bytes[i + 1] << 8); s += A[(n2 >> 18) & 63] + A[(n2 >> 12) & 63] + A[(n2 >> 6) & 63] + '='; }
    return s;
  }
  function pad(n, l) { n = String(n); while (n.length < (l || 2)) n = '0' + n; return n; }
  return {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest: function (alg, s) { return signed(sha256(utf8(s))); },
    computeHmacSha256Signature: function (v, k) { return signed(hmac(v, k)); },
    base64EncodeWebSafe: function (bytes) { return b64(unsigned(Array.from(bytes)), true); },
    base64Encode: function (bytes) { return b64(unsigned(Array.from(bytes)), false); },
    getUuid: function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      });
    },
    // Múi giờ cố định theo __tz.off (mặc định +07:00 = Asia/Ho_Chi_Minh)
    formatDate: function (d, tz, f) {
      var x = new Date(d.getTime() + __tz.off);
      return f.replace('yyyy', x.getUTCFullYear()).replace('yy', String(x.getUTCFullYear()).slice(2)).replace('MM', pad(x.getUTCMonth() + 1))
        .replace('dd', pad(x.getUTCDate())).replace('HH', pad(x.getUTCHours()))
        .replace('mm', pad(x.getUTCMinutes())).replace('ss', pad(x.getUTCSeconds()));
    },
    base64Decode: function (s) {
      var bin = atob(String(s).replace(/\s/g, '')); var out = new Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
    },
    newBlob: function (bytes, contentType, name) {
      return {
        data: bytes || [], type: contentType || 'application/octet-stream', nm: name || 'file',
        getBytes: function () { return this.data; }, getName: function () { return this.nm; },
        setName: function (n) { this.nm = n; return this; }, getContentType: function () { return this.type; }
      };
    },
    sleep: function () {}
  };
})();

var ContentService = {
  MimeType: { JSON: 'application/json' },
  createTextOutput: function (s) { return { s: s, setMimeType: function () { return this; }, getContent: function () { return this.s; } }; }
};

var MailApp = {
  sendEmail: function (o) { if (__net.mailFails) throw new Error('Mail quota'); __mail.push(o); },
  getRemainingDailyQuota: function () { return 100; }
};

// Google Dịch giả: chỉ dịch được các câu mẫu trong __dichMau ([tiếng Việt, tiếng Trung]); câu khác trả lời dòng báo "bản xem thử".
// __dich.loi = true để giả lập Google hết hạn mức; __dich.goi đếm số lần gọi.
var __dichMau = [];
var __dich = { loi: false, goi: 0 };
var LanguageApp = {
  translate: function (text, from, to) {
    __dich.goi++;
    if (__dich.loi) throw new Error('Service invoked too many times for one day: translate.');
    var t = String(text || '').trim(), k = t.toLowerCase();
    for (var i = 0; i < __dichMau.length; i++) {
      var m = __dichMau[i];
      if (m[0].toLowerCase() === k || m[1] === t) return to === 'vi' ? m[0] : m[1];
    }
    return to === 'vi' ? '(Bản xem thử: hệ thống thật sẽ tự dịch câu này)' : '（演示版：正式系统会自动翻译这句话）';
  }
};

var UrlFetchApp = {
  fetch: function (url, opt) {
    __net.log.push({ url: url, opt: opt });
    var r = __net.reply ? __net.reply(url, opt) : null;
    if (!r) {
      if (/getUpdates/.test(url)) r = { code: 200, body: { ok: true, result: [
        { update_id: 1, message: { chat: { id: -100123, type: 'supergroup', title: 'Tổ bảo trì 维修组' } } },
        { update_id: 2, message: { chat: { id: 555, type: 'private', first_name: 'Admin' } } }] } };
      else r = { code: 200, body: { ok: true, result: { message_id: 1 } } };
    }
    return { getResponseCode: function () { return r.code; }, getContentText: function () { return JSON.stringify(r.body); } };
  }
};

var ScriptApp = (function () {
  function builder(fn) {
    var t = { fn: fn, hour: null, tz: null };
    var b = {
      timeBased: function () { return b; }, everyDays: function () { return b; },
      atHour: function (h) { t.hour = h; return b; }, nearMinute: function () { return b; },
      inTimezone: function (z) { t.tz = z; return b; },
      create: function () { var o = { getHandlerFunction: function () { return fn; }, hour: t.hour, id: Math.random() }; __triggers.push(o); return o; }
    };
    return b;
  }
  return {
    newTrigger: builder,
    getProjectTriggers: function () { return __triggers.slice(); },
    deleteTrigger: function (tr) { var i = __triggers.indexOf(tr); if (i >= 0) __triggers.splice(i, 1); }
  };
})();

var Session = {
  getScriptTimeZone: function () { return 'Asia/Ho_Chi_Minh'; },
  getEffectiveUser: function () { return { getEmail: function () { return 'owner@example.com'; } }; }
};
var DriveApp = (function () {
  var folders = {}, files = {};
  function File(id, name, bytes, parent, mime) {
    this.id = id; this.nm = name; this.bytes = bytes; this.shared = false; this.parent = parent; this.mime = mime || 'image/jpeg';
    this.created = new Date(Date.now() + __clock.off + (__seq++)); this.trashed = false;
  }
  var __seq = 0;
  File.prototype.getId = function () { return this.id; };
  File.prototype.getParents = function () { var a = this.parent ? [this.parent] : [], i = 0; return { hasNext: function () { return i < a.length; }, next: function () { return a[i++]; } }; };
  File.prototype.getBlob = function () { return Utilities.newBlob(this.bytes, this.mime, this.nm); };
  File.prototype.getMimeType = function () { return this.mime; };
  File.prototype.getSize = function () { return this.sz === undefined || this.sz === null ? (this.bytes || []).length : this.sz; };
  File.prototype.getDateCreated = function () { return this.created; };
  File.prototype.isTrashed = function () { return this.trashed; };
  File.prototype.setTrashed = function (v) { this.trashed = !!v; return this; };
  File.prototype.moveTo = function (folder) { this.parent = folder; return this; };
  File.prototype.getName = function () { return this.nm; };
  File.prototype.setName = function (n) { this.nm = n; return this; };
  File.prototype.setSharing = function () { this.shared = true; return this; };
  File.prototype.getUrl = function () { return 'https://drive.google.com/file/d/' + this.id + '/view'; };
  function Folder(id, name, parent) { this.id = id; this.nm = name; this.parent = parent || null; }
  Folder.prototype.getId = function () { return this.id; };
  Folder.prototype.getParents = function () { var a = this.parent ? [this.parent] : [], i = 0; return { hasNext: function () { return i < a.length; }, next: function () { return a[i++]; } }; };
  Folder.prototype.createFolder = function (name) {
    var id = 'FL' + Math.random().toString(36).slice(2, 10), f = new Folder(id, name, this); folders[id] = f; return f;
  };
  Folder.prototype.getFolders = function () {
    var me = this, a = Object.keys(folders).map(function (k) { return folders[k]; }).filter(function (f) { return f.parent === me; }), i = 0;
    return { hasNext: function () { return i < a.length; }, next: function () { return a[i++]; } };
  };
  Folder.prototype.getName = function () { return this.nm; };
  Folder.prototype.getUrl = function () { return 'https://drive.google.com/drive/folders/' + this.id; };
  Folder.prototype.createFile = function (blob) {
    var id = 'DF' + Math.random().toString(36).slice(2, 14);
    var f = new File(id, blob.getName ? blob.getName() : 'anh.jpg', blob.getBytes ? blob.getBytes() : [], this, blob.getContentType ? blob.getContentType() : '');
    files[id] = f; return f;
  };
  Folder.prototype.getFiles = function () {
    var me = this, a = Object.keys(files).map(function (k) { return files[k]; }).filter(function (f) { return f.parent === me; }), i = 0;
    return { hasNext: function () { return i < a.length; }, next: function () { return a[i++]; } };
  };
  return {
    createFolder: function (name) { var id = 'FL' + Math.random().toString(36).slice(2, 10); var f = new Folder(id, name); folders[id] = f; return f; },
    getFolderById: function (id) { if (!folders[id]) throw new Error('folder not found'); return folders[id]; },
    getFileById: function (id) { if (!files[id]) throw new Error('file not found'); return files[id]; },
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', PRIVATE: 'PRIVATE' },
    Permission: { VIEW: 'VIEW', EDIT: 'EDIT' },
    __addFile: function (id, name, mime) { files[id] = new File(id, name, [], null, mime); return files[id]; },
    __addFileIn: function (folder, name, mime, size) {
      var id = 'DF' + Math.random().toString(36).slice(2, 14), f = new File(id, name, [], folder, mime);
      f.sz = size || 0; files[id] = f; return f;
    },
    __files: files, __reset: function () { folders = {}; files = {}; }
  };
})();
