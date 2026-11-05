import { plans } from '../data/plans.js';
import { constrainFurnitureToRoom } from './furniture-bounds.js';

export function applyRoomOperation(room, operation) {
  switch (operation.type) {
    case 'change-plan':
      return { ...room, planKey: operation.planKey, items: operation.items };
    case 'add':
      return room.items.some(item => item.id === operation.item.id)
        ? room : { ...room, items: [...room.items, operation.item] };
    case 'remove':
      return { ...room, items: room.items.filter(item => item.id !== operation.id) };
    case 'update':
    case 'rotate':
      return {
        ...room,
        items: room.items.map(item => {
          if (item.id !== operation.id) return item;
          const next = operation.type === 'rotate'
            ? { ...item, rot: (item.rot + Math.PI / 2) % (Math.PI * 2) }
            : { ...item, ...operation.patch };
          return constrainFurnitureToRoom(next, plans[room.planKey]) ?? item;
        }),
      };
    default:
      return room;
  }
}

export function projectRoom(snapshot, pending) {
  return pending.reduce((room, command) => (
    command.planVersion === snapshot.planVersion
      ? applyRoomOperation(room, command.operation) : room
  ), snapshot);
}

export function isRoomLayout(value) {
  return Boolean(value && Object.hasOwn(plans, value.planKey)
    && Array.isArray(value.items) && value.items.length <= 200
    && new Set(value.items.map(item => item?.id)).size === value.items.length
    && value.items.every(item => item
      && typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(item.id)
      && ['sofa', 'bed', 'table', 'desk', 'chair', 'tv', 'fridge', 'lamp'].includes(item.type)
      && typeof item.name === 'string' && item.name.length <= 80
      && ['w', 'd', 'h', 'x', 'z', 'rot'].every(key => Number.isFinite(item[key]) && Math.abs(item[key]) < 10000)
      && item.w > 0 && item.d > 0 && item.h > 0
      && typeof item.color === 'string' && /^#[\da-f]{6}$/i.test(item.color)));
}

export function isRoomSnapshot(value) {
  return Boolean(isRoomLayout(value) && /^[a-zA-Z0-9_-]{32}$/.test(value.id)
    && Number.isSafeInteger(value.revision) && value.revision >= 0
    && Number.isSafeInteger(value.planVersion) && value.planVersion >= 0
    && Array.isArray(value.appliedOperationIds)
    && value.appliedOperationIds.every(id => typeof id === 'string'));
}
