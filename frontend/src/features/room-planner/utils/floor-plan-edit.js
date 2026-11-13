import { isFloorPlan, wallLength } from './floor-plan.js';

export function distanceAlongWall(wall, point) {
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) return NaN;
  const length = wallLength(wall);
  return ((point[0] - wall.start[0]) * (wall.end[0] - wall.start[0])
    + (point[1] - wall.start[1]) * (wall.end[1] - wall.start[1])) / length;
}

// 編集結果だけを検証し、不正な中間状態を保存モデルへ流さない。
export function editFloorPlan(plan, action) {
  if (!isFloorPlan(plan) || !action || typeof action !== 'object') return null;
  let next = plan;
  const wall = plan.walls.find(value => value.id === action.wallId);
  const floor = plan.floors.find(value => value.id === action.floorId);
  const replaceWall = value => ({ ...plan, walls: plan.walls.map(w => w === wall ? value : w) });
  const replaceFloor = value => ({ ...plan, floors: plan.floors.map(f => f === floor ? value : f) });
  switch (action.type) {
    case 'update-metadata':
      next = { ...plan, name: action.name, h: action.height };
      break;
    case 'add-wall':
      next = { ...plan, walls: [...plan.walls, { id: action.id, start: action.start, end: action.end, openings: [] }] };
      break;
    case 'move-wall-point':
      if (!wall || !['start', 'end'].includes(action.side)) return null;
      next = replaceWall({ ...wall, [action.side]: action.point });
      break;
    case 'remove-wall':
      if (!wall) return null;
      next = { ...plan, walls: plan.walls.filter(w => w !== wall) };
      break;
    case 'move-floor-point':
    case 'insert-floor-point':
    case 'remove-floor-point': {
      if (!floor || !Number.isInteger(action.index) || action.index < 0 || action.index >= floor.points.length) return null;
      const points = [...floor.points];
      if (action.type === 'move-floor-point') points[action.index] = action.point;
      if (action.type === 'insert-floor-point') {
        const a = points[action.index], b = points[(action.index + 1) % points.length];
        points.splice(action.index + 1, 0, a.map((value, axis) => (value + b[axis]) / 2));
      }
      if (action.type === 'remove-floor-point') points.splice(action.index, 1);
      next = replaceFloor({ ...floor, points });
      break;
    }
    case 'add-opening': {
      if (!wall || !['door', 'window'].includes(action.kind)) return null;
      const a = distanceAlongWall(wall, action.start), b = distanceAlongWall(wall, action.end);
      const bottom = action.kind === 'door' ? 0 : Math.min(1, plan.h / 2);
      const opening = { id: action.id, kind: action.kind, offset: Math.min(a, b), width: Math.abs(b - a), bottom,
        height: Math.min(action.kind === 'door' ? 2 : 1, plan.h - bottom) };
      next = replaceWall({ ...wall, openings: [...wall.openings, opening] });
      break;
    }
    case 'move-opening-point': {
      if (!wall || !['start', 'end'].includes(action.side)) return null;
      const opening = wall.openings.find(o => o.id === action.openingId);
      if (!opening) return null;
      const at = distanceAlongWall(wall, action.point);
      const from = action.side === 'start' ? at : opening.offset;
      const to = action.side === 'end' ? at : opening.offset + opening.width;
      next = replaceWall({ ...wall, openings: wall.openings.map(o => o === opening ? { ...o, offset: from, width: to - from } : o) });
      break;
    }
    case 'remove-opening':
      if (!wall || !wall.openings.some(o => o.id === action.openingId)) return null;
      next = replaceWall({ ...wall, openings: wall.openings.filter(o => o.id !== action.openingId) });
      break;
    default: return null;
  }
  if (!isFloorPlan(next)) return null;
  return JSON.stringify(next) === JSON.stringify(plan) ? plan : next;
}
