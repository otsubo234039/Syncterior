import assert from 'node:assert/strict';
import { test } from 'node:test';
import { constrainFurnitureToRoom } from '../furniture-bounds.js';
import { applyRoomOperation, projectRoom } from '../room-state.js';
import { plans } from '../../data/plans.js';
import { catalog } from '../../data/catalog.js';

const bed = () => ({ ...catalog[1], id: 'bed-1', x: 0, z: 0, rot: 0 });
const room = item => ({ planKey: 'studio', planVersion: 0, items: [item] });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

// 外接矩形の式を使い回さず、描画と同じY軸回転で四隅を独立に検証する。
function assertCornersInside(item, plan) {
  for (const x of [-item.w / 2, item.w / 2]) {
    for (const z of [-item.d / 2, item.d / 2]) {
      const worldX = item.x + x * Math.cos(item.rot) + z * Math.sin(item.rot);
      const worldZ = item.z - x * Math.sin(item.rot) + z * Math.cos(item.rot);
      assert.ok(Math.abs(worldX) <= plan.w / 2 + 1e-9);
      assert.ok(Math.abs(worldZ) <= plan.d / 2 + 1e-9);
    }
  }
}

for (const [degrees, maxX, maxZ] of [[0, 2, 1.1], [90, 1.7, 1.4], [180, 2, 1.1], [270, 1.7, 1.4]]) {
  test(`${degrees}度の長方形家具を移動すると、回転後の四隅が全て部屋に収まる`, () => {
    for (const signX of [-1, 1]) for (const signZ of [-1, 1]) {
      const item = { ...bed(), rot: degrees * Math.PI / 180 };
      const next = applyRoomOperation(room(item), { type: 'update', id: item.id, patch: { x: signX * 99, z: signZ * 99 } }).items[0];
      close(next.x, signX * maxX);
      close(next.z, signZ * maxZ);
      assertCornersInside(next, plans.studio);
      assert.equal(item.x, 0);
      assert.equal(item.z, 0);
    }
  });
}

test('壁際の回転は必要な軸だけ補正し、家具や他の家具を中央へ戻さない', () => {
  const item = { ...bed(), x: 2, z: 1 };
  const other = { ...bed(), id: 'bed-2', x: -1, z: -.5 };
  const original = { ...room(item), items: [item, other] };
  const next = applyRoomOperation(original, { type: 'rotate', id: item.id });
  close(next.items[0].x, 1.7);
  assert.equal(next.items[0].z, 1);
  assert.equal(next.items[1], other);
  assert.equal(original.items[0].x, 2);
  let current = next;
  for (let count = 0; count < 8; count++) {
    current = applyRoomOperation(current, { type: 'rotate', id: item.id });
    assertCornersInside(current.items[0], plans.studio);
    close(current.items[0].x, 1.7);
    assert.equal(current.items[0].z, 1);
  }
});

test('部屋に収まる家具は位置や寸法を変えず、任意角度と負の回転でも境界を守る', () => {
  for (const plan of Object.values(plans)) for (const furniture of catalog) {
    for (const rot of [-Math.PI / 4, Math.PI / 4, Math.PI / 3, 2 * Math.PI, 7 * Math.PI / 2]) {
      const item = { ...furniture, x: .1, z: -.1, rot };
      assert.deepEqual(constrainFurnitureToRoom(item, plan), item);
      for (const x of [-99, 99]) for (const z of [-99, 99]) {
        assertCornersInside(constrainFurnitureToRoom({ ...item, x, z }, plan), plan);
      }
    }
  }
});

test('部屋と外形が同じ寸法なら直角回転の丸め誤差で操作を拒否しない', () => {
  const item = { ...bed(), w: 2, d: 4, x: 9, z: -9, rot: Math.PI * 3 / 2 };
  const next = constrainFurnitureToRoom(item, { w: 4, d: 2 });
  close(next.x, 0);
  close(next.z, 0);
});

for (const [label, patch] of [
  ['NaNの位置', { x: NaN }], ['無限大の位置', { z: Infinity }],
  ['無効な回転', { rot: NaN }], ['ゼロの幅', { w: 0 }], ['負の奥行', { d: -1 }],
  ['部屋より大きい外形', { w: 10 }],
]) {
  test(`${label}への更新を拒否し、元の家具を維持する`, () => {
    const item = bed();
    assert.equal(constrainFurnitureToRoom({ ...item, ...patch }, plans.studio), null);
    assert.equal(applyRoomOperation(room(item), { type: 'update', id: item.id, patch }).items[0], item);
  });
}

test('回転後だけ外形が部屋を超える場合は、回転前の向きと位置を維持する', () => {
  const item = { ...bed(), w: 5, d: 1, x: .1, z: .1 };
  assert.equal(applyRoomOperation(room(item), { type: 'rotate', id: item.id }).items[0], item);
});

test('共有配置に未確定の回転・移動を重ねても回転後の境界に収まり、確定後に位置が変わらない', () => {
  const item = { ...bed(), x: 2, z: 1 };
  const original = room(item);
  const operations = [{ type: 'rotate', id: item.id }, { type: 'update', id: item.id, patch: { x: 99, z: -99 } }];
  const pending = operations.map((operation, id) => ({ id, planVersion: 0, operation }));
  const projected = projectRoom(original, pending);
  close(projected.items[0].x, 1.7);
  close(projected.items[0].z, -1.4);
  assertCornersInside(projected.items[0], plans.studio);
  const confirmed = operations.reduce(applyRoomOperation, original);
  assert.deepEqual(projectRoom(confirmed, []), projected);
  assert.equal(original.items[0], item);
});

test('部屋の寸法が欠落・非有限・非正なら境界補正を行わない', () => {
  for (const plan of [undefined, {}, { w: NaN, d: 4 }, { w: 5, d: Infinity }, { w: 0, d: 4 }, { w: 5, d: -1 }]) {
    assert.equal(constrainFurnitureToRoom(bed(), plan), null);
  }
});
