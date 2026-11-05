import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoomSession } from '../room-session.js';
import { applyRoomOperation } from '../room-state.js';
import { roomLink, sharedRoomId } from '../room-link.js';

const roomId = 'a'.repeat(32);
const item = { id: 'sofa1', type: 'sofa', name: 'ソファ', w: 1.6, d: .82, h: .78, color: '#9eab9a', x: 0, z: 0, rot: 0 };
const initialRoom = () => ({ planKey: 'studio', items: [{ ...item }, { ...item, id: 'sofa2' }] });
const snapshot = (patch = {}) => ({ ...initialRoom(), id: roomId, revision: 0, planVersion: 0, appliedOperationIds: [], ...patch });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup({ shared = false, configured = true } = {}) {
  let handlers;
  let counter = 0;
  let closed = 0;
  const sent = [];
  const changes = [];
  const responses = [];
  const api = {
    configured,
    create: async room => snapshot(room),
    get: async () => snapshot(),
    send: async (id, command) => {
      sent.push(structuredClone(command));
      const response = deferred();
      responses.push(response);
      return response.promise;
    },
    subscribe(id, callbacks) { handlers = callbacks; return () => { closed++; }; },
  };
  const session = createRoomSession({ api, initialRoom: initialRoom(), roomId: shared ? roomId : null,
    onRoomChange: id => changes.push(id), makeId: () => `command-${++counter}` });
  return { api, session, sent, changes, responses, handlers: () => handlers, closed: () => closed };
}
async function connected(context) {
  context.session.start();
  await tick();
  context.handlers().state(snapshot());
}

test('API未設定でも個人編集ができ、無効な共有リンクを発行しない', async () => {
  const { session, changes } = setup({ configured: false });
  session.start();
  session.dispatch({ type: 'update', id: item.id, patch: { x: 1 } });
  assert.equal(session.getSnapshot().room.items[0].x, 1);
  assert.equal(await session.share(), null);
  assert.equal(session.getSnapshot().status, 'local');
  assert.match(session.getSnapshot().error, /現在利用できません/);
  assert.deepEqual(changes, []);
  session.stop();
});

test('編集中の配置を共有し、初回の配信データを受け取ってから編集を許可する', async () => {
  const c = setup();
  c.session.start();
  c.session.dispatch({ type: 'update', id: item.id, patch: { color: '#112233' } });
  let uploaded;
  c.api.create = async room => { uploaded = room; return snapshot(room); };
  assert.equal(await c.session.share(), roomId);
  assert.equal(uploaded.items[0].color, '#112233');
  assert.deepEqual(c.changes, [roomId]);
  assert.equal(c.session.getSnapshot().status, 'connecting');
  assert.equal(c.session.dispatch({ type: 'remove', id: item.id }), false);
  c.handlers().state(snapshot(uploaded));
  c.handlers().presence(2);
  assert.equal(c.session.getSnapshot().status, 'connected');
  assert.equal(c.session.getSnapshot().participants, 2);
  c.session.stop();
});

test('共有部屋の作成失敗時も個人用の配置を保ち、再試行できる', async () => {
  const c = setup();
  c.session.start();
  c.api.create = async () => { throw Error('接続に失敗しました'); };
  await c.session.share();
  assert.equal(c.session.getSnapshot().status, 'local');
  assert.equal(c.session.getSnapshot().room.items.length, 2);
  c.api.create = async () => snapshot();
  assert.equal(await c.session.share(), roomId);
  c.session.stop();
});

test('共有リンクを開くと共有先の配置を読み込み、初期配置を送信しない', async () => {
  const c = setup({ shared: true });
  c.api.get = async () => snapshot({ planKey: 'family', items: [] });
  c.session.start();
  assert.equal(c.session.getSnapshot().loaded, false);
  await tick();
  assert.equal(c.session.getSnapshot().room.planKey, 'family');
  assert.deepEqual(c.sent, []);
  c.handlers().state(snapshot({ planKey: 'family', items: [] }));
  assert.equal(c.session.getSnapshot().loaded, true);
  c.session.stop();
});

