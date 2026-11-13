import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalRoomStorage, LOCAL_ROOM_KEY } from '../local-room-storage.js';
import { initialFurniture } from '../furniture.js';
import { createRoomSession } from '../room-session.js';
import { newDrawing } from '../drawing-document.js';

const room = () => ({ planKey: 'studio', items: initialFurniture('studio') });
const encoded = layout => JSON.stringify({ version: 1, room: layout });
function setup(initial = null) {
  const data = new Map(initial === null ? [] : [[LOCAL_ROOM_KEY, initial]]);
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
  return { storage, data, local: createLocalRoomStorage(() => storage) };
}

test('保存がない場合は復元せず、初期表示だけでは保存領域を変更しない', () => {
  const { local, data } = setup();
  assert.deepEqual(local.load(), { room: null, error: '' });
  assert.equal(data.size, 0);
});

test('custom配置の元図面IDをモデル外に保存し、従来形式とプリセットの保存を維持する', () => {
  const { local, data } = setup();
  const layout = { planKey: 'custom', customPlan: newDrawing(), items: [] };
  assert.equal(local.save(layout, 'drawing-a').error, '');
  assert.deepEqual(local.load(), { room: layout, drawingId: 'drawing-a', error: '' });
  assert.equal(Object.hasOwn(JSON.parse(data.get(LOCAL_ROOM_KEY)).room, 'drawingId'), false);
  assert.equal(local.save(layout).error, '');
  assert.deepEqual(local.load(), { room: layout, error: '' });
  assert.equal(local.save(room(), 'drawing-a').error, '');
  assert.equal(Object.hasOwn(JSON.parse(data.get(LOCAL_ROOM_KEY)), 'drawingId'), false);
  const before = data.get(LOCAL_ROOM_KEY);
  assert.ok(local.save(layout, '../bad').error);
  assert.equal(data.get(LOCAL_ROOM_KEY), before);
  for (const drawingId of [null, {}, '']) {
    data.set(LOCAL_ROOM_KEY, JSON.stringify({ version: 2, room: layout, drawingId }));
    assert.ok(local.load().error);
  }
  data.set(LOCAL_ROOM_KEY, JSON.stringify({ version: 1, room: room(), drawingId: 'drawing-a' }));
  assert.ok(local.load().error);
});

test('間取り・位置・回転・色・家具IDをバージョン付きで保存し、独立した配置として復元する', () => {
  const { local, data } = setup();
  const layout = room();
  layout.items[0] = { ...layout.items[0], x: -1, z: .3, rot: Math.PI / 2, color: '#123456' };
  assert.equal(local.save(layout).error, '');
  assert.equal(JSON.parse(data.get(LOCAL_ROOM_KEY)).version, 1);
  const restored = local.load();
  assert.equal(restored.error, '');
  assert.deepEqual(restored.room, layout);
  restored.room.items[0].color = '#000000';
  assert.equal(local.load().room.items[0].color, '#123456');
  assert.equal(layout.items[0].color, '#123456');
});

test('家具がない配置と上限200点の配置を復元できる', () => {
  for (const count of [0, 200]) {
    const { local } = setup();
    const layout = room();
    layout.items = Array.from({ length: count }, (_, i) => ({ ...layout.items[0], id: `item-${i}` }));
    assert.equal(local.save(layout).error, '');
    assert.deepEqual(local.load().room, layout);
  }
});

const invalid = [
  ['壊れたJSON', '{'], ['null', 'null'], ['未知のバージョン', JSON.stringify({ version: 2, room: room() })],
  ['版の欠落', JSON.stringify({ room: room() })], ['大きすぎるデータ', 'x'.repeat(1_000_001)],
  ['未対応の間取り', encoded({ ...room(), planKey: 'unknown' })],
  ['重複ID', encoded({ ...room(), items: [room().items[0], { ...room().items[0], id: 'same' }, { ...room().items[0], id: 'same' }] })],
  ['不正な色', encoded({ ...room(), items: [{ ...room().items[0], color: 'red' }] })],
  ['不正な寸法', encoded({ ...room(), items: [{ ...room().items[0], w: -1 }] })],
  ['不正な座標', encoded({ ...room(), items: [{ ...room().items[0], x: null }] })],
  ['回転後のはみ出し', encoded({ ...room(), items: [{ ...room().items[2], x: 2, rot: Math.PI / 2 }] })],
  ['家具数の超過', encoded({ ...room(), items: Array.from({ length: 201 }, (_, i) => ({ ...room().items[0], id: `item-${i}` })) })],
  ['共有部屋IDの混入', encoded({ ...room(), id: 'a'.repeat(32) })],
  ['未確定操作の混入', JSON.stringify({ version: 1, room: room(), pending: [] })],
];
for (const [label, raw] of invalid) {
  test(`${label}は復元せず、元の保存内容を勝手に消去しない`, () => {
    const { local, data } = setup(raw);
    const loaded = local.load();
    assert.equal(loaded.room, null);
    assert.notEqual(loaded.error, '');
    assert.equal(data.get(LOCAL_ROOM_KEY), raw);
  });
}

