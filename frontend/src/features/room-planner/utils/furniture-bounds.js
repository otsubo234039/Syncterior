import { fitsFloorPlan, furnitureRectanglesOverlap, slideFurnitureAlongWalls } from './floor-plan-furniture.js';

// 回転後のXZ平面上の外接矩形で、部屋に収まる最寄りの位置を求める。
export function constrainFurnitureToRoom(item, plan, previous) {
  if (!plan || ![item.w, item.d, item.rot, item.x, item.z, plan.w, plan.d].every(Number.isFinite)
    || item.w <= 0 || item.d <= 0 || plan.w <= 0 || plan.d <= 0) return null;

  const cos = Math.abs(Math.cos(item.rot));
  const sin = Math.abs(Math.sin(item.rot));
  const halfWidth = (item.w * cos + item.d * sin) / 2;
  const halfDepth = (item.w * sin + item.d * cos) / 2;
  const limitX = plan.w / 2 - halfWidth;
  const limitZ = plan.d / 2 - halfDepth;
  // 直角回転の丸め誤差だけを許容し、部屋より大きな外形は受け入れない。
  if (limitX < -1e-10 || limitZ < -1e-10) return null;
  const clamp = (value, limit) => Math.max(-Math.max(0, limit), Math.min(Math.max(0, limit), value));
  const bounded = { ...item, x: clamp(item.x, limitX), z: clamp(item.z, limitZ) };
  if (!plan.floors || fitsFloorPlan(bounded, plan)) return bounded;
  return previous ? slideFurnitureAlongWalls(bounded, previous, plan) : null;
}

export function findFurniturePositionInRoom(item, plan, occupied = []) {
  const candidate = constrainFurnitureToRoom(item, plan);
  if (candidate && !occupied.some(other => furnitureRectanglesOverlap(candidate, other))) return candidate;

  const step = Math.max(.1, Math.max(plan.w, plan.d) / 100);
  for (let z = -plan.d / 2 + item.d / 2; z <= plan.d / 2 - item.d / 2; z += step) {
    for (let x = -plan.w / 2 + item.w / 2; x <= plan.w / 2 - item.w / 2; x += step) {
      const bounded = constrainFurnitureToRoom({ ...item, x, z }, plan);
      if (bounded && !occupied.some(other => furnitureRectanglesOverlap(bounded, other))) return bounded;
    }
  }
  return null;
}