test('同時に受信した変更に未確定の家具操作を重ね、古いリビジョンを無視する', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'update', id: 'sofa1', patch: { x: 1 } });
  const remote = snapshot({ revision: 1, items: [{ ...item }, { ...item, id: 'sofa2', color: '#123456' }] });
  c.handlers().state(remote);
  assert.equal(c.session.getSnapshot().room.items[0].x, 1);
  assert.equal(c.session.getSnapshot().room.items[1].color, '#123456');
  c.handlers().state(snapshot());
  assert.equal(c.session.getSnapshot().room.items[1].color, '#123456');
  c.responses[0].resolve({ ...remote, revision: 2,
    items: [{ ...item, x: 1 }, remote.items[1]], appliedOperationIds: [c.sent[0].id] });
  await tick();
  assert.equal(c.session.getSnapshot().pending, 0);
  assert.equal(c.session.getSnapshot().room.items[0].x, 1);
  c.session.stop();
});

test('操作の確定通知によって回転の二重適用を防ぐ', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'rotate', id: item.id });
  const acknowledged = snapshot({ revision: 2, items: [{ ...item, rot: Math.PI / 2 }], appliedOperationIds: [c.sent[0].id] });
  c.handlers().state(acknowledged);
  assert.equal(c.session.getSnapshot().room.items[0].rot, Math.PI / 2);
  c.responses[0].resolve(acknowledged);
  await tick();
  assert.equal(c.session.getSnapshot().room.items[0].rot, Math.PI / 2);
  assert.equal(c.session.getSnapshot().pending, 0);
  c.session.stop();
});

test('未送信のドラッグ位置をまとめ、送信中の操作が完了してから送る', async () => {
  const c = setup({ shared: true });
  await connected(c);
  for (const x of [.1, .2, .3, .4]) c.session.dispatch({ type: 'update', id: item.id, patch: { x } });
  assert.equal(c.sent.length, 1);
  assert.equal(c.session.getSnapshot().pending, 2);
  c.responses[0].resolve(snapshot({ revision: 1, items: [{ ...item, x: .1 }], appliedOperationIds: [c.sent[0].id] }));
  await tick();
  assert.equal(c.sent.length, 2);
  assert.equal(c.sent[1].operation.patch.x, .4);
  c.responses[1].resolve(snapshot({ revision: 2, items: [{ ...item, x: .4 }], appliedOperationIds: c.sent.map(command => command.id) }));
  await tick();
  assert.equal(c.session.getSnapshot().pending, 0);
  c.session.stop();
});

test('他の参加者が削除した家具を遅延した移動操作で復活させない', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'update', id: item.id, patch: { x: 1 } });
  c.handlers().state(snapshot({ revision: 1, items: [] }));
  assert.equal(c.session.getSnapshot().room.items.length, 0);
  c.session.stop();
});

test('他の参加者が間取りを変更した場合、旧間取りへの操作を破棄する', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'update', id: item.id, patch: { x: 1 } });
  c.handlers().state(snapshot({ planKey: 'family', planVersion: 1, revision: 1, items: [] }));
  assert.equal(c.session.getSnapshot().pending, 0);
  assert.match(c.session.getSnapshot().error, /間取り/);
  assert.equal(c.session.getSnapshot().room.planKey, 'family');
  c.session.stop();
});

test('間取り変更の確定通知を待っている間は編集を停止する', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'change-plan', planKey: 'family', items: [] });
  assert.equal(c.session.getSnapshot().changingPlan, true);
  assert.equal(c.session.dispatch({ type: 'add', item }), false);
  c.responses[0].resolve(snapshot({ planKey: 'family', planVersion: 1, revision: 1, items: [], appliedOperationIds: [c.sent[0].id] }));
  await tick();
  assert.equal(c.session.getSnapshot().changingPlan, false);
  c.session.stop();
});

