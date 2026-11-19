import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cameraPanOffset } from '../camera-pan.js';

test('通常3Dの向きに合わせて前後左右へ移動し、高さを変えない', () => {
  const near = (actual, expected) => actual.forEach((n, index) => assert.ok(Math.abs(n - expected[index]) < 1e-10));
  near(cameraPanOffset(0, 'forward', 2), [0, 0, -2]);
  near(cameraPanOffset(0, 'back', 2), [0, 0, 2]);
  near(cameraPanOffset(0, 'left', 2), [-2, 0, 0]);
  near(cameraPanOffset(0, 'right', 2), [2, 0, 0]);
  near(cameraPanOffset(Math.PI / 2, 'forward', 2), [-2, 0, 0]);
  near(cameraPanOffset(Math.PI / 2, 'right', 2), [0, 0, -2]);
  for (const azimuth of [-Math.PI, -.7, .7, Math.PI]) {
    const forward = cameraPanOffset(azimuth, 'forward', .25);
    const back = cameraPanOffset(azimuth, 'back', .25);
    near(forward.map((n, index) => n + back[index]), [0, 0, 0]);
    assert.ok(Math.abs(Math.hypot(...forward) - .25) < 1e-10);
    assert.equal(forward[1], 0);
  }
});

test('不正な方向・移動距離・方位からは移動量を作らない', () => {
  for (const direction of [null, undefined, '', 'up', 'toString', '__proto__']) assert.equal(cameraPanOffset(0, direction, 1), null);
  for (const distance of [NaN, Infinity, -1, 0, '1']) assert.equal(cameraPanOffset(0, 'right', distance), null);
  for (const azimuth of [NaN, Infinity, null, '0']) assert.equal(cameraPanOffset(azimuth, 'right', 1), null);
});
