import test from 'node:test';
import assert from 'node:assert/strict';
import { viewPreset } from '../view-preset.js';

test('初期視点は従来のプリセット配置を維持し取込間取りでは寸法に合わせる', () => {
  const plan = { w: 8, d: 6, h: 2.5 };
  assert.deepEqual(viewPreset('studio', plan, 'initial', 1).position, [8, 7, 9]);
  const custom = viewPreset('custom', plan, 'initial', 1);
  assert.deepEqual(custom.position, [8, 8.5, 10]);
  assert.deepEqual(custom.target, [0, .5, 0]);
  assert.equal(custom.maxDistance, 40);
});

test('正面表示は縦長・横長と小さい画面比率でも部屋の手前端を画角に収める', () => {
  for (const aspect of [.01, .4, 1, 2.5]) {
    for (const plan of [{ w: 8, d: 6, h: 2.5 }, { w: 1, d: 1, h: 10 }]) {
      const before = structuredClone(plan);
      const view = viewPreset('custom', plan, 'front', aspect);
      const halfHeight = (view.position[2] - plan.d / 2) * Math.tan(42 * Math.PI / 360);
      assert.ok(halfHeight >= plan.h / 2);
      assert.ok(halfHeight * aspect >= plan.w / 2);
      assert.equal(view.maxPolarAngle, Math.PI / 2);
      assert.ok(view.maxDistance > view.position[2]);
      assert.deepEqual(plan, before);
    }
  }
});
