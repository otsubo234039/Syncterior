import test from 'node:test';
import assert from 'node:assert/strict';
import { editFloorPlan, distanceAlongWall } from '../floor-plan-edit.js';
import { isFloorPlan } from '../floor-plan.js';

const plan = () => ({ version: 1, name: '手直し', w: 8, d: 6, h: 2.5, wallThickness: .12,
  floors: [{ id: 'floor', kind: 'room', points: [[0,0],[8,0],[8,6],[0,6]] }],
  walls: [{ id: 'wall', start: [0,0], end: [8,0], thicknessRatio: 2, openings: [] }] });

test('壁を追加・端点移動・削除し、元データと他の壁の厚さを変更しない', () => {
  const initial = plan(), before = structuredClone(initial);
  const added = editFloorPlan(initial, { type: 'add-wall', id: 'new', start: [2,1], end: [2,5] });
  assert.equal(added.walls.length, 2);
  assert.equal(added.walls[0].thicknessRatio, 2);
  const moved = editFloorPlan(added, { type: 'move-wall-point', wallId: 'new', side: 'end', point: [4,5] });
  assert.deepEqual(moved.walls[1].end, [4,5]);
  const removed = editFloorPlan(moved, { type: 'remove-wall', wallId: 'new' });
  assert.deepEqual(removed, initial);
  assert.deepEqual(initial, before);
  assert.equal(editFloorPlan(initial, { type: 'move-wall-point', wallId: 'wall', side: 'end', point: [8,0] }), initial);
});

for (const [name, start, end] of [
  ['水平', [1,1], [6,1]], ['垂直', [1,1], [1,4]], ['斜め', [1,1], [5,4]], ['端点が逆順', [5,4], [1,1]],
]) test(`${name}の壁全体を移動し、長さ・向き・厚さ・開口と他の形状を維持する`, () => {
  const initial = plan();
  initial.walls[0] = { ...initial.walls[0], start, end, openings: [
    { id: 'door', kind: 'door', offset: .2, width: .8, bottom: 0, height: 2 },
    { id: 'window', kind: 'window', offset: 1.5, width: 1, bottom: 1, height: 1 },
  ] };
  initial.walls.push({ id: 'other', start: end, end: [7,5], openings: [] });
  const before = structuredClone(initial);
  const moved = editFloorPlan(initial, { type: 'move-wall', wallId: 'wall', delta: [1,1] });
  assert.deepEqual(moved.walls[0], { ...before.walls[0], start: start.map(v => v + 1), end: end.map(v => v + 1) });
  assert.deepEqual(moved.walls[1], before.walls[1]);
  assert.deepEqual(moved.floors, before.floors);
  assert.deepEqual(initial, before);
  assert.deepEqual(editFloorPlan(moved, { type: 'move-wall', wallId: 'wall', delta: [-1,-1] }), initial);
  assert.equal(editFloorPlan(initial, { type: 'move-wall', wallId: 'wall', delta: [0,0] }), initial);
});

for (const [name, delta, start, end] of [
  ['左上', [-100,-100], [0,0], [5,3]],
  ['右下', [100,100], [3,3], [8,6]],
  ['左下', [-100,100], [0,3], [5,6]],
  ['右上', [100,-100], [3,0], [8,3]],
]) test(`壁全体の移動は${name}の図面境界で止まり、片側だけを縮めない`, () => {
  const initial = plan(); initial.walls[0].start = [1,1]; initial.walls[0].end = [6,4];
  const moved = editFloorPlan(initial, { type: 'move-wall', wallId: 'wall', delta });
  assert.deepEqual(moved.walls[0].start, start);
  assert.deepEqual(moved.walls[0].end, end);
  assert.equal(editFloorPlan(moved, { type: 'move-wall', wallId: 'wall', delta }), moved);
});

test('図面の幅いっぱいの壁は横へずらさず縦方向だけ移動できる', () => {
  const initial = plan();
  const moved = editFloorPlan(initial, { type: 'move-wall', wallId: 'wall', delta: [2,3] });
  assert.deepEqual(moved.walls[0].start, [0,3]); assert.deepEqual(moved.walls[0].end, [8,3]);
});