test('切断時に未確定操作を保持し、HTTP応答の成功だけでは編集を再開しない', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'update', id: item.id, patch: { x: 1 } });
  c.handlers().disconnected();
  assert.equal(c.session.dispatch({ type: 'remove', id: item.id }), false);
  c.responses[0].resolve(snapshot({ revision: 1, items: [{ ...item, x: 1 }], appliedOperationIds: [c.sent[0].id] }));
  await tick();
  assert.equal(c.session.getSnapshot().status, 'reconnecting');
  c.handlers().state(snapshot({ revision: 1, items: [{ ...item, x: 1 }], appliedOperationIds: [c.sent[0].id] }));
  assert.equal(c.session.getSnapshot().status, 'connected');
  c.session.stop();
});

test('確定を確認できない操作は再接続後に同じIDで再送する', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'rotate', id: item.id });
  c.responses[0].reject(Error('network error'));
  await tick();
  assert.equal(c.session.getSnapshot().pending, 1);
  assert.equal(c.session.getSnapshot().status, 'reconnecting');
  await c.session.reconnect();
  c.handlers().state(snapshot());
  assert.equal(c.sent.length, 2);
  assert.equal(c.sent[1].id, c.sent[0].id);
  c.session.stop();
});

test('拒否された操作を取り消し、サーバーのエラーを表示する', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'update', id: item.id, patch: { color: '#112233' } });
  c.responses[0].reject(Object.assign(Error('変更できません'), { status: 400 }));
  await tick();
  assert.equal(c.session.getSnapshot().room.items[0].color, item.color);
  assert.equal(c.session.getSnapshot().pending, 0);
  assert.equal(c.session.getSnapshot().error, '変更できません');
  c.session.stop();
});

test('404応答や不正なスナップショットを受信した部屋は編集できない', async () => {
  const c = setup({ shared: true });
  c.api.get = async () => { throw Object.assign(Error('部屋がありません'), { status: 404 }); };
  c.session.start();
  await tick();
  assert.equal(c.session.getSnapshot().status, 'error');
  assert.equal(c.session.getSnapshot().loaded, false);
  c.api.get = async () => snapshot({ planKey: 'invalid' });
  await c.session.reconnect();
  assert.equal(c.session.getSnapshot().status, 'error');
  assert.equal(c.session.dispatch({ type: 'remove', id: item.id }), false);
  c.session.stop();
});

test('退出時に配信購読と共有IDを解除し、遅れて届いた応答を無視する', async () => {
  const c = setup({ shared: true });
  await connected(c);
  const oldHandlers = c.handlers();
  c.session.dispatch({ type: 'rotate', id: item.id });
  c.session.leave();
  assert.equal(c.closed(), 1);
  assert.deepEqual(c.changes, [null]);
  assert.equal(c.session.getSnapshot().roomId, null);
  assert.equal(c.session.getSnapshot().status, 'local');
  oldHandlers.state(snapshot({ items: [] }));
  c.responses[0].resolve(snapshot({ items: [] }));
  await tick();
  assert.equal(c.session.getSnapshot().room.items.length, 2);
  assert.equal(c.session.getSnapshot().room.items[0].rot, 0);
  c.session.stop();
});

test('古い配信コールバックを残さず、後片付けと再マウントに対応する', async () => {
  const c = setup({ shared: true });
  await connected(c);
  const oldHandlers = c.handlers();
  c.session.stop();
  c.session.start();
  await tick();
  oldHandlers.state(snapshot({ revision: 99, items: [] }));
  c.handlers().state(snapshot());
  assert.equal(c.session.getSnapshot().room.items.length, 2);
  assert.equal(c.session.getSnapshot().status, 'connected');
  c.session.stop();
});

test('共有リンクの操作で他のURLパラメーターを保ち、空の部屋IDを不正と判定する', () => {
  const url = roomLink('https://example.com/planner?theme=light#view', roomId);
  assert.equal(sharedRoomId(url), roomId);
  assert.equal(roomLink(url, null), 'https://example.com/planner?theme=light#view');
  assert.equal(sharedRoomId('https://example.com/?room='), 'invalid');
});

