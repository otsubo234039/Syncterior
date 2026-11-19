import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCameraView } from '../initial-camera-view.js';

test('初期視点は従来のプリセット配置を維持し取込間取りでは寸法に合わせる', () => {
  const plan = { w: 8, d: 6, h: 2.5 };
  assert.deepEqual(initialCameraView('studio', plan).position, [8, 7, 9]);
  const custom = initialCameraView('custom', plan);
  assert.deepEqual(custom.position, [8, 8.5, 10]);
  assert.deepEqual(custom.target, [0, .5, 0]);
  assert.equal(custom.maxDistance, 40);
});
