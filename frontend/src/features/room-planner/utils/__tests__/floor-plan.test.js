import assert from 'node:assert/strict';
import { test } from 'node:test';
import { floorPlanFromLines } from '../floor-plan-detection.js';
import { isFloorPlan, isSimplePolygon, polygonArea, resizeFloorPlan, wallPieces } from '../floor-plan.js';
import { applyRoomOperation, isRoomLayout, isRoomSnapshot } from '../room-state.js';
import { createLocalRoomStorage, LOCAL_ROOM_KEY } from '../local-room-storage.js';
import { createRoomSession } from '../room-session.js';

const plan = () => ({ version: 1, name: 'テスト間取り', w: 8, d: 6, h: 2.5, wallThickness: .12,
  floors: [{ id: 'floor', kind: 'room', points: [[0, 0], [8, 0], [8, 6], [0, 6]] }],
  walls: [{ id: 'wall', start: [0, 0], end: [8, 0], openings: [] }] });
const layout = () => ({ planKey: 'custom', items: [], customPlan: plan() });

test('凹形の床と斜めの壁を受け入れ、自己交差と重複頂点を拒否する', () => {
  const value = plan();
  value.floors[0].points = [[0, 0], [8, 0], [8, 6], [4, 6], [4, 3], [0, 3]];
  value.walls[0].end = [8, 6];
  assert.equal(isFloorPlan(value), true);
  assert.equal(polygonArea(value.floors[0].points), 36);
  assert.equal(isSimplePolygon([[0, 0], [8, 6], [8, 0], [0, 6]]), false);
  assert.equal(isSimplePolygon([[0, 0], [8, 0], [8, 0], [0, 6]]), false);
});

for (const [name, edit] of [
  ['有限でない寸法', p => { p.w = NaN; }], ['範囲外の床', p => { p.floors[0].points[0][0] = -1; }],
  ['重複ID', p => { p.walls[0].id = 'floor'; }], ['画像データの混入', p => { p.preview = 'data:image/png'; }],
  ['長さゼロの壁', p => { p.walls[0].end = [0, 0]; }], ['壁数の超過', p => { p.walls = Array.from({ length: 301 }, (_, i) => ({ ...p.walls[0], id: `w-${i}` })); }],
]) test(`${name}は取込間取りとして保存できない`, () => { const value = plan(); edit(value); assert.equal(isFloorPlan(value), false); });

test('ドアと窓の開口分だけ壁を分割し、開口部の位置と高さを維持する', () => {
  const value = plan(), wall = value.walls[0];
  wall.openings = [{ id: 'door', kind: 'door', offset: 1, width: 1, bottom: 0, height: 2 },
    { id: 'window', kind: 'window', offset: 4, width: 2, bottom: 1, height: 1 }];
  assert.equal(isFloorPlan(value), true);
  const pieces = wallPieces(wall, value);
  assert.equal(pieces.reduce((area, p) => area + p.size[0] * p.size[1], 0), 8 * 2.5 - 2 - 2);
  assert.equal(pieces.some(p => p.size[0] === 2 && p.position[1] === .5), true);
  for (const patch of [{ offset: 7.5 }, { height: 3 }, { width: -1 }, { bottom: -1 }, { offset: 1.5 }]) {
    const invalid = structuredClone(value); Object.assign(invalid.walls[0].openings[1], patch);
    assert.equal(isFloorPlan(invalid), false);
  }
});

test('全体寸法を変更すると斜めの壁と開口幅を伸縮し、高さや元データは変更しない', () => {
  const value = plan(); value.walls[0].end = [8, 6];
  value.walls[0].openings = [{ id: 'window', kind: 'window', offset: 2, width: 1, bottom: 1, height: 1 }];
  const next = resizeFloorPlan(value, 16, 12);
  assert.deepEqual(next.walls[0].end, [16, 12]);
  assert.equal(next.walls[0].openings[0].offset, 4);
  assert.equal(next.walls[0].openings[0].width, 2);
  assert.equal(next.walls[0].openings[0].bottom, 1);
  assert.equal(next.h, 2.5); assert.equal(value.w, 8);
  assert.equal(resizeFloorPlan(value, 0, 12), null);
  assert.equal(resizeFloorPlan(value, NaN, 12), null);
});

test('近接して重なる直線候補を統合し、離れた開口部分や斜線は保持する', () => {
  const value = floorPlanFromLines({ width: 200, height: 200,
    lines: [20, 20, 180, 20, 30, 22, 170, 22, 20, 50, 60, 50, 90, 50, 180, 50, 50, 70, 150, 170] });
  assert.equal(value.walls.length, 4); assert.equal(isFloorPlan(value), true);
});