test('壁の全長に一致する開口を保ったまま、小数の移動量でも繰り返し移動できる', () => {
  const initial = plan();
  initial.walls[0] = { ...initial.walls[0], start: [1,1], end: [2,1], openings: [
    { id: 'door', kind: 'door', offset: 0, width: 1, bottom: 0, height: 2 },
  ] };
  let moved = initial;
  for (let index = 0; index < 10; index++) {
    moved = editFloorPlan(moved, { type: 'move-wall', wallId: 'wall', delta: [.01,.01] });
    assert.ok(moved);
    assert.deepEqual(moved.walls[0].openings, initial.walls[0].openings);
  }
  assert.ok(Math.abs(moved.walls[0].start[0] - 1.1) < 1e-7);
  const tooWide = structuredClone(initial); tooWide.walls[0].openings[0].width = 1.00001;
  assert.equal(isFloorPlan(tooWide), false);
});

test('最小長0.02mの壁は丸め誤差で拒否せず移動でき、短すぎる壁は拒否する', () => {
  const initial = plan(); initial.walls[0].start = [1,1]; initial.walls[0].end = [1.02,1];
  const moved = editFloorPlan(initial, { type: 'move-wall', wallId: 'wall', delta: [.99,0] });
  assert.ok(moved);
  assert.ok(Math.abs(moved.walls[0].start[0] - 1.99) < 1e-12);
  assert.ok(Math.abs(moved.walls[0].end[0] - 2.01) < 1e-12);
  const tooShort = structuredClone(initial); tooShort.walls[0].end = [1.019999999,1];
  assert.equal(isFloorPlan(tooShort), false);
});

for (const [name, delta] of [
  ['未指定', undefined], ['null', null], ['配列以外', 1], ['空配列', []], ['要素不足', [1]],
  ['要素過多', [1,2,3]], ['文字列', ['1',2]], ['NaN', [NaN,0]], ['正の無限大', [0,Infinity]], ['負の無限大', [-Infinity,0]],
]) {
  test(`壁全体の移動量が${name}なら元データを変えず拒否する`, () => {
    const initial = plan(), before = structuredClone(initial);
    assert.equal(editFloorPlan(initial, { type: 'move-wall', wallId: 'wall', delta }), null);
    assert.deepEqual(initial, before);
  });
}

test('削除済みの壁全体を移動せず拒否する', () => {
  assert.equal(editFloorPlan(plan(), { type: 'move-wall', wallId: 'deleted', delta: [1,1] }), null);
});

test('床の頂点を移動・追加・削除し、自己交差・範囲外・3頂点未満を拒否する', () => {
  const initial = plan();
  const moved = editFloorPlan(initial, { type: 'move-floor-point', floorId: 'floor', index: 2, point: [5,4] });
  assert.deepEqual(moved.floors[0].points[2], [5,4]);
  const inserted = editFloorPlan(moved, { type: 'insert-floor-point', floorId: 'floor', index: 1 });
  assert.deepEqual(inserted.floors[0].points[2], [6.5,2]);
  assert.deepEqual(editFloorPlan(inserted, { type: 'remove-floor-point', floorId: 'floor', index: 2 }), moved);
  for (const point of [[-1,0], [9,6], [NaN,1], [0,0], [4,6]]) {
    assert.equal(editFloorPlan(initial, { type: 'move-floor-point', floorId: 'floor', index: 1, point }), null);
  }
  const triangle = editFloorPlan(initial, { type: 'remove-floor-point', floorId: 'floor', index: 1 });
  assert.equal(editFloorPlan(triangle, { type: 'remove-floor-point', floorId: 'floor', index: 1 }), null);
  assert.deepEqual(initial.floors[0].points, [[0,0],[8,0],[8,6],[0,6]]);
});

test('壁上の逆順の2点から扉を作り、幅を調整・削除できる', () => {
  const initial = plan();
  const added = editFloorPlan(initial, { type: 'add-opening', wallId: 'wall', id: 'door', kind: 'door', start: [3,0], end: [1,0] });
  assert.deepEqual(added.walls[0].openings[0], { id: 'door', kind: 'door', offset: 1, width: 2, bottom: 0, height: 2 });
  const moved = editFloorPlan(added, { type: 'move-opening-point', wallId: 'wall', openingId: 'door', side: 'end', point: [4,0] });
  assert.equal(moved.walls[0].openings[0].width, 3);
  assert.deepEqual(editFloorPlan(moved, { type: 'remove-opening', wallId: 'wall', openingId: 'door' }), initial);
  assert.deepEqual(initial.walls[0].openings, []);
});

