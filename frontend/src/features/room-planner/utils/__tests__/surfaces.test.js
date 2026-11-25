import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSurfaces, isSurfaceSettings, migrateSurfaceSettings, surfacePresets } from '../../data/surfaces.js';

test('床と壁のテクスチャプリセットだけを有効な設定として受理する', () => {
  assert.equal(isSurfaceSettings(defaultSurfaces), true);
  assert.equal(isSurfaceSettings({ floor: 'oak', wall: 'gray' }), true);
  for (const value of [
    null,
    {},
    { floor: 'unknown', wall: 'white' },
    { floor: 'wood', wall: 'unknown' },
    { floor: 'wood', wall: 'white', extra: true },
  ]) assert.equal(isSurfaceSettings(value), false);
});

test('画像付きの床・壁プリセットは専用画像へ接続する', () => {
  assert.equal(surfacePresets.floor.oak.name, 'ホワイトウッド');
  assert.equal(surfacePresets.floor.oak.image, '/textures/light-oak-floor.jpg');
  assert.equal(surfacePresets.floor.natural.name, 'ナチュラルウッド');
  assert.equal(surfacePresets.floor.natural.image, '/textures/natural-wood-floor.jpg');
  assert.equal(surfacePresets.floor.natural.rotation, Math.PI / 2);
  assert.equal(surfacePresets.floor.dark.name, 'ダークウッド');
  assert.equal(surfacePresets.floor.dark.image, '/textures/dark-wood-floor.png');
  assert.equal(surfacePresets.floor.tatami.name, '畳');
  assert.equal(surfacePresets.floor.tatami.image, '/textures/tatami-floor.png');
  assert.equal(surfacePresets.floor.whiteTile.name, '白タイル');
  assert.equal(surfacePresets.floor.whiteTile.image, '/textures/white-tile-floor.jpg');
  assert.equal(surfacePresets.floor.concrete.name, 'コンクリート');
  assert.equal(surfacePresets.floor.concrete.image, '/textures/concrete-surface.jpg');
  assert.equal(surfacePresets.floor.carpet.name, 'カーペット');
  assert.equal(surfacePresets.floor.carpet.image, '/textures/beige-carpet-floor.jpg');
  for (const [key, name, image] of [
    ['white', 'ホワイト', '/textures/wall-white.png'],
    ['beige', 'ベージュ', '/textures/wall-beige.png'],
    ['gray', 'グレー', '/textures/wall-gray.png'],
    ['whiteWood', 'ホワイトウッド', '/textures/wall-white-wood.png'],
    ['naturalWood', 'ナチュラルウッド', '/textures/wall-natural-wood.png'],
    ['darkWood', 'ダークウッド', '/textures/wall-dark-wood.png'],
    ['concrete', 'コンクリート', '/textures/concrete-surface.jpg'],
  ]) {
    assert.equal(surfacePresets.wall[key].name, name);
    assert.equal(surfacePresets.wall[key].image, image);
  }
  assert.equal(surfacePresets.wall.concrete.image, surfacePresets.floor.concrete.image);
  assert.deepEqual(Object.keys(surfacePresets.wall), ['white', 'beige', 'gray', 'whiteWood', 'naturalWood', 'darkWood', 'concrete']);
});

test('すべてのプリセットに表示名と色を持つ', () => {
  for (const kind of ['floor', 'wall']) {
    for (const preset of Object.values(surfacePresets[kind])) {
      assert.equal(typeof preset.name, 'string');
      assert.match(preset.color, /^#[0-9a-f]{6}$/i);
    }
  }
});

test('削除した床材と壁紙は後継素材へ移行する', () => {
  assert.deepEqual(migrateSurfaceSettings({ floor: 'wood', wall: 'white' }), { floor: 'natural', wall: 'white' });
  assert.deepEqual(migrateSurfaceSettings({ floor: 'stone', wall: 'sage' }), { floor: 'concrete', wall: 'gray' });
  assert.deepEqual(migrateSurfaceSettings({ floor: 'natural', wall: 'concrete' }), { floor: 'natural', wall: 'concrete' });
});
