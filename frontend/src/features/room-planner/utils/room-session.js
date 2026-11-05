import { applyRoomOperation, isRoomSnapshot, projectRoom } from './room-state.js';

export function createRoomSession({ api, initialRoom, roomId = null, onRoomChange = () => {}, onLocalChange = () => {}, makeId = () => crypto.randomUUID() }) {
  let base = { ...initialRoom, revision: 0, planVersion: 0, appliedOperationIds: [] };
  let pending = [];
  let generation = 0;
  let running = false;
  let sending = false;
  let closeStream;
  let streamReady = false;
  let retryTimer;
  const listeners = new Set();
  let state = {
    room: base, roomId, status: roomId ? 'connecting' : 'local',
    error: '', participants: null, pending: 0, configured: api.configured, loaded: !roomId, changingPlan: false,
  };

  function publish(patch = {}) {
    const next = { ...state, ...patch };
    state = { ...next, room: projectRoom(base, pending), pending: pending.length,
      loaded: !next.roomId || base.id === next.roomId,
      changingPlan: pending.some(command => command.operation.type === 'change-plan'),
    };
    listeners.forEach(listener => listener());
  }
  function disconnect() {
    streamReady = false;
    closeStream?.();
    closeStream = undefined;
    clearTimeout(retryTimer);
  }
  function accept(snapshot) {
    if (!isRoomSnapshot(snapshot) || snapshot.id !== state.roomId) {
      throw Object.assign(new Error('共有データを読み込めませんでした。'), { invalidSnapshot: true });
    }
    if (snapshot.revision < base.revision) return;
    base = snapshot;
    const discarded = pending.some(command => command.planVersion !== snapshot.planVersion
      && !snapshot.appliedOperationIds.includes(command.id));
    pending = pending.filter(command => !snapshot.appliedOperationIds.includes(command.id)
      && command.planVersion === snapshot.planVersion);
    publish({ error: discarded
      ? '間取りの変更により未送信の操作を取り消しました。' : '' });
  }
  async function flush() {
    if (!running || sending || !state.roomId || state.status !== 'connected' || !pending.length) return;
    sending = true;
    const ticket = generation;
    const command = pending[0];
    try {
      const snapshot = await api.send(state.roomId, command);
      if (!running || ticket !== generation) return;
      accept(snapshot);
      publish({ status: streamReady ? 'connected' : 'reconnecting' });
    } catch (error) {
      if (!running || ticket !== generation) return;
      if (error.invalidSnapshot) {
        disconnect();
        publish({ status: 'error', error: error.message });
      } else if (!pending.some(entry => entry.id === command.id) && streamReady) {
        publish({ status: 'connected' });
      } else if (error.status >= 400 && error.status < 500) {
        pending = pending.filter(entry => entry.id !== command.id);
        if (error.snapshot) {
          try { accept(error.snapshot); } catch (snapshotError) {
            disconnect();
            publish({ status: 'error', error: snapshotError.message });
            return;
          }
        }
        if (error.status === 404) {
          disconnect();
          publish({ status: 'error', error: '共有された部屋が見つかりません。' });
        } else publish({ error: error.message });
      } else {
        publish({ status: 'reconnecting', error: '変更を送信できません。再接続しています。' });
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { if (running && ticket === generation) void connect(); }, 2500);
      }
    } finally {
      if (ticket === generation) sending = false;
    }
    if (running && ticket === generation) void flush();
  }
  function subscribeToRoom(ticket) {
    closeStream = api.subscribe(state.roomId, {
      state(snapshot) {
        if (!running || ticket !== generation) return;
        try {
          accept(snapshot);
          streamReady = true;
          publish({ status: 'connected' });
          void flush();
        } catch (error) {
          disconnect();
          publish({ status: 'error', error: error.message });
        }
      },
      presence(count) {
        if (running && ticket === generation) publish({ participants: count });
      },
      disconnected() {
        if (running && ticket === generation) {
          streamReady = false;
          publish({ status: 'reconnecting', participants: null });
        }
      },
      invalid() {
        if (running && ticket === generation) {
          disconnect();
          publish({ status: 'error', error: '共有データを読み込めませんでした。再接続してください。' });
        }
      },
    });
  }
  async function connect() {
    disconnect();
    const ticket = ++generation;
    sending = false;
    running = true;
    publish({ status: 'connecting', error: '', participants: null });
    if (!/^[a-zA-Z0-9_-]{32}$/.test(state.roomId)) {
      publish({ status: 'error', error: '共有リンクが正しくありません。' });
      return;
    }
    try {
      const snapshot = await api.get(state.roomId);
      if (!running || ticket !== generation) return;
      accept(snapshot);
      subscribeToRoom(ticket);
    } catch (error) {
      if (running && ticket === generation) publish({ status: 'error', error: error.message });
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start() {
      running = true;
      if (state.roomId) void connect();
    },
    stop() { running = false; generation++; sending = false; disconnect(); },
    dispatch(operation) {
      if (state.status === 'local') {
        base = applyRoomOperation(base, operation);
        onLocalChange(base);
        publish();
        return true;
      }
      if (state.status !== 'connected' || state.changingPlan) return false;
      // Coalesce queued drag coordinates while preserving the in-flight command.
      const tail = pending.at(-1);
      if (operation.type === 'update' && tail?.operation.type === 'update'
        && tail.operation.id === operation.id && !(sending && pending.length === 1)) {
        tail.operation = { ...operation, patch: { ...tail.operation.patch, ...operation.patch } };
      } else {
        pending.push({ id: makeId(), planVersion: base.planVersion, operation });
      }
      publish({ error: '' });
      void flush();
      return true;
    },
    async share() {
      if (state.roomId) return state.roomId;
      if (!running || state.status !== 'local') return null;
      if (!api.configured) {
        publish({ error: '共同編集は現在利用できません。個人での編集は引き続き利用できます。' });
        return null;
      }
      const ticket = generation;
      publish({ status: 'creating', error: '' });
      try {
        const snapshot = await api.create({ planKey: base.planKey, items: base.items });
        if (!running || ticket !== generation) return null;
        if (!isRoomSnapshot(snapshot)) throw new Error('共有リンクを作成できませんでした。');
        base = snapshot;
        pending = [];
        publish({ roomId: snapshot.id, status: 'connecting' });
        onRoomChange(snapshot.id);
        subscribeToRoom(ticket);
        return snapshot.id;
      } catch (error) {
        if (running && ticket === generation) publish({ status: state.roomId ? 'error' : 'local', error: error.message });
        return null;
      }
    },
    reconnect: connect,
    leave() {
      generation++;
      disconnect();
      sending = false;
      // Keep only confirmed shared changes; unsent edits must not look saved.
      pending = [];
      base = { planKey: base.planKey, items: base.items, revision: 0, planVersion: 0, appliedOperationIds: [] };
      publish({ roomId: null, status: 'local', participants: null, error: '' });
      onRoomChange(null);
    },
  };
}
