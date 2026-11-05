// In-memory API fixture for UI tests, not a production backend.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { plans } from '../../src/features/room-planner/data/plans.js';

const rooms = new Map();
const subscribers = new Map();
// テストAPI側でも四隅から独立に境界を求め、確定通知で補正を取り消さない。
function constrain(item, planKey, previous) {
  if (![item.w, item.d, item.rot, item.x, item.z].every(Number.isFinite) || item.w <= 0 || item.d <= 0) return previous;
  const corners = [-1, 1].flatMap(x => [-1, 1].map(z => ({
    x: x * item.w / 2 * Math.cos(item.rot) + z * item.d / 2 * Math.sin(item.rot),
    z: -x * item.w / 2 * Math.sin(item.rot) + z * item.d / 2 * Math.cos(item.rot),
  })));
  const limitX = plans[planKey].w / 2 - Math.max(...corners.map(corner => Math.abs(corner.x)));
  const limitZ = plans[planKey].d / 2 - Math.max(...corners.map(corner => Math.abs(corner.z)));
  if (limitX < -1e-10 || limitZ < -1e-10) return previous;
  const x = Math.max(0, limitX);
  const z = Math.max(0, limitZ);
  return { ...item, x: Math.max(-x, Math.min(x, item.x)), z: Math.max(-z, Math.min(z, item.z)) };
}
function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}
function event(response, name, data) {
  response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}
function presence(id) {
  const clients = subscribers.get(id) || new Set();
  clients.forEach(response => event(response, 'presence', { participants: clients.size }));
}

createServer(async (request, response) => {
  try {
    if (request.url === '/health') return json(response, 200, { ok: true });
    const match = /^\/api\/rooms(?:\/([\w-]+)(?:\/(operations|events))?)?$/.exec(request.url);
    if (!match) return json(response, 404, { error: '見つかりません。' });
    const [, id, action] = match;
    let body;
    if (request.method === 'POST') {
      let text = '';
      for await (const chunk of request) text += chunk;
      body = JSON.parse(text);
    }
    if (!id && request.method === 'POST') {
      const snapshot = { id: randomBytes(24).toString('base64url'), revision: 0, planVersion: 0,
        appliedOperationIds: [], planKey: body.planKey, items: body.items };
      rooms.set(snapshot.id, snapshot);
      return json(response, 201, snapshot);
    }
    const room = rooms.get(id);
    if (!room) return json(response, 404, { error: '共有された部屋が見つかりません。' });
    if (!action && request.method === 'GET') return json(response, 200, room);
    if (action === 'events' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      if (!subscribers.has(id)) subscribers.set(id, new Set());
      subscribers.get(id).add(response);
      event(response, 'state', room);
      presence(id);
      response.on('close', () => { subscribers.get(id).delete(response); presence(id); });
      return;
    }
    if (action === 'operations' && request.method === 'POST') {
      if (room.appliedOperationIds.includes(body.id)) return json(response, 200, room);
      if (body.planVersion !== room.planVersion) return json(response, 409, { error: '間取りが変更されました。', snapshot: room });
      const operation = body.operation;
      switch (operation.type) {
        case 'add': room.items.push(operation.item); break;
        case 'remove': room.items = room.items.filter(item => item.id !== operation.id); break;
        case 'update': room.items = room.items.map(item => item.id === operation.id ? constrain({ ...item, ...operation.patch }, room.planKey, item) : item); break;
        case 'rotate': room.items = room.items.map(item => item.id === operation.id ? constrain({ ...item, rot: (item.rot + Math.PI / 2) % (Math.PI * 2) }, room.planKey, item) : item); break;
        case 'change-plan': room.planKey = operation.planKey; room.items = operation.items; room.planVersion++; break;
        default: return json(response, 400, { error: '不正な操作です。' });
      }
      room.revision++;
      room.appliedOperationIds.push(body.id);
      subscribers.get(id)?.forEach(client => event(client, 'state', room));
      return json(response, 200, room);
    }
    json(response, 405, { error: '対応していないメソッドです。' });
  } catch {
    json(response, 400, { error: '不正なリクエストです。' });
  }
}).listen(4175, '127.0.0.1');
