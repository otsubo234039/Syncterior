import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyRoomOperation, isRoomSnapshot, projectRoom } from '../room-state.js';
import { initialFurniture } from '../furniture.js';
import { plans } from '../../data/plans.js';
import { catalog } from '../../data/catalog.js';

const item = () => ({ ...catalog[0], id: 'sofa-1', x: 0, z: 0, rot: 0 });
const room = () => ({ id: 'a'.repeat(32), planKey: 'studio', revision: 0, planVersion: 0,
  appliedOperationIds: [], items: [item()] });

for (const planKey of Object.keys(plans)) {
  test(`${planKey}の初期家具は独立したIDを持ち、部屋の範囲内に配置される`, () => {
    const first = initialFurniture(planKey);
    const second = initialFurniture(planKey);
    assert.equal(first.length, 4);
    assert.equal(new Set([...first, ...second].map(value => value.id)).size, 8);
    for (const value of first) {
      assert.ok(Math.abs(value.x) + value.w / 2 <= plans[planKey].w / 2);
      assert.ok(Math.abs(value.z) + value.d / 2 <= plans[planKey].d / 2);
    }
    first[0].color = '#000000';
    assert.notEqual(second[0].color, '#000000');
    assert.notEqual(catalog[0].color, '#000000');
  });
}

test('元のスナップショットを保持して家具を追加・削除し、IDの重複追加を防ぐ', () => {
  const original = room();
  const added = applyRoomOperation(original, { type: 'add', item: { ...item(), id: 'sofa-2' } });
  assert.equal(added.items.length, 2);
  assert.equal(original.items.length, 1);
  assert.equal(applyRoomOperation(added, { type: 'add', item: item() }), added);
  const removed = applyRoomOperation(added, { type: 'remove', id: 'sofa-1' });
  assert.deepEqual(removed.items.map(value => value.id), ['sofa-2']);
  assert.equal(added.items.length, 2);
});

test('指定した家具の対象項目だけを更新し、他のプロパティを保持する', () => {
  const original = { ...room(), items: [item(), { ...item(), id: 'sofa-2' }] };
  const updated = applyRoomOperation(original, { type: 'update', id: 'sofa-1', patch: { x: .5, color: '#123456' } });
  assert.equal(updated.items[0].x, .5);
  assert.equal(updated.items[0].color, '#123456');
  assert.equal(updated.items[0].w, original.items[0].w);
  assert.equal(updated.items[1], original.items[1]);
  assert.equal(original.items[0].x, 0);
});

test('90度回転を4回行うと元の向きに戻る', () => {
  const original = room();
  let rotated = original;
  for (let count = 0; count < 4; count++) rotated = applyRoomOperation(rotated, { type: 'rotate', id: 'sofa-1' });
  assert.equal(rotated.items[0].rot, 0);
  assert.equal(original.items[0].rot, 0);
});

for (const type of ['update', 'rotate', 'remove']) {
  test(`削除済み家具への${type}操作で家具が復活しない`, () => {
    const original = { ...room(), items: [] };
    const next = applyRoomOperation(original, { type, id: 'deleted', patch: { x: 1 } });
    assert.deepEqual(next.items, []);
  });
}

test('元の部屋を変更せず、間取り変更で家具を置き換える', () => {
  const original = room();
  const items = initialFurniture('family');
  const changed = applyRoomOperation(original, { type: 'change-plan', planKey: 'family', items });
  assert.equal(changed.planKey, 'family');
  assert.deepEqual(changed.items, items);
  assert.equal(original.planKey, 'studio');
  assert.equal(original.items.length, 1);
});

test('未確定操作を順番に反映し、古い間取り世代への操作を除外する', () => {
  const original = room();
  const projected = projectRoom(original, [
    { planVersion: 0, operation: { type: 'update', id: 'sofa-1', patch: { x: .5 } } },
    { planVersion: 1, operation: { type: 'remove', id: 'sofa-1' } },
    { planVersion: 0, operation: { type: 'update', id: 'sofa-1', patch: { color: '#abcdef' } } },
  ]);
  assert.equal(projected.items.length, 1);
  assert.equal(projected.items[0].x, .5);
  assert.equal(projected.items[0].color, '#abcdef');
  assert.equal(original.items[0].x, 0);
});

test('負の座標・家具のない部屋・家具200点を有効なスナップショットとして受理する', () => {
  assert.equal(isRoomSnapshot(room()), true);
  assert.equal(isRoomSnapshot({ ...room(), items: [{ ...item(), x: -1, z: -.5 }] }), true);
  assert.equal(isRoomSnapshot({ ...room(), items: [] }), true);
  assert.equal(isRoomSnapshot({ ...room(), items: Array.from({ length: 200 }, (_, id) => ({ ...item(), id: `item-${id}` })) }), true);
});

const invalidSnapshots = [
  ['データの欠落', null],
  ['不正な部屋ID', { ...room(), id: '../room' }],
  ['未対応の間取り', { ...room(), planKey: 'unknown' }],
  ['負のリビジョン', { ...room(), revision: -1 }],
  ['小数のリビジョン', { ...room(), revision: 1.5 }],
  ['不正な間取り世代', { ...room(), planVersion: -1 }],
  ['不正な確定済み操作ID', { ...room(), appliedOperationIds: [123] }],
  ['重複した家具ID', { ...room(), items: [item(), item()] }],
  ['家具データの欠落', { ...room(), items: [null] }],
  ['未対応の家具種別', { ...room(), items: [{ ...item(), type: 'unknown' }] }],
  ['不正な色', { ...room(), items: [{ ...item(), color: 'red' }] }],
  ['ゼロの寸法', { ...room(), items: [{ ...item(), w: 0 }] }],
  ['無限大の座標', { ...room(), items: [{ ...item(), x: Infinity }] }],
  ['NaNの座標', { ...room(), items: [{ ...item(), z: NaN }] }],
  ['上限を超える家具数', { ...room(), items: Array.from({ length: 201 }, (_, id) => ({ ...item(), id: `item-${id}` })) }],
];
for (const [description, value] of invalidSnapshots) {
  test(`${description}を含むスナップショットを拒否する`, () => assert.equal(isRoomSnapshot(value), false));
}
