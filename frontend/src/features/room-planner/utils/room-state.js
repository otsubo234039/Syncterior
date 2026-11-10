import { plans } from '../data/plans.js';
import { constrainFurnitureToRoom } from './furniture-bounds.js';
import { CUSTOM_PLAN_KEY, isFloorPlan } from './floor-plan.js';

export function applyRoomOperation(room, operation) {
  switch (operation.type) {
    case 'change-plan': {
      if (operation.planKey === CUSTOM_PLAN_KEY
        ? !isFloorPlan(operation.customPlan) || !Array.isArray(operation.items)
        : !Object.hasOwn(plans, operation.planKey)) return room;
      if (operation.planKey === CUSTOM_PLAN_KEY && !isRoomLayout({ planKey: operation.planKey, customPlan: operation.customPlan, items: operation.items })) return room;
      const { customPlan, ...previous } = room;
      return { ...previous, planKey: operation.planKey, items: operation.items,
        ...(operation.planKey === CUSTOM_PLAN_KEY ? { customPlan: operation.customPlan } : {}) };
    }
    case 'add':
      if (room.planKey === CUSTOM_PLAN_KEY && !isRoomLayout({ ...room, items: [...room.items, operation.item] })) return room;
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
          const slide = room.planKey === CUSTOM_PLAN_KEY && operation.type === 'update'
            && operation.slideAlongWalls === true && Object.keys(operation.patch).every(key => ['x', 'z'].includes(key));
          return constrainFurnitureToRoom(next, room.planKey === CUSTOM_PLAN_KEY ? room.customPlan : plans[room.planKey], slide ? item : undefined) ?? item;
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
  return Boolean(value && (Object.hasOwn(plans, value.planKey)
    || (value.planKey === CUSTOM_PLAN_KEY && isFloorPlan(value.customPlan)))
    && Array.isArray(value.items) && value.items.length <= 200
    && new Set(value.items.map(item => item?.id)).size === value.items.length
    && value.items.every(item => item
      && typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(item.id)
      && ['sofa', 'bed', 'table', 'desk', 'chair', 'tv', 'fridge', 'lamp'].includes(item.type)
      && typeof item.name === 'string' && item.name.length <= 80
      && ['w', 'd', 'h', 'x', 'z', 'rot'].every(key => Number.isFinite(item[key]) && Math.abs(item[key]) < 10000)
      && item.w > 0 && item.d > 0 && item.h > 0
      && typeof item.color === 'string' && /^#[\da-f]{6}$/i.test(item.color)
      && (value.planKey !== CUSTOM_PLAN_KEY || (() => {
        const bounded = constrainFurnitureToRoom(item, value.customPlan);
        return bounded && Math.abs(bounded.x-item.x)<1e-9 && Math.abs(bounded.z-item.z)<1e-9;
      })())));
}

export function isRoomSnapshot(value) {
  return Boolean(isRoomLayout(value) && value.planKey !== CUSTOM_PLAN_KEY && /^[a-zA-Z0-9_-]{32}$/.test(value.id)
    && Number.isSafeInteger(value.revision) && value.revision >= 0
    && Number.isSafeInteger(value.planVersion) && value.planVersion >= 0
    && Array.isArray(value.appliedOperationIds)
    && value.appliedOperationIds.every(id => typeof id === 'string'));
}
