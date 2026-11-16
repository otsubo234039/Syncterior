import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runOpenCvWorker } from './helpers/opencv-worker.js';
import { measurementPolygonArea } from '../floor-plan-calibration.js';

function image(points = [], color = [30,30,30]) {
  const width = 200, height = 200, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (points.some((a, i) => {
      const b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) <= 2.5;
    })) pixels.set([...color,255], (y * width + x) * 4);
  }
  return { width, height, pixels: pixels.buffer };
}
const inside = (points, [x, y]) => points.reduce((result, p, i) => {
  const q = points[(i + 1) % points.length];
  return (p[1] > y) !== (q[1] > y) && x < (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]) + p[0] ? !result : result;
}, false);

test('L字の閉じた部屋を自動認識し、出っ張りの外側を面積へ含めない', async () => {
  const result = await runOpenCvWorker(image([[20,20],[180,20],[180,90],[100,90],[100,180],[20,180]]));
  const room = result.roomCandidates.find(points => inside(points, [.3,.7]));
  assert.ok(room); assert.ok(room.length >= 6);
  assert.equal(inside(room, [.7,.7]), false);
  const area = measurementPolygonArea({w:200,d:200}, room);
  assert.ok(Math.abs(area / 18400 - 1) < .1);
});

test('斜めの部屋を長方形へ置き換えずに認識し、色付きの壁でも候補を返す', async () => {
  for (const color of [[30,30,30], [20,120,50]]) {
    const result = await runOpenCvWorker(image([[40,20],[180,70],[140,180],[20,130]], color));
    const room = result.roomCandidates.find(points => inside(points, [.5,.5]));
    assert.ok(room); assert.ok(measurementPolygonArea({w:200,d:200}, room) > 10000);
    assert.equal(inside(room, [.12,.12]), false);
    assert.equal(inside(room, [.88,.88]), false);
  }
});

test('扉の隙間は部屋候補だけで補い、3D用の壁候補では塞がない', async () => {
  const value = image([[20,20],[180,20],[180,180],[20,180]]), pixels = new Uint8ClampedArray(value.pixels);
  for (let y = 16; y < 25; y++) for (let x = 80; x < 95; x++) pixels.set([255,255,255,255], (y * value.width + x) * 4);
  const before = value.pixels.slice(0), result = await runOpenCvWorker(value);
  assert.ok(result.roomCandidates.some(points => inside(points, [.5,.5])));
  for (let i = 0; i < result.lines.length; i += 4) {
    const [x1,y1,x2,y2] = result.lines.slice(i, i + 4);
    assert.equal(Math.abs(y1 - 20) < 3 && Math.abs(y2 - 20) < 3 && Math.min(x1,x2) < 80 && Math.max(x1,x2) > 95, false);
  }
  assert.deepEqual(value.pixels, before);
});

test('角にある扉では両側の壁端から輪郭を補い、角の床面積を欠落させない', async () => {
  const value = image([[20,20],[180,20],[180,180],[20,180]]), pixels = new Uint8ClampedArray(value.pixels);
  for (let y = 16; y < 38; y++) for (let x = 162; x < 185; x++) pixels.set([255,255,255,255], (y * value.width + x) * 4);
  const result = await runOpenCvWorker(value);
  assert.ok(result.roomCandidates.some(points => inside(points, [.5,.5]) && inside(points, [.85,.15])));
});

test('無地・小さい文字の囲みは部屋とせず、再解析で前の部屋候補を残さない', async () => {
  assert.deepEqual((await runOpenCvWorker(image())).roomCandidates, []);
  assert.deepEqual((await runOpenCvWorker(image([[80,80],[90,80],[90,90],[80,90]]))).roomCandidates, []);
  assert.ok((await runOpenCvWorker(image([[20,20],[180,20],[180,180],[20,180]]))).roomCandidates.length > 0);
  assert.deepEqual((await runOpenCvWorker(image())).roomCandidates, []);
});