test('共有用メタデータ・選択・視点を保存せず、間取りと家具だけを保持する', () => {
  const { local, data } = setup();
  const layout = room();
  assert.equal(local.save({ ...layout, id: 'a'.repeat(32), pending: ['rotate'], revision: 20,
    camera: [1, 2, 3], selected: layout.items[0].id }).error, '');
  assert.deepEqual(JSON.parse(data.get(LOCAL_ROOM_KEY)), { version: 1, room: layout });
});

test('容量不足で保存できなくても直前の保存内容を保持し、次の編集で再試行できる', () => {
  const previous = encoded(room());
  const { local, storage, data } = setup(previous);
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const layout = room();
  assert.notEqual(local.save(layout).error, '');
  assert.equal(data.get(LOCAL_ROOM_KEY), previous);
  storage.setItem = write;
  assert.equal(local.save(layout).error, '');
  assert.deepEqual(local.load().room, layout);
});

test('ストレージ自体へのアクセス拒否でも読み込み・保存・消去が例外を漏らさない', () => {
  const local = createLocalRoomStorage(() => { throw new Error('SecurityError'); });
  assert.notEqual(local.load().error, '');
  assert.notEqual(local.save(room()).error, '');
  assert.notEqual(local.clear().error, '');
});

test('消去は個人配置のキーだけを削除し、失敗時は保存内容を維持する', () => {
  const { local, storage, data } = setup(encoded(room()));
  data.set('other-app', 'keep');
  const remove = storage.removeItem;
  storage.removeItem = () => { throw new Error('SecurityError'); };
  assert.notEqual(local.clear().error, '');
  assert.ok(data.has(LOCAL_ROOM_KEY));
  storage.removeItem = remove;
  assert.equal(local.clear().error, '');
  assert.equal(data.has(LOCAL_ROOM_KEY), false);
  assert.equal(data.get('other-app'), 'keep');
});

test('不正な配置は保存せず、以前の個人保存を維持する', () => {
  const raw = encoded(room());
  const { local, data } = setup(raw);
  assert.notEqual(local.save({ planKey: 'unknown', items: [] }).error, '');
  assert.equal(data.get(LOCAL_ROOM_KEY), raw);
});

test('個人編集だけを保存し、共有の読み込み・未確定操作・再接続・退出では保存内容を変えない', async () => {
  const localChanges = [];
  const layout = room();
  const id = 'a'.repeat(32);
  let handlers;
  const snapshot = { ...layout, id, revision: 0, planVersion: 0, appliedOperationIds: [] };
  const api = {
    configured: true, get: async () => snapshot, create: async () => snapshot,
    send: () => new Promise(() => {}),
    subscribe: (roomId, callbacks) => { handlers = callbacks; return () => {}; },
  };
  const session = createRoomSession({ api, initialRoom: layout,
    onLocalChange: value => localChanges.push(structuredClone(value)), makeId: () => 'command-1' });
  session.start();
  session.dispatch({ type: 'update', id: layout.items[0].id, patch: { color: '#123456' } });
  assert.equal(localChanges.length, 1);
  await session.share();
  handlers.state(snapshot);
  session.dispatch({ type: 'rotate', id: layout.items[0].id });
  assert.equal(session.getSnapshot().pending, 1);
  handlers.disconnected();
  await session.reconnect();
  handlers.state(snapshot);
  session.leave();
  assert.equal(localChanges.length, 1);
  session.dispatch({ type: 'remove', id: layout.items[0].id });
  assert.equal(localChanges.length, 2);
  session.stop();
  session.start();
  session.stop();
  assert.equal(localChanges.length, 2);

  const guest = createRoomSession({ api, initialRoom: room(), roomId: id,
    onLocalChange: () => assert.fail('共有部屋を個人保存した') });
  guest.start();
  await new Promise(resolve => setImmediate(resolve));
  handlers.state(snapshot);
  guest.dispatch({ type: 'rotate', id: layout.items[0].id });
  guest.stop();
});
