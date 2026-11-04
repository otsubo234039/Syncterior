export class RoomApiError extends Error {
  constructor(message, status, snapshot) {
    super(message);
    this.status = status;
    this.snapshot = snapshot;
  }
}

// Set this to /api for a same-origin API, or to an external HTTPS API base URL.
export function createRoomApi(baseUrl, { fetcher = globalThis.fetch, EventSourceClass = globalThis.EventSource } = {}) {
  const base = baseUrl?.replace(/\/$/, '');
  async function request(path, options = {}) {
    if (!base) throw new RoomApiError('共同編集は現在利用できません。個人での編集は引き続き利用できます。', 503);
    let response;
    try {
      response = await fetcher(`${base}/rooms${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      throw new RoomApiError('共有サーバーに接続できません。接続を確認してください。', 0);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new RoomApiError('共同編集に接続できませんでした。しばらくしてから再試行してください。', 502);
    }
    if (!response.ok) throw new RoomApiError(data.error || '部屋を読み込めませんでした。', response.status, data.snapshot);
    return data;
  }

  return {
    configured: Boolean(base),
    create: room => request('', { method: 'POST', body: JSON.stringify(room) }),
    get: id => request(`/${encodeURIComponent(id)}`),
    send: (id, command) => request(`/${encodeURIComponent(id)}/operations`, {
      method: 'POST', body: JSON.stringify(command),
    }),
    subscribe(id, handlers) {
      const source = new EventSourceClass(`${base}/rooms/${encodeURIComponent(id)}/events`);
      source.addEventListener('state', event => {
        try { handlers.state(JSON.parse(event.data)); } catch { handlers.invalid(); }
      });
      source.addEventListener('presence', event => {
        try {
          const count = JSON.parse(event.data).participants;
          if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid presence');
          handlers.presence(count);
        } catch { handlers.invalid(); }
      });
      source.onerror = handlers.disconnected;
      return () => source.close();
    },
  };
}

export const roomApi = createRoomApi(import.meta.env?.VITE_ROOM_API_URL);
