import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAWING_KEY, newDrawing, encodeDrawing, decodeDrawing, decodeDrawingDocument, createDrawingStorage,
  newDrawingId, legacyDrawingId } from '../drawing-document.js';
import { editFloorPlan } from '../floor-plan-edit.js';

test('新規の図面を画像や3D配置なしで作成し、実寸の床と高さを保存・復元する', () => {
  const plan = newDrawing({ name: '作図用', w: 10, d: 7, h: 3 });
  assert.deepEqual(plan.floors[0].points, [[0,0],[10,0],[10,7],[0,7]]);
  assert.equal(plan.h, 3); assert.deepEqual(plan.walls, []);
  const data = new Map([['syncterior.personal-room', '既存の家具配置']]);
  const storage = createDrawingStorage(() => ({ getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }));
  assert.equal(storage.load().plan, null);
  assert.equal(data.has(DRAWING_KEY), false);
  assert.equal(storage.save(plan).error, '');
  assert.deepEqual(storage.load().plan, plan);
  assert.equal(data.get('syncterior.personal-room'), '既存の家具配置');
  assert.deepEqual(Object.keys(JSON.parse(data.get(DRAWING_KEY))).sort(), ['plan','version']);
});

test('壁厚倍率と開口の高さを図面ファイルでも維持し、元の図面を変更しない', () => {
  const plan = newDrawing();
  plan.walls.push({ id: 'wall', start: [1,1], end: [7,1], thicknessRatio: 2,
    openings: [{ id: 'window', kind: 'window', offset: 1, width: 1, bottom: 1, height: 1 }] });
  const before = structuredClone(plan), restored = decodeDrawing(encodeDrawing(plan));
  assert.deepEqual(restored, before); assert.deepEqual(plan, before);
  restored.walls[0].start[0] = 2; assert.deepEqual(plan, before);
});

test('不正な寸法・版・未知フィールド・過大な図面と破損データを拒否する', () => {
  for (const options of [{ w: 0 }, { d: 101 }, { h: NaN }, { name: '' }, { h: .49 }]) assert.equal(newDrawing(options), null);
  assert.ok(newDrawing({ w: 1, d: 100, h: .5 }));
  for (const value of [null, { version: 2, plan: newDrawing() }, { version: 1, plan: newDrawing(), image: 'secret' },
    { version: 1, plan: { ...newDrawing(), camera: {} } }]) assert.throws(() => decodeDrawing(JSON.stringify(value)));
  assert.throws(() => decodeDrawing('broken'));
  assert.throws(() => decodeDrawing(' '.repeat(1_000_001)));
  assert.throws(() => encodeDrawing({ ...newDrawing(), w: Infinity }));
});

test('読み書きの拒否・容量不足・破損した保存を案内し、保存の再試行ができる', () => {
  let denied = true, raw = 'broken';
  const storage = createDrawingStorage(() => ({
    getItem: () => { if (denied) throw new Error('denied'); return raw; },
    setItem: (_, value) => { if (denied) throw new Error('quota'); raw = value; },
  }));
  assert.ok(storage.load().error); assert.ok(storage.save(newDrawing()).error);
  assert.equal(raw, 'broken'); denied = false;
  assert.ok(storage.load().error);
  assert.equal(storage.save(newDrawing()).error, '');
  assert.deepEqual(storage.load().plan, newDrawing());
});

test('図面名と高さは検証後に変更し、既存の開口が収まらない高さは拒否する', () => {
  const plan = newDrawing();
  plan.walls.push({ id: 'wall', start: [1,1], end: [7,1], openings: [
    { id: 'door', kind: 'door', offset: 1, width: 1, bottom: 0, height: 2 },
  ] });
  const next = editFloorPlan(plan, { type: 'update-metadata', name: '変更後', height: 3 });
  assert.equal(next.name, '変更後'); assert.equal(next.h, 3); assert.equal(plan.h, 2.5);
  assert.equal(editFloorPlan(plan, { type: 'update-metadata', name: '変更後', height: 1 }), null);
  assert.equal(editFloorPlan(plan, { type: 'update-metadata', name: '', height: 3 }), null);
  assert.equal(editFloorPlan(plan, { type: 'update-metadata', name: plan.name, height: plan.h }), plan);
});

test('図面の識別を保存とファイルで維持し、不正な識別を拒否して従来形式も復元する', () => {
  const plan = newDrawing(), drawingId = newDrawingId();
  assert.notEqual(newDrawingId(), drawingId);
  const raw = encodeDrawing(plan, drawingId);
  assert.deepEqual(decodeDrawingDocument(raw), { plan, drawingId });
  assert.deepEqual(decodeDrawing(raw), plan);
  let saved;
  const storage = createDrawingStorage(() => ({ setItem: (_, value) => { saved = value; }, getItem: () => saved }));
  assert.equal(storage.save(plan, drawingId).error, '');
  assert.deepEqual(storage.load(), { plan, drawingId, error: '' });
  assert.deepEqual(decodeDrawingDocument(encodeDrawing(plan)), { plan });
  assert.equal(legacyDrawingId(plan), legacyDrawingId(structuredClone(plan)));
  assert.notEqual(legacyDrawingId(plan), legacyDrawingId({ ...plan, name: '別の図面' }));
  for (const drawingId of ['', null, 1, {}, '../drawing', 'x'.repeat(81)]) {
    assert.throws(() => encodeDrawing(plan, drawingId));
    assert.throws(() => decodeDrawingDocument(JSON.stringify({ version: 1, plan, drawingId })));
  }
});
