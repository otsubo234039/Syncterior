import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
let ready;
export async function runOpenCvWorker(image) {
  const cv = require('@techstark/opencv-js');
  ready ??= cv.Mat ? Promise.resolve() : new Promise(resolve => cv.then(() => resolve()));
  await ready;
  let result;
  const self = { cv, postMessage: data => { result = data; } };
  const context = vm.createContext({ self, importScripts() {}, Uint8Array, Uint8ClampedArray, Int32Array, Array, Math, Promise });
  vm.runInContext(await readFile(new URL('../../opencv-worker.js', import.meta.url), 'utf8'), context);
  await self.onmessage({ data: image });
  if (result.error) throw new Error(result.error);
  // VMの配列を呼び出し側のRealmへ戻す。
  return structuredClone(result);
}
