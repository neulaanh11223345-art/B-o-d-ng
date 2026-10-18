import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const DC = require('../src/core.js');
const XLSX = require('../vendor/xlsx.full.min.js');

const TMP = path.join(path.dirname(fileURLToPath(import.meta.url)), '.tmp');
fs.mkdirSync(TMP, { recursive: true });

function tableOf(aoa) {
  const h = DC.detectHeaderRow(aoa);
  return DC.buildTable(aoa, h);
}

test('đọc số kiểu Việt Nam và kiểu Anh', () => {
  assert.equal(DC.parseNumberLoose('1.234,56'), 1234.56);
  assert.equal(DC.parseNumberLoose('1,234.56'), 1234.56);
  assert.equal(DC.parseNumberLoose('1.234'), 1234);
  assert.equal(DC.parseNumberLoose('1,234'), 1234);
  assert.equal(DC.parseNumberLoose('12,5'), 12.5);
  assert.equal(DC.parseNumberLoose('12.5'), 12.5);
  assert.equal(DC.parseNumberLoose('(1.200)'), -1200);
  assert.equal(DC.parseNumberLoose('1.200.000 đ'), 1200000);
  assert.equal(DC.parseNumberLoose('10%'), 0.1);
  assert.equal(DC.parseNumberLoose('abc'), null);
  assert.equal(DC.parseNumberLoose(''), null);
  assert.equal(DC.parseNumberLoose('MH-001'), null);
});

test('dò đúng dòng tiêu đề khi file có dòng tên công ty / tiêu đề báo cáo', () => {
  const aoa = [
    ['CÔNG TY TNHH ABC', null, null],
    ['BẢNG KÊ HÀNG HÓA THÁNG 9', null, null],
    [null, null, null],
    ['Mã hàng', 'Tên hàng', 'Số lượng'],
    ['A1', 'Bulong', 10],
    ['A2', 'Vòng bi', 5]
  ];
  assert.equal(DC.detectHeaderRow(aoa), 3);
  const t = DC.buildTable(aoa, 3);
  assert.deepEqual(t.headers, ['Mã hàng', 'Tên hàng', 'Số lượng']);
  assert.equal(t.rows.length, 2);
});

test('ghép cột theo tên giống, tên đồng nghĩa và tên gần giống', () => {
  const m = DC.matchColumns(
    ['Mã hàng', 'Tên hàng', 'Số lượng', 'Thành tiền', 'Ghi chú riêng A'],
    ['Ma hang', 'Tên  hàng', 'SL', 'Amount', 'Kho']
  );
  const map = {};
  m.pairs.forEach(p => { map[p.a] = p.b; });
  assert.equal(map[0], 0, 'Mã hàng ↔ Ma hang');
  assert.equal(map[1], 1, 'Tên hàng ↔ Tên  hàng');
  assert.equal(map[2], 2, 'Số lượng ↔ SL');
  assert.equal(map[3], 3, 'Thành tiền ↔ Amount');
  assert.deepEqual(m.onlyA, [4]);
  assert.deepEqual(m.onlyB, [4]);
});

test('tự chọn cột khóa là mã, không chọn STT', () => {
  const A = tableOf([
    ['STT', 'Mã hàng', 'Tên hàng', 'Số lượng'],
    [1, 'A1', 'Bulong', 10],
    [2, 'A2', 'Vòng bi', 5],
    [3, 'A3', 'Dây curoa', 7]
  ]);
  const B = tableOf([
    ['STT', 'Mã hàng', 'Tên hàng', 'Số lượng'],
    [1, 'A3', 'Dây curoa', 7],
    [2, 'A1', 'Bulong', 12],
    [3, 'A2', 'Vòng bi', 5]
  ]);
  const m = DC.matchColumns(A.headers, B.headers);
  const s = DC.suggestKeys(A, B, m.pairs);
  const keyCols = s.keys.map(i => A.headers[m.pairs[i].a]);
  assert.deepEqual(keyCols, ['Mã hàng']);
});

test('đối chiếu đầy đủ: lệch giá trị, chỉ có ở 1 bên', () => {
  const A = tableOf([
    ['Mã hàng', 'Tên hàng', 'Số lượng', 'Thành tiền'],
    ['A1', 'Bulong', 10, 100000],
    ['A2', 'Vòng bi', 5, 500000],
    ['A3', 'Dây curoa', 7, 70000]
  ]);
  const B = tableOf([
    ['Mã hàng', 'Tên hàng', 'Số lượng', 'Thành tiền'],
    ['A1', 'Bulong', 12, 120000],
    ['A2', 'Vòng bi', 5, 500000],
    ['A4', 'Mỡ bò', 2, 40000]
  ]);
  const out = DC.autoCompare(A, B);
  const r = out.result;
  assert.equal(r.keyNames.join(), 'Mã hàng');
  assert.equal(r.summary.matched, 2);
  assert.equal(r.summary.identical, 1);
  assert.equal(r.summary.differing, 1);
  assert.equal(r.summary.onlyA, 1);
  assert.equal(r.summary.onlyB, 1);
  assert.equal(r.onlyA[0].key, 'A3');
  assert.equal(r.onlyB[0].key, 'A4');
  const d = r.diffs[0];
  assert.equal(d.key, 'A1');
  assert.equal(d.cells.length, 2);
  assert.equal(d.cells[0].delta, -2);
  const tien = r.colStats.find(c => c.name === 'Thành tiền');
  assert.equal(tien.diffCount, 1);
  assert.equal(tien.delta, -20000);
});

