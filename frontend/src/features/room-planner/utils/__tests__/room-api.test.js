import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoomApi, RoomApiError } from '../../api/room-api.js';

const roomId = 'a'.repeat(32);

test('an unconfigured API fails explicitly without contacting an accidental endpoint', async () => {
  const api = createRoomApi('', { fetcher: () => assert.fail('unexpected request') });
  assert.equal(api.configured, false);
  await assert.rejects(api.create({}), error => error instanceof RoomApiError && error.status === 503);
});

test('uses the configured base URL and sends operation payloads as JSON', async () => {
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

test('preserves conflict snapshots and distinguishes HTTP, network, and non-JSON failures', async () => {
  const conflict = { planVersion: 1 };
  const api = createRoomApi('/api', { fetcher: async () => ({ ok: false, status: 409, json: async () => ({ error: '間取りを変更しました', snapshot: conflict }) }) });
  await assert.rejects(api.send(roomId, {}), error => error.status === 409 && error.snapshot === conflict);
  const network = createRoomApi('/api', { fetcher: async () => { throw Error('offline'); } });
  await assert.rejects(network.get(roomId), error => error.status === 0);
  const html = createRoomApi('/api', { fetcher: async () => ({ json: async () => { throw Error('HTML response'); } }) });
  await assert.rejects(html.get(roomId), error => error.status === 502);
});

test('handles state, presence, disconnect, malformed events, and stream cleanup', () => {
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
