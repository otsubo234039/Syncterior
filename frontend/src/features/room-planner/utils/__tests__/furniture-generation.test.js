import { test } from 'node:test';
import assert from 'node:assert/strict';
import { furnitureGenerationRequest, readFurnitureImages, runFurnitureGeneration, validateFurnitureImages } from '../furniture-generation.js';

const image = (name = '家具.png') => new File(['photo'], name, { type: 'image/png' });
const draft = () => ({ images: [image()], name: '  写真の机  ' });
const glb = () => new File([new Uint8Array(28)], '生成した机.glb', { type: 'model/gltf-binary' });

test('1〜4枚の元画像と名前をサービスに依存しない入力へ変換し、寸法を含めない', () => {
  for (const count of [1, 4]) {
    const input = { ...draft(), w: 1.2, d: .6, h: .8, images: Array.from({ length: count }, () => image()) };
    const request = furnitureGenerationRequest(input);
    assert.deepEqual(request, { images: input.images, name: '写真の机' });
    assert.notEqual(request.images, input.images);
    assert.equal(request.images[0], input.images[0]);
  }
});

test('枚数・形式・空画像・容量と、未入力・長すぎる名前を拒否する', () => {
  const good = { type: 'image/png', size: 10 * 1024 * 1024 };
  assert.doesNotThrow(() => validateFurnitureImages([good], 3));
  for (const [files, count] of [[[], 0], [[good], 4], [Array(5).fill(good), 0],
    [[{ ...good, size: 0 }], 0], [[{ ...good, size: good.size + 1 }], 0], [[{ ...good, type: 'image/svg+xml' }], 0]]) {
    assert.throws(() => validateFurnitureImages(files, count));
  }
  for (const patch of [{ name: ' ' }, { name: 'あ'.repeat(81) }]) {
    assert.throws(() => furnitureGenerationRequest({ ...draft(), ...patch }));
  }
});

test('画像のデコード後にビットマップを閉じ、不正画像で作成済みURLも解放する', async () => {
  const closed = [], revoked = [];
  const valid = image('正面.png'), invalid = image('巨大.png');
  const options = {
    decode: async file => ({ width: file === invalid ? 8193 : 100, height: 100, close: () => closed.push(file.name) }),
    createUrl: file => `blob:${file.name}`, revokeUrl: url => revoked.push(url),
  };
  await assert.rejects(readFurnitureImages([valid, invalid], new AbortController().signal, options), /32〜8192/);
  assert.deepEqual(closed, ['正面.png', '巨大.png']);
  assert.deepEqual(revoked, ['blob:正面.png']);
  for (const [width, height] of [[31, 32], [32, 31], [32, 8193], [5000, 5000]]) {
    await assert.rejects(readFurnitureImages([valid], new AbortController().signal,
      { ...options, decode: async () => ({ width, height, close() {} }) }), /2000万画素/);
  }
  const result = await readFurnitureImages([valid], new AbortController().signal, options);
  assert.equal(result[0].file, valid); assert.equal(result[0].url, 'blob:正面.png');
  await assert.rejects(readFurnitureImages([valid], new AbortController().signal,
    { ...options, decode: async () => { throw new Error('破損'); } }), /画像を読み込めません/);
});

test('画像の読み込み中止後はURLを作らず、遅れて取得したビットマップを閉じる', async () => {
  const controller = new AbortController(); let closed = 0;
  await assert.rejects(readFurnitureImages([image()], controller.signal, {
    decode: async () => { controller.abort(); return { width: 32, height: 32, close: () => closed++ }; },
    createUrl: () => { assert.fail('中止後はURLを作成しない'); },
  }), { name: 'AbortError' });
  assert.equal(closed, 1);
});

test('接続関数へ画像と中止シグナルを渡し、進捗を検証してGLBと配置用の入力を返す', async () => {
  const controller = new AbortController(), progress = [];
  const file = glb(); let late;
  const result = await runFurnitureGeneration(async (request, options) => {
    assert.equal(request.images[0].name, '家具.png');
    assert.equal(options.signal, controller.signal);
    options.onProgress({ phase: 'queued' });
    options.onProgress({ phase: 'running', progress: 200 });
    options.onProgress({ phase: 'running', progress: -1 });
    options.onProgress({ phase: 'running', progress: NaN });
    options.onProgress({ phase: 'success', progress: 100 });
    late = options.onProgress;
    return { file };
  }, draft(), { signal: controller.signal, onProgress: value => progress.push(value) });
  assert.deepEqual(result, { file, metadata: { name: '写真の机' } });
  assert.deepEqual(progress, [{ phase: 'queued', progress: null }, { phase: 'running', progress: 100 },
    { phase: 'running', progress: 0 }, { phase: 'running', progress: null }]);
  late({ phase: 'running', progress: 50 }); assert.equal(progress.length, 4);
});

test('接続未設定・生成失敗・欠落結果・GLB以外の結果を拒否し、再試行は明示的な呼び出しだけで行う', async () => {
  const options = { signal: new AbortController().signal };
  await assert.rejects(runFurnitureGeneration(null, draft(), options), /モデルを作成できません/);
  let calls = 0;
  const generate = async () => { calls++; throw new Error('作成できませんでした'); };
  await assert.rejects(runFurnitureGeneration(generate, draft(), options), /作成できません/);
  assert.equal(calls, 1);
  for (const result of [null, {}, { file: new File(['text'], 'a.glb') }, { file: new File([new Uint8Array(28)], 'a.fbx') },
    { file: new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.glb') }]) {
    await assert.rejects(runFurnitureGeneration(async () => result, draft(), options), /20MB以下のGLB/);
  }
});

test('接続側が中止に応答しなくても終了し、遅い結果と進捗を適用しない', async () => {
  const controller = new AbortController(); let finish, notify;
  const pending = runFurnitureGeneration((_request, options) => new Promise(resolve => {
    finish = resolve; notify = options.onProgress;
  }), draft(), { signal: controller.signal, onProgress: () => assert.fail('中止後の進捗') });
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  notify({ phase: 'running', progress: 100 }); finish({ file: glb() });
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(runFurnitureGeneration(() => assert.fail('中止後の送信'), draft(), { signal: cancelled.signal }), { name: 'AbortError' });
});
