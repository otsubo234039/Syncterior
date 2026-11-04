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

test('private editing works without a configured API and sharing does not fabricate a link', async () => {
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

test('shares the current edited layout and waits for the initial stream state before editing', async () => {
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

test('keeps the local layout after a failed creation and permits retry', async () => {
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

test('opening a shared link loads the remote layout rather than publishing the default room', async () => {
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

test('rebases optimistic furniture edits onto concurrent remote edits and ignores old revisions', async () => {
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

test('acknowledgements prevent optimistic rotations from being applied twice', async () => {
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

test('coalesces unsent drag positions and sends them after the in-flight command', async () => {
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

test('remote deletion cannot be undone by a late local move', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'update', id: item.id, patch: { x: 1 } });
  c.handlers().state(snapshot({ revision: 1, items: [] }));
  assert.equal(c.session.getSnapshot().room.items.length, 0);
  c.session.stop();
});

test('remote plan changes discard old edits instead of applying them to a new layout', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'update', id: item.id, patch: { x: 1 } });
  c.handlers().state(snapshot({ planKey: 'family', planVersion: 1, revision: 1, items: [] }));
  assert.equal(c.session.getSnapshot().pending, 0);
  assert.match(c.session.getSnapshot().error, /間取り/);
  assert.equal(c.session.getSnapshot().room.planKey, 'family');
  c.session.stop();
});

test('blocks editing while a plan change is awaiting acknowledgement', async () => {
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

test('preserves pending edits on disconnect and does not unlock editing just because HTTP succeeds', async () => {
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

test('retries an uncertain command with the same id after reconnecting', async () => {
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

test('rolls back rejected edits and displays the server error', async () => {
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

test('404 and invalid snapshots keep unknown rooms uneditable', async () => {
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

test('leaving a room unsubscribes, removes the shared id, and ignores late responses', async () => {
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

test('supports effect cleanup and remount without retaining old stream callbacks', async () => {
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

test('link helpers preserve other URL parameters and reject empty room ids', () => {
  const url = roomLink('https://example.com/planner?theme=light#view', roomId);
  assert.equal(sharedRoomId(url), roomId);
  assert.equal(roomLink(url, null), 'https://example.com/planner?theme=light#view');
  assert.equal(sharedRoomId('https://example.com/?room='), 'invalid');
});

test('operations clamp furniture positions and accumulate rotations without mutating previous state', () => {
  const previous = initialRoom();
  const next = applyRoomOperation(previous, { type: 'update', id: item.id, patch: { x: 999, z: -999 } });
  assert.equal(next.items[0].x, 5.4 / 2 - item.w / 2);
  assert.equal(next.items[0].z, -4.2 / 2 + item.d / 2);
  assert.equal(previous.items[0].x, 0);
  const rotated = applyRoomOperation(applyRoomOperation(next, { type: 'rotate', id: item.id }), { type: 'rotate', id: item.id });
  assert.equal(rotated.items[0].rot, Math.PI);
});

test('two client sessions converge after concurrent changes through the proposed API contract', async () => {
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

test('a stream startup failure after creation never turns shared edits into unsynchronized local edits', async () => {
  const c = setup();
  c.api.subscribe = () => { throw Error('配信に接続できません'); };
  c.session.start();
  assert.equal(await c.session.share(), null);
  assert.equal(c.session.getSnapshot().roomId, roomId);
  assert.equal(c.session.getSnapshot().status, 'error');
  assert.equal(c.session.dispatch({ type: 'remove', id: item.id }), false);
  c.session.stop();
});

test('a malformed conflict response fails safely instead of throwing out of the send loop', async () => {
  const c = setup({ shared: true });
  await connected(c);
  c.session.dispatch({ type: 'rotate', id: item.id });
  c.responses[0].reject(Object.assign(Error('競合'), { status: 409, snapshot: { items: null } }));
  await tick();
  assert.equal(c.session.getSnapshot().status, 'error');
  assert.match(c.session.getSnapshot().error, /共有データ/);
  c.session.stop();
});

test('a lost HTTP response does not retry a command already confirmed by the stream', async () => {
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