test('mã "001" và số 1 được coi là cùng một khóa', () => {
  const A = tableOf([['Mã', 'Số tiền'], ['001', 100], ['002', 200]]);
  const B = tableOf([['Mã', 'Số tiền'], [1, 100], [2, 250]]);
  const r = DC.autoCompare(A, B).result;
  assert.equal(r.summary.onlyA, 0);
  assert.equal(r.summary.onlyB, 0);
  assert.equal(r.summary.differing, 1);
});

test('dung sai: chênh lệch 0,004 coi như khớp, 0,5 là lệch', () => {
  const A = tableOf([['Mã', 'Tiền'], ['X', 10.004], ['Y', 20.5]]);
  const B = tableOf([['Mã', 'Tiền'], ['X', 10.0], ['Y', 20.0]]);
  const m = DC.matchColumns(A.headers, B.headers);
  const r = DC.compare(A, B, {
    keyPairs: [m.pairs[0]], valuePairs: [m.pairs[1]], tol: 0.01
  });
  assert.equal(r.summary.differing, 1);
  assert.equal(r.diffs[0].key, 'Y');
});

test('chữ hoa/chữ thường và khoảng trắng thừa không tính là lệch', () => {
  const A = tableOf([['Mã', 'Tên'], ['X', 'Bơm  nước'], ['Y', 'Quạt']]);
  const B = tableOf([['Mã', 'Tên'], ['X', 'bơm nước'], ['Y', 'Quạt']]);
  const r = DC.autoCompare(A, B).result;
  assert.equal(r.summary.differing, 0);
  assert.equal(r.summary.identical, 2);
});

test('khóa trùng lặp: báo cáo và ghép theo thứ tự, dòng dư đưa ra riêng', () => {
  const A = tableOf([['Mã', 'SL'], ['X', 1], ['X', 2], ['Y', 3]]);
  const B = tableOf([['Mã', 'SL'], ['X', 1], ['Y', 3]]);
  const m = DC.matchColumns(A.headers, B.headers);
  const r = DC.compare(A, B, { keyPairs: [m.pairs[0]], valuePairs: [m.pairs[1]] });
  assert.equal(r.summary.dupKeys, 1);
  assert.equal(r.summary.onlyA, 1);
  assert.equal(r.onlyA[0].note, 'dòng trùng khóa dư ở file 1');
});

test('gộp dòng trùng khóa thì cộng số lượng lại rồi mới so', () => {
  const A = tableOf([['Mã', 'SL'], ['X', 4], ['X', 6], ['Y', 3]]);
  const B = tableOf([['Mã', 'SL'], ['X', 10], ['Y', 3]]);
  const m = DC.matchColumns(A.headers, B.headers);
  const r = DC.compare(A, B, {
    keyPairs: [m.pairs[0]], valuePairs: [m.pairs[1]], aggregateDup: true
  });
  assert.equal(r.summary.differing, 0);
  assert.equal(r.summary.identical, 2);
  assert.equal(r.summary.dupKeys, 1);
});

test('khóa ghép 2 cột khi một cột không đủ phân biệt', () => {
  const A = tableOf([
    ['Ngày', 'Mã KH', 'Số tiền'],
    ['2026-01-01', 'KH1', 100],
    ['2026-01-01', 'KH2', 200],
    ['2026-01-02', 'KH1', 300]
  ]);
  const B = tableOf([
    ['Ngày', 'Mã KH', 'Số tiền'],
    ['2026-01-02', 'KH1', 300],
    ['2026-01-01', 'KH1', 150],
    ['2026-01-01', 'KH2', 200]
  ]);
  const out = DC.autoCompare(A, B);
  assert.equal(out.keyPairs.length, 2);
  assert.equal(out.result.summary.matched, 3);
  assert.equal(out.result.summary.differing, 1);
});

