import { plans } from '../data/plans.js';
import { isRoomLayout } from './room-state.js';
import { constrainFurnitureToRoom } from './furniture-bounds.js';
import { CUSTOM_PLAN_KEY } from './floor-plan.js';
import { isDrawingId } from './drawing-document.js';

export const LOCAL_ROOM_KEY = 'syncterior.personal-room';
const MAX_LENGTH = 1_000_000;
const ITEM_FIELDS = ['id', 'type', 'name', 'w', 'd', 'h', 'color', 'x', 'z', 'rot'];

function validLayout(room) {
  return isRoomLayout(room) && Object.keys(room).every(key =>
    (room.planKey === CUSTOM_PLAN_KEY ? ['planKey', 'items', 'customPlan'] : ['planKey', 'items']).includes(key))
    && room.items.every(item => {
      if (!Object.keys(item).every(key => ITEM_FIELDS.includes(key))) return false;
      const bounded = constrainFurnitureToRoom(item, room.planKey === CUSTOM_PLAN_KEY ? room.customPlan : plans[room.planKey]);
      return bounded && Math.abs(bounded.x - item.x) <= 1e-9 && Math.abs(bounded.z - item.z) <= 1e-9;
    });
}

export function createLocalRoomStorage(getStorage = () => globalThis.localStorage) {
  return {
    load() {
      try {
        const raw = getStorage().getItem(LOCAL_ROOM_KEY);
        if (raw === null) return { room: null, error: '' };
        if (raw.length > MAX_LENGTH) throw new Error('Invalid size');
        const value = JSON.parse(raw);
        if (!value || value.version !== (value.room?.planKey === CUSTOM_PLAN_KEY ? 2 : 1) || !Object.keys(value).every(key => ['version', 'room', 'drawingId'].includes(key))
          || (value.drawingId !== undefined && (value.room?.planKey !== CUSTOM_PLAN_KEY || !isDrawingId(value.drawingId)))
          || !validLayout(value.room)) throw new Error('Invalid layout');
        return { room: value.room, error: '', ...(value.drawingId !== undefined ? { drawingId: value.drawingId } : {}) };
      } catch {
        return { room: null, error: '保存した個人配置を読み込めませんでした。初期配置で編集を続けられます。' };
      }
    },
    save(room, drawingId) {
      try {
        // 部屋ID・revision・未確定操作・視点・選択状態は保存しない。
        const layout = { planKey: room.planKey, items: room.items.map(item =>
          Object.fromEntries(ITEM_FIELDS.map(key => [key, item[key]]))),
          ...(room.planKey === CUSTOM_PLAN_KEY ? { customPlan: room.customPlan } : {}) };
        if (!validLayout(layout)) throw new Error('Invalid layout');
        if (drawingId !== undefined && !isDrawingId(drawingId)) throw new Error('Invalid drawing ID');
        const raw = JSON.stringify({ version: room.planKey === CUSTOM_PLAN_KEY ? 2 : 1, room: layout,
          ...(room.planKey === CUSTOM_PLAN_KEY && drawingId !== undefined ? { drawingId } : {}) });
        if (raw.length > MAX_LENGTH) throw new Error('Invalid size');
        getStorage().setItem(LOCAL_ROOM_KEY, raw);
        return { error: '' };
      } catch {
        return { error: '個人配置を保存できませんでした。この画面では編集を続けられます。' };
      }
    },
    clear() {
      try {
        getStorage().removeItem(LOCAL_ROOM_KEY);
        return { error: '' };
      } catch {
        return { error: '保存した個人配置を消去できませんでした。この画面の配置は残っています。' };
      }
    },
  };
}
