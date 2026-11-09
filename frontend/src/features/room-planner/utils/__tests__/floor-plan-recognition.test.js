import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runOpenCvWorker } from './helpers/opencv-worker.js';
import { evaluateWallReferences } from '../floor-plan-evaluation.js';
import { floorPlanFromLines } from '../floor-plan-detection.js';
import { wallPieces, isFloorPlan, resizeFloorPlan } from '../floor-plan.js';
import { createLocalRoomStorage } from '../local-room-storage.js';

function image(background = 255, size = 200) {
  const width = size, height = size, pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) pixels.set([background, background, background, 255], i * 4);
  const box = (x, y, w, h, gray = 30) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) pixels.set([gray, gray, gray, 255], (row * width + col) * 4);
  };
  return { width, height, pixels: pixels.buffer, box };
}
function segments(result) { return Array.from({ length: result.lines.length / 4 }, (_, i) => result.lines.slice(i * 4, i * 4 + 4)); }
const expected = { walls: [[20,20,180,20],[20,20,20,180],[180,20,180,180],[20,180,180,180]], nonWalls: [] };

for (const [name, thickness, gray] of [['太い黒線', 5, 30], ['細い灰色線', 1, 160]]) {
  test(`${name}の枠を感度指定なしで抽出し、元画像を変更しない`, async () => {
    const value = image();
    value.box(20,20,160,thickness,gray); value.box(20,20,thickness,160,gray);
    value.box(180,20,thickness,160,gray); value.box(20,180,165,thickness,gray);
    const before = value.pixels.slice(0);
    const result = await runOpenCvWorker(value);
    assert.ok(evaluateWallReferences(segments(result), expected, 4).coverage > .95);
    assert.deepEqual(value.pixels, before);
  });
}

test('黒い外側背景を除き、内側の灰色の壁を残す', async () => {
  const value = image(0); value.box(18,18,170,170,255);
  value.box(20,20,160,5,150); value.box(20,20,5,160,150); value.box(180,20,5,160,150); value.box(20,180,165,5,150);
  const result = await runOpenCvWorker(value);
  assert.ok(evaluateWallReferences(segments(result), expected, 4).coverage > .95);
  assert.ok(segments(result).every(line => line.every(p => p >= 18 && p <= 188)));
});

test('壁の間にある白い開口を結合せず、タイル状の細線を壁へ復活させない', async () => {
  const value = image();
  value.box(20,20,60,5); value.box(95,20,90,5); value.box(20,20,5,165); value.box(180,20,5,165); value.box(20,180,165,5);
  for (const y of [50,58,66,74,82]) value.box(25,y,155,1);
  const result = await runOpenCvWorker(value);
  const lines = segments(result);
  assert.equal(lines.some(([x1,y1,x2,y2]) => Math.abs(y1 - 22) < 3 && Math.abs(y2 - 22) < 3 && Math.min(x1,x2) < 80 && Math.max(x1,x2) > 95), false);
  assert.equal(lines.some(([,y1,,y2]) => y1 >= 50 && y1 <= 82 && y1 === y2), false);
  assert.ok(floorPlanFromLines(result).walls.length >= 5);
});

test('無地の画像を壁で埋めず、別の画像を解析し直しても以前の候補を残さない', async () => {
  assert.deepEqual((await runOpenCvWorker(image())).lines, []);
  const value = image(); value.box(20,20,160,5); value.box(20,20,5,165); value.box(20,180,160,5);
  assert.ok((await runOpenCvWorker(value)).lines.length > 0);
  assert.deepEqual((await runOpenCvWorker(image())).lines, []);
});

test('部分注釈の網羅率は線の向きを考慮し、非壁領域の誤検出を別に数える', () => {
  const reference = { walls: [[0,10,10,10]], nonWalls: [{ name: '文字', box: [20,0,30,10] }] };
  const result = evaluateWallReferences([[0,10,5,10],[20,5,30,5]], reference, .1);
  assert.equal(result.coverage, .5); assert.equal(result.nonWallLength, 10);
  assert.equal(evaluateWallReferences([[5,0,5,20]], reference, 20).coverage, 0);
});

test('短い開口と近接した別の壁を保存し、線幅に応じて重複だけをまとめる', () => {
  const result = floorPlanFromLines({ width: 200, height: 200, strokeWidth: 3,
    lines: [20,20,80,20,83,20,180,20,20,25,180,25] });
  assert.equal(result.walls.length, 3);
  assert.throws(() => floorPlanFromLines({ width: 200, height: 200, lines: [], strokeWidth: NaN }), /不正/);
});

