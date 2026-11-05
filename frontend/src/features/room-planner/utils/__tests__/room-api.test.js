import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoomApi, RoomApiError, resolveRoomApiUrl } from '../../api/room-api.js';

const roomId = 'a'.repeat(32);

test('API未設定時は意図しない接続先へ通信せず、利用不可を通知する', async () => {
  const api = createRoomApi('', { fetcher: () => assert.fail('unexpected request') });
  assert.equal(api.configured, false);
  await assert.rejects(api.create({}), error => error instanceof RoomApiError && error.status === 503);
});

test('設定したベースURLへ操作データをJSON形式で送信する', async () => {
  const calls = [];
  const api = createRoomApi('https://example.com/api/', { fetcher: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ id: roomId }) };
  } });
  await api.create({ planKey: 'studio', items: [] });
  await api.get(roomId);
  await api.send(roomId, { id: 'operation1', planVersion: 0, operation: { type: 'remove', id: 'sofa1' } });
  assert.equal(calls[0].url, 'https://example.com/api/rooms');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(JSON.parse(calls[0].options.body).planKey, 'studio');
  assert.equal(calls[1].url, `https://example.com/api/rooms/${roomId}`);
  assert.equal(calls[2].url, `https://example.com/api/rooms/${roomId}/operations`);
  assert.equal(JSON.parse(calls[2].options.body).operation.type, 'remove');
});

test('競合時のスナップショットを保持し、HTTP・通信・JSON形式のエラーを区別する', async () => {
  const conflict = { planVersion: 1 };
  const api = createRoomApi('/api', { fetcher: async () => ({ ok: false, status: 409, json: async () => ({ error: '間取りを変更しました', snapshot: conflict }) }) });
  await assert.rejects(api.send(roomId, {}), error => error.status === 409 && error.snapshot === conflict);
  const network = createRoomApi('/api', { fetcher: async () => { throw Error('offline'); } });
  await assert.rejects(network.get(roomId), error => error.status === 0);
  const html = createRoomApi('/api', { fetcher: async () => ({ json: async () => { throw Error('HTML response'); } }) });
  await assert.rejects(html.get(roomId), error => error.status === 502);
});

test('配置・参加人数・切断・不正イベントの受信と配信接続の後片付けに対応する', () => {
  let source;
  class FakeEventSource {
    constructor(url) { this.url = url; this.handlers = {}; source = this; }
    addEventListener(name, handler) { this.handlers[name] = handler; }
    close() { this.closed = true; }
  }
  const received = [];
  const api = createRoomApi('/api', { EventSourceClass: FakeEventSource });
  const close = api.subscribe(roomId, {
    state: value => received.push(value), presence: value => received.push(value),
    disconnected: () => received.push('offline'), invalid: () => received.push('invalid'),
  });
  assert.equal(source.url, `/api/rooms/${roomId}/events`);
  source.handlers.state({ data: '{"revision":1}' });
  source.handlers.presence({ data: '{"participants":2}' });
  source.onerror();
  source.handlers.state({ data: 'not JSON' });
  source.handlers.presence({ data: '{"participants":-1}' });
  assert.deepEqual(received, [{ revision: 1 }, 2, 'offline', 'invalid', 'invalid']);
  close();
  assert.equal(source.closed, true);
});


test('実行時のAPI設定がビルド時の設定に優先し、空文字で共有を無効にできる', () => {
  assert.equal(resolveRoomApiUrl({ roomApiUrl: '/runtime-api' }, '/build-api'), '/runtime-api');
  assert.equal(resolveRoomApiUrl({ roomApiUrl: '' }, '/build-api'), '');
  assert.equal(createRoomApi(resolveRoomApiUrl({ roomApiUrl: '' }, '/build-api')).configured, false);
});

test('実行時のAPI設定が未指定または不正なら従来のビルド時設定を使用する', () => {
  for (const runtime of [undefined, null, {}, { roomApiUrl: 123 }, { roomApiUrl: null }]) {
    assert.equal(resolveRoomApiUrl(runtime, '/build-api'), '/build-api');
  }
  assert.equal(resolveRoomApiUrl(undefined, ''), '');
  assert.equal(resolveRoomApiUrl(undefined, undefined), undefined);
});