test('元の状態を変更せず、家具の位置を部屋の範囲に収めて回転を積算する', () => {
  const previous = initialRoom();
  const next = applyRoomOperation(previous, { type: 'update', id: item.id, patch: { x: 999, z: -999 } });
  assert.equal(next.items[0].x, 5.4 / 2 - item.w / 2);
  assert.equal(next.items[0].z, -4.2 / 2 + item.d / 2);
  assert.equal(previous.items[0].x, 0);
  const rotated = applyRoomOperation(applyRoomOperation(next, { type: 'rotate', id: item.id }), { type: 'rotate', id: item.id });
  assert.equal(rotated.items[0].rot, Math.PI);
});

test('API仕様案に沿った同時操作後に2つのクライアントの状態が一致する', async () => {
  // This adapter exists only in tests; the product still requires a real API.
  let stored = snapshot();
  const subscribers = new Set();
  const api = {
    configured: true,
    get: async () => structuredClone(stored),
    subscribe(id, handlers) {
      subscribers.add(handlers);
      queueMicrotask(() => {
        handlers.state(structuredClone(stored));
        subscribers.forEach(subscriber => subscriber.presence(subscribers.size));
      });
      return () => subscribers.delete(handlers);
    },
    async send(id, command) {
      await tick();
      if (!stored.appliedOperationIds.includes(command.id)) {
        stored = { ...applyRoomOperation(stored, command.operation), revision: stored.revision + 1,
          appliedOperationIds: [...stored.appliedOperationIds, command.id] };
        subscribers.forEach(handlers => handlers.state(structuredClone(stored)));
      }
      return structuredClone(stored);
    },
  };
  let sequence = 0;
  const options = { api, initialRoom: initialRoom(), roomId, makeId: () => `operation-${++sequence}` };
  const first = createRoomSession(options);
  const second = createRoomSession(options);
  first.start();
  second.start();
  await tick();
  assert.equal(first.getSnapshot().participants, 2);
  first.dispatch({ type: 'update', id: 'sofa1', patch: { x: 1 } });
  second.dispatch({ type: 'update', id: 'sofa2', patch: { color: '#abcdef' } });
  await tick();
  await tick();
  assert.deepEqual(first.getSnapshot().room, second.getSnapshot().room);
  assert.equal(first.getSnapshot().room.items[0].x, 1);
  assert.equal(first.getSnapshot().room.items[1].color, '#abcdef');
  first.dispatch({ type: 'rotate', id: 'sofa1' });
  second.dispatch({ type: 'rotate', id: 'sofa1' });
  await tick();
  await tick();
  assert.equal(first.getSnapshot().room.items[0].rot, Math.PI);
  assert.deepEqual(first.getSnapshot().room, second.getSnapshot().room);
  first.stop();
  second.stop();
});

test('共有作成後に配信の接続に失敗しても、未同期の個人編集へ切り替えない', async () => {
  const c = setup();
  c.api.subscribe = () => { throw Error('配信に接続できません'); };
  c.session.start();
  assert.equal(await c.session.share(), null);
  assert.equal(c.session.getSnapshot().roomId, roomId);
  assert.equal(c.session.getSnapshot().status, 'error');
  assert.equal(c.session.dispatch({ type: 'remove', id: item.id }), false);
  c.session.stop();
});

test('競合応答が不正な場合も送信処理から例外を漏らさず編集を停止する', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'rotate', id: item.id });
  c.responses[0].reject(Object.assign(Error('競合'), { status: 409, snapshot: { items: null } }));
  await tick();
  assert.equal(c.session.getSnapshot().status, 'error');
  assert.match(c.session.getSnapshot().error, /共有データ/);
  c.session.stop();
});

test('HTTP応答が失われても配信で確定済みの操作は再送しない', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'rotate', id: item.id });
  c.handlers().state(snapshot({ revision: 1, items: [{ ...item, rot: Math.PI / 2 }], appliedOperationIds: [c.sent[0].id] }));
  c.responses[0].reject(Error('response lost'));
  await tick();
  assert.equal(c.session.getSnapshot().pending, 0);
  assert.equal(c.session.getSnapshot().status, 'connected');
  assert.equal(c.sent.length, 1);
  c.session.stop();
});
