import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refineWallCandidates } from './refinements.js';

function input(lines, lineWidths) {
  const width = 80, height = 60, data = new Uint8Array(width * height);
  const box = (x, y, w, h) => { for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) data[row * width + col] = 255; };
  return { width, height, mask: { data }, lines, lineWidths, strokeWidth: 5, box };
}
test('実験の線幅補正は入力を変更せず、連続した断面から厚さを補正する', () => {
  const value = input([10, 22, 65, 22], [3]); value.box(10, 20, 56, 5);
  const before = structuredClone(value.mask.data), lines = [...value.lines], widths = [...value.lineWidths];
  const result = refineWallCandidates(value, 'width');
  // 許容倍率を超える変化は無理に適用しない。
  assert.equal(result.lineWidths[0], 3);
  const supported = refineWallCandidates({ ...value, lineWidths: [4] }, 'width');
  assert.equal(supported.lineWidths[0], 5);
  assert.deepEqual(value.mask.data, before); assert.deepEqual(value.lines, lines); assert.deepEqual(value.lineWidths, widths);
});
test('端点補正は白い開口を越えず、細い扉線だけでも伸ばさない', () => {
  for (const thinDoor of [false, true]) {
    const value = input([10, 22, 30, 22, 34, 22, 65, 22], [5, 5]);
    value.box(10, 20, 21, 5); value.box(34, 20, 32, 5);
    if (thinDoor) value.box(31, 22, 3, 1);
    const result = refineWallCandidates(value, 'ends');
    assert.ok(result.lines[2] < 31); assert.ok(result.lines[4] > 33);
  }
});
test('短すぎる線・輪郭内部の白い隙間・画像外の画素は線幅の根拠にしない', () => {
  const value = input([0, 0, 8, 0, 10, 20, 65, 20], [5, 12]);
  value.box(10, 17, 56, 1); value.box(10, 23, 56, 1);
  const result = refineWallCandidates(value, 'width');
  assert.deepEqual(result.lines, value.lines); assert.deepEqual(result.lineWidths, value.lineWidths);
});

test('厳格な端点補正は画像外へ出ず、全幅の支持がない細線で壁を伸ばさない', () => {
  const value = input([0,22,30,22], [5]); value.box(0,20,31,5); value.box(31,22,5,1);
  const result = refineWallCandidates(value, 'guarded-ends');
  assert.ok(result.lines[0] >= 0); assert.ok(result.lines[2] < 31);
});