// 生成した箱を逆回転し、指定した床上の点が本当に壁の中か確認する。
function solidAt(result, px, py) {
  const plan = floorPlanFromLines(result);
  const x = px / result.width * plan.w - plan.w / 2, z = py / result.height * plan.d - plan.d / 2;
  return plan.walls.some(wall => wallPieces(wall, plan).some(piece => {
    const dx = x - piece.position[0], dz = z - piece.position[2];
    const localX = dx * Math.cos(piece.rotation) - dz * Math.sin(piece.rotation);
    const localZ = dx * Math.sin(piece.rotation) + dz * Math.cos(piece.rotation);
    return Math.abs(localX) < piece.size[0] / 2 - 1e-7 && Math.abs(localZ) < piece.size[2] / 2 - 1e-7;
  }));
}

test('太い壁の途中を扉の細線がつないでも3Dの入口を塞がない', async () => {
  const value = image();
  value.box(20,20,60,5); value.box(95,20,90,5);
  value.box(80,22,15,1);
  value.box(20,20,5,165); value.box(180,20,5,165); value.box(20,180,165,5);
  const result = await runOpenCvWorker(value);
  assert.equal(solidAt(result, 87, 22), false);
  assert.equal(solidAt(result, 50, 22), true);
  assert.equal(solidAt(result, 120, 22), true);
});

test('片側が壁の途中で他方が直角の戸当たりでも細い扉の線で塞がない', async () => {
  const value = image();
  value.box(20,20,60,5); value.box(100,20,5,140); value.box(80,22,20,1);
  const result = await runOpenCvWorker(value);
  assert.equal(solidAt(result, 90, 22), false);
});

test('長い壁の一部分だけが厚い出っ張りを細い板へ置き換えない', async () => {
  const value = image();
  value.box(20,20,5,160); value.box(25,75,9,40);
  const result = await runOpenCvWorker(value);
  assert.equal(solidAt(result, 30, 90), true);
  assert.equal(solidAt(result, 30, 50), false);
  assert.equal(solidAt(result, 38, 90), false);
  assert.ok(floorPlanFromLines(result).walls.some(w => w.thicknessRatio > 1.5));
});

test('短い端辺で閉じた二重線の出っ張りを厚い壁へまとめ、端辺がない隙間は埋めない', async () => {
  for (const closed of [true, false]) {
    const value = image();
    value.box(20,20,5,160); value.box(30,70,4,40); value.box(20,70,14,3);
    if (closed) value.box(20,107,14,3);
    const result = await runOpenCvWorker(value);
    assert.equal(solidAt(result, 28, 90), closed);
  }
});

test('長い線の抽出下限より短い折れ返しを、両端の壁と画素の裏付けから復元する', async () => {
  const value = image(255, 500);
  value.box(30,100,190,5); value.box(216,100,5,15); value.box(216,110,164,5);
  const result = await runOpenCvWorker(value);
  assert.equal(solidAt(result, 218, 107), true);
  assert.equal(solidAt(result, 225, 107), false);
});

test('局所的な壁厚は個人保存と寸法補正で維持し、過去の壁厚指定なしのデータも扱う', async () => {
  const value = image(); value.box(20,20,5,160); value.box(25,75,9,40);
  const plan = floorPlanFromLines(await runOpenCvWorker(value));
  let raw;
  const storage = createLocalRoomStorage(() => ({ getItem: () => raw ?? null, setItem: (_, data) => { raw = data; } }));
  const room = { planKey: 'custom', items: [], customPlan: plan };
  assert.equal(storage.save(room).error, '');
  assert.deepEqual(storage.load().room, room);
  assert.equal(resizeFloorPlan(plan, plan.w * 1.1, plan.d * 1.1).walls[0].thicknessRatio, plan.walls[0].thicknessRatio);
  const legacy = structuredClone(plan); legacy.walls.forEach(w => delete w.thicknessRatio);
  assert.equal(isFloorPlan(legacy), true);
  for (const ratio of [0, -1, NaN, Infinity, 9]) {
    const invalid = structuredClone(plan); invalid.walls[0].thicknessRatio = ratio;
    assert.equal(isFloorPlan(invalid), false);
  }
});

test('線ごとの厚さの件数・有限数・範囲を検証する', () => {
  const input = { width: 200, height: 200, lines: [20, 20, 100, 20] };
  for (const lineWidths of [[], [0], [NaN], [Infinity], [51], [-1], [2, 3]]) {
    assert.throws(() => floorPlanFromLines({ ...input, lineWidths }), /不正/);
  }
  assert.equal(isFloorPlan(floorPlanFromLines({ ...input, lineWidths: [2] })), true);
});

test('厚い壁の中の平行な重複だけを除き、直角の短辺は保持する', () => {
  const plan = floorPlanFromLines({ width: 200, height: 200, strokeWidth: 5,
    lines: [20, 20, 180, 20, 30, 21, 170, 21, 60, 18, 60, 22], lineWidths: [10, 2, 2] });
  assert.equal(plan.walls.length, 2);
  assert.ok(plan.walls.some(w => w.start[0] === w.end[0]));
});
