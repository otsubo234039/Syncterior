import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { modes, variant } from './variants.js';
const cv = createRequire(import.meta.url)('@techstark/opencv-js');
if (!cv.Mat) await new Promise(resolve => cv.then(() => resolve()));
const source = await readFile(new URL('../../docs/floor-plan-preprocessing-assets/baseline-worker.js', import.meta.url), 'utf8');
async function run(input, mode) {
  let result;
  const self = { cv, postMessage: value => { result = value; } };
  vm.runInNewContext(variant(source, mode), { self, Uint8ClampedArray, Uint8Array, Int32Array, Math, Array, Promise });
  await self.onmessage({ data: input });
  assert.equal(result.error, undefined);
  return structuredClone(result);
}
function frame(transparent, thickness = 5, shade = 30) {
  const pixels = new Uint8ClampedArray(200 * 200 * 4);
  for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
    const wall = ((x >= 20 && x < 20 + thickness || x >= 180 && x < 180 + thickness) && y >= 20 && y < 185)
      || ((y >= 20 && y < 20 + thickness || y >= 180 && y < 180 + thickness) && x >= 20 && x < 185);
    pixels.set(wall ? [shade,shade,shade,255] : transparent ? [0,0,0,0] : [255,255,255,255], (y * 200 + x) * 4);
  }
  return { width: 200, height: 200, pixels: pixels.buffer };
}
for (const mode of modes) test(`${mode}の透明背景と細線を固定条件で比較する`, async () => {
  const opaque = await run(frame(false), mode), transparent = await run(frame(true), mode), thin = await run(frame(false, 1, 160), mode);
  console.log(JSON.stringify({ mode, opaque: opaque.lines.length / 4, transparent: transparent.lines.length / 4, thin: thin.lines.length / 4 }));
  assert.equal(opaque.lines.length / 4, 4);
  assert.equal(transparent.lines.length / 4, mode === 'baseline' ? 0 : 4);
  assert.equal(thin.lines.length / 4, mode === 'median' ? 0 : 4);
  if (['alpha-color', 'safe-alpha', 'guarded-clahe'].includes(mode)) {
    assert.deepEqual(transparent.lines, opaque.lines);
    assert.deepEqual(transparent.lineWidths, opaque.lineWidths);
    assert.equal(thin.lines.length / 4, 4);
  }
});
