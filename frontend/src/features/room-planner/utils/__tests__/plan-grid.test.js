import test from 'node:test';
import assert from 'node:assert/strict';
import { planGridStep } from '../plan-grid.js';

test('小さな間取りは25cm刻みで表示し、縦長でも線が密集しない間隔を選ぶ', () => {
  assert.equal(planGridStep({ w: 8, d: 6 }), .25);
  assert.equal(planGridStep({ w: 10, d: 6 }), .25);
  assert.equal(planGridStep({ w: 10.01, d: 6 }), .5);
  assert.equal(planGridStep({ w: 6, d: 21 }), 1);
  assert.equal(planGridStep({ w: 100, d: 100 }), 5);
  const plan = { w: 8, d: 6 };
  const before = structuredClone(plan); planGridStep(plan); assert.deepEqual(plan, before);
});