test('đọc file .xlsx thật rồi đối chiếu', () => {
  const wbA = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbA, XLSX.utils.aoa_to_sheet([
    ['BÁO CÁO TỒN KHO'],
    [],
    ['Mã vật tư', 'Tên vật tư', 'Số lượng', 'Đơn giá'],
    ['VT-01', 'Bulong M10', 100, 1500],
    ['VT-02', 'Vòng bi 6204', 20, 85000]
  ]), 'Ton kho');
  const fA = path.join(TMP, 'dc-test-a.xlsx');
  fs.writeFileSync(fA, XLSX.write(wbA, { type: 'buffer', bookType: 'xlsx' }));

  const wbB = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbB, XLSX.utils.aoa_to_sheet([
    ['Ma vat tu', 'Ten vat tu', 'SL', 'Don gia'],
    ['VT-01', 'Bulong M10', 100, 1500],
    ['VT-02', 'Vòng bi 6204', 18, 85000],
    ['VT-03', 'Mỡ bò', 5, 60000]
  ]), 'Sheet1');
  const fB = path.join(TMP, 'dc-test-b.xlsx');
  fs.writeFileSync(fB, XLSX.write(wbB, { type: 'buffer', bookType: 'xlsx' }));

  function read(f) {
    const wb = XLSX.read(fs.readFileSync(f), { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    return tableOf(aoa);
  }
  const r = DC.autoCompare(read(fA), read(fB)).result;
  assert.equal(r.keyNames.join(), 'Mã vật tư');
  assert.equal(r.summary.matched, 2);
  assert.equal(r.summary.differing, 1);
  assert.equal(r.summary.onlyB, 1);
  assert.equal(r.diffs[0].key, 'VT-02');
  assert.equal(r.diffs[0].cells[0].delta, 2);
});

test('cột lộn xộn + tên cột vô nghĩa + dòng lộn xộn: ghép theo nội dung', () => {
  const A = tableOf([
    ['Column1', 'Column2', 'Column3', 'Column4'],
    ['VT-003', 'Dây curoa', 12, 1440000],
    ['VT-001', 'Bulong M10', 500, 750000],
    ['VT-002', 'Vòng bi', 20, 1700000]
  ]);
  const B = tableOf([
    ['F1', 'F2', 'F3', 'F4'],
    [750000, 'Bulong M10', 500, 'VT-001'],
    [1530000, 'Vòng bi', 18, 'VT-002'],
    [1440000, 'Dây curoa', 12, 'VT-003']
  ]);
  const out = DC.autoCompare(A, B);
  const map = {};
  out.match.pairs.forEach((p) => { map[A.headers[p.a]] = B.headers[p.b]; });
  assert.deepEqual(map, { Column1: 'F4', Column2: 'F2', Column3: 'F3', Column4: 'F1' });
  assert.equal(out.result.keyNames.join(), 'Column1');
  assert.equal(out.result.summary.identical, 2);
  assert.equal(out.result.summary.differing, 1);
  assert.equal(out.result.diffs[0].key, 'VT-002');
});

test('file không có dòng tiêu đề (headerIdx = -1)', () => {
  const t = DC.buildTable([['A1', 10], ['A2', 20]], -1);
  assert.deepEqual(t.headers, ['Cột 1', 'Cột 2']);
  assert.equal(t.rows.length, 2);
  assert.equal(t.noHeader, true);
});

test('ghép cột theo thứ tự khi mọi cách khác bó tay', () => {
  const A = tableOf([['x', 'y'], ['a', 1], ['b', 2]]);
  const B = tableOf([['p', 'q'], ['a', 1], ['b', 2]]);
  const m = DC.matchColumnsSmart(A, B, {}, 'order');
  assert.deepEqual(m.pairs.map((p) => [p.a, p.b]), [[0, 0], [1, 1]]);
  assert.equal(m.pairs[0].how, 'cùng thứ tự cột');
});

test('chỉ ghép theo tên: bỏ qua nội dung', () => {
  const A = tableOf([['Mã', 'Số tiền'], ['X', 10]]);
  const B = tableOf([['Số tiền', 'Mã'], [10, 'X']]);
  const m = DC.matchColumnsSmart(A, B, {}, 'name');
  const map = {};
  m.pairs.forEach((p) => { map[A.headers[p.a]] = B.headers[p.b]; });
  assert.deepEqual(map, { 'Mã': 'Mã', 'Số tiền': 'Số tiền' });
});

test('không có cột khóa nào: so theo thứ tự dòng', () => {
  const A = tableOf([['Giá trị'], ['a'], ['b'], ['c']]);
  const B = tableOf([['Giá trị'], ['a'], ['x'], ['c']]);
  const m = DC.matchColumnsSmart(A, B, {}, 'auto');
  const r = DC.compare(A, B, { keyMode: 'rowOrder', keyPairs: [], valuePairs: m.pairs });
  assert.equal(r.keyNames.join(), '(theo thứ tự dòng)');
  assert.equal(r.summary.matched, 3);
  assert.equal(r.summary.differing, 1);
  assert.equal(r.diffs[0].key, 'Dòng 2');
});

test('ghép theo nội dung không nhầm cột số với cột chữ', () => {
  const A = tableOf([['c1', 'c2'], ['100', 'xin chào'], ['200', 'tạm biệt']]);
  const B = tableOf([['d1', 'd2'], ['xin chào', '100'], ['tạm biệt', '200']]);
  const m = DC.matchColumnsSmart(A, B, {}, 'content');
  const map = {};
  m.pairs.forEach((p) => { map[A.headers[p.a]] = B.headers[p.b]; });
  assert.deepEqual(map, { c1: 'd2', c2: 'd1' });
});