test('斜めの壁への投影と低い壁への窓の高さを検証する', () => {
  const initial = plan(); initial.h = .5; initial.walls[0].end = [8,6];
  assert.equal(distanceAlongWall(initial.walls[0], [4,3]), 5);
  assert.ok(Number.isNaN(distanceAlongWall(initial.walls[0], [Infinity,0])));
  const added = editFloorPlan(initial, { type: 'add-opening', wallId: 'wall', id: 'window', kind: 'window', start: [0,0], end: [4,3] });
  assert.equal(isFloorPlan(added), true);
  assert.equal(added.walls[0].openings[0].bottom, .25);
  assert.equal(added.walls[0].openings[0].height, .25);
});

for (const [name, action] of [
  ['重複ID', { type: 'add-wall', id: 'wall', start: [1,1], end: [2,2] }],
  ['最小壁長未満', { type: 'add-wall', id: 'new', start: [1,1], end: [1.019,1] }],
  ['不正な端点', { type: 'move-wall-point', wallId: 'wall', side: 'other', point: [1,1] }],
  ['不正な座標', { type: 'move-wall-point', wallId: 'wall', side: 'start', point: [NaN,1] }],
  ['削除済みの壁', { type: 'remove-wall', wallId: 'deleted' }],
  ['存在しない床', { type: 'remove-floor-point', floorId: 'deleted', index: 0 }],
  ['範囲外の頂点番号', { type: 'remove-floor-point', floorId: 'floor', index: 4 }],
  ['未知の操作', { type: 'unknown' }],
  ['不足した操作', null],
]) test(`${name}の手直しは元の形状を破壊せず拒否する`, () => {
  const initial = plan(), before = structuredClone(initial);
  assert.equal(editFloorPlan(initial, action), null); assert.deepEqual(initial, before);
});

test('開口の重複・壁外・最小幅未満・反転と開口を残せない壁の短縮を拒否する', () => {
  const initial = editFloorPlan(plan(), { type: 'add-opening', wallId: 'wall', id: 'door', kind: 'door', start: [2,0], end: [4,0] });
  for (const [start, end] of [[[3,0],[5,0]], [[7,0],[9,0]], [[-1,0],[1,0]], [[5,0],[5.09,0]], [[NaN,0],[6,0]]]) {
    assert.equal(editFloorPlan(initial, { type: 'add-opening', wallId: 'wall', id: 'other', kind: 'window', start, end }), null);
  }
  for (const [side, point] of [['start',[4,0]], ['end',[1,0]], ['end',[9,0]]]) {
    assert.equal(editFloorPlan(initial, { type: 'move-opening-point', wallId: 'wall', openingId: 'door', side, point }), null);
  }
  assert.equal(editFloorPlan(initial, { type: 'move-wall-point', wallId: 'wall', side: 'end', point: [3,0] }), null);
  assert.equal(editFloorPlan(initial, { type: 'remove-opening', wallId: 'wall', openingId: 'deleted' }), null);
  assert.equal(editFloorPlan(initial, { type: 'add-opening', wallId: 'wall', id: 'bad', kind: 'unknown', start: [5,0], end: [6,0] }), null);
});

test('壁と床の件数上限・頂点上限を越す操作を拒否する', () => {
  const initial = plan(); initial.walls = Array.from({ length: 300 }, (_, index) => ({ id: `wall-${index}`, start: [0,0], end: [8,0], openings: [] }));
  assert.equal(editFloorPlan(initial, { type: 'add-wall', id: 'extra', start: [1,1], end: [2,2] }), null);
  const manyPoints = plan(); manyPoints.floors[0].points = Array.from({ length: 64 }, (_, index) => [4 + 2 * Math.cos(index * Math.PI / 32), 3 + 2 * Math.sin(index * Math.PI / 32)]);
  assert.equal(isFloorPlan(manyPoints), true);
  assert.equal(editFloorPlan(manyPoints, { type: 'insert-floor-point', floorId: 'floor', index: 0 }), null);
});