test('候補なしでも手動編集用の床を作り、壊れた解析結果は拒否する', () => {
  assert.equal(floorPlanFromLines({ width: 100, height: 100, lines: [] }).walls.length, 0);
  for (const invalid of [{ width: 0, height: 100, lines: [] }, { width: 100, height: 100, lines: [1, 2, NaN, 3] }, { width: 100, height: 100, lines: [1] }]) {
    assert.throws(() => floorPlanFromLines(invalid), /不正/);
  }
});

test('取込間取りは個人保存の第2版で復元し、画像・表示倍率・共有情報は保存しない', () => {
  const data = new Map(), storage = createLocalRoomStorage(() => ({ getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }));
  const value = layout();
  assert.equal(storage.save({ ...value, displayScale: 50, revision: 2 }).error, '');
  assert.equal(JSON.parse(data.get(LOCAL_ROOM_KEY)).version, 2);
  assert.deepEqual(storage.load().room, value);
  const invalid = layout(); invalid.customPlan.walls[0].start[0] = -1;
  data.set(LOCAL_ROOM_KEY, JSON.stringify({ version: 2, room: invalid }));
  assert.equal(storage.load().room, null);
  data.set(LOCAL_ROOM_KEY, JSON.stringify({ version: 1, room: value }));
  assert.equal(storage.load().room, null);
});

test('取込間取りへ家具を追加せず、プリセットに戻ると取込データを除く', () => {
  const value = layout();
  assert.equal(applyRoomOperation(value, { type: 'add', item: { id: 'test' } }), value);
  assert.equal(applyRoomOperation(value, { type: 'change-plan', ...value, items: [{}] }), value);
  const preset = applyRoomOperation(value, { type: 'change-plan', planKey: 'studio', items: [] });
  assert.equal(Object.hasOwn(preset, 'customPlan'), false);
  assert.equal(isRoomLayout(value), true);
  assert.equal(isRoomSnapshot({ ...value, id: 'a'.repeat(32), revision: 0, planVersion: 0, appliedOperationIds: [] }), false);
});

test('取込間取りを共有APIへ送信せず、個人保存と編集は継続する', async () => {
  let sent = 0, saved = 0;
  const session = createRoomSession({ api: { configured: true, create: () => { sent++; } }, initialRoom: layout(), onLocalChange: () => saved++ });
  session.start();
  assert.equal(await session.share(), null); assert.equal(sent, 0);
  assert.match(session.getSnapshot().error, /共有はまだ利用できません/);
  assert.equal(session.dispatch({ type: 'change-plan', ...layout() }), true);
  assert.equal(saved, 1); assert.equal(session.getSnapshot().status, 'local');
  session.stop();
});

test('共同編集中は取込形状への切り替えを送信せず、確定配置と未送信キューを維持する', async () => {
  const snapshot = { id: 'a'.repeat(32), planKey: 'studio', items: [], revision: 0, planVersion: 0, appliedOperationIds: [] };
  let handlers, sent = 0;
  const session = createRoomSession({ roomId: snapshot.id, initialRoom: { planKey: 'studio', items: [] }, api: {
    configured: true, get: async () => snapshot,
    subscribe: (_, callbacks) => { handlers = callbacks; return () => {}; },
    send: async () => { sent++; return snapshot; },
  } });
  session.start(); await new Promise(setImmediate); handlers.state(snapshot);
  assert.equal(session.getSnapshot().status, 'connected');
  assert.equal(session.dispatch({ type: 'change-plan', ...layout() }), false);
  assert.equal(sent, 0); assert.equal(session.getSnapshot().pending, 0);
  assert.equal(session.getSnapshot().room.planKey, 'studio');
  session.stop();
});


test('大きい画像の2px断片が実寸の最小壁長を下回っても残りの間取りを生成できる', () => {
  const value = floorPlanFromLines({ width: 1024, height: 627, strokeWidth: 12,
    lines: [20, 20, 1000, 20, 243, 492, 243, 494, 400, 490, 400, 493], lineWidths: [12, 2, 3] });
  assert.equal(isFloorPlan(value), true);
  assert.equal(value.walls.length, 2);
  assert.ok(value.walls.every(wall => Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]) >= .02));
  assert.ok(value.walls.some(wall => wall.start[0] === wall.end[0] && wall.start[1] > 3));
});
