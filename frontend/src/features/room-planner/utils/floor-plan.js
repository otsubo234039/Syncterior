// 取込画像に依存しない実寸モデル。座標と長さはメートル、表示倍率は含めない。
export const CUSTOM_PLAN_KEY = 'custom';
const EPSILON = 1e-7;
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const fields = (value, keys) => value && typeof value === 'object' && Object.keys(value).every(key => keys.includes(key));
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
export const wallLength = wall => Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);

export function polygonArea(points) {
  return Math.abs(points.reduce((area, point, i) => {
    const next = points[(i + 1) % points.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function onSegment(a, b, p) {
  return Math.abs(cross(a, b, p)) < EPSILON
    && p[0] >= Math.min(a[0], b[0]) - EPSILON && p[0] <= Math.max(a[0], b[0]) + EPSILON
    && p[1] >= Math.min(a[1], b[1]) - EPSILON && p[1] <= Math.max(a[1], b[1]) + EPSILON;
}
function intersect(a, b, c, d) {
  return (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0)
    || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
export function isSimplePolygon(points) {
  if (!Array.isArray(points) || points.length < 3 || points.length > 64
    || !points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
    || polygonArea(points) < .01) return false;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    if (Math.hypot(points[i][0] - points[next][0], points[i][1] - points[next][1]) < .02) return false;
    for (let j = i + 1; j < points.length; j++) {
      const after = (j + 1) % points.length;
      if (j === next || after === i) continue;
      if (intersect(points[i], points[next], points[j], points[after])) return false;
    }
  }
  return true;
}

export function isFloorPlan(plan) {
  if (!fields(plan, ['version', 'name', 'w', 'd', 'h', 'wallThickness', 'floors', 'walls']) || plan.version !== 1 || typeof plan.name !== 'string' || !plan.name.trim() || plan.name.length > 80
    || !finite(plan.w, 1, 100) || !finite(plan.d, 1, 100) || !finite(plan.h, .5, 10)
    || !finite(plan.wallThickness, .05, 1)
    || !Array.isArray(plan.floors) || plan.floors.length < 1 || plan.floors.length > 20
    || !Array.isArray(plan.walls) || plan.walls.length > 300) return false;
  const point = p => Array.isArray(p) && p.length === 2 && finite(p[0], 0, plan.w) && finite(p[1], 0, plan.d);
  const ids = new Set();
  const unique = id => validId(id) && !ids.has(id) && Boolean(ids.add(id));
  if (!plan.floors.every(floor => fields(floor, ['id', 'kind', 'points']) && unique(floor.id) && ['room', 'balcony'].includes(floor.kind)
    && isSimplePolygon(floor.points) && floor.points.every(point))) return false;
  return plan.walls.every(wall => {
    if (!fields(wall, ['id', 'start', 'end', 'openings', 'thicknessRatio']) || !unique(wall.id) || !point(wall.start) || !point(wall.end)
      || (wall.thicknessRatio !== undefined && !finite(wall.thicknessRatio, .1, 8))
      || wallLength(wall) < .02 || !Array.isArray(wall.openings) || wall.openings.length > 20) return false;
    const length = wallLength(wall);
    let edge = 0;
    return [...wall.openings].sort((a, b) => a?.offset - b?.offset).every(opening => {
      if (!fields(opening, ['id', 'kind', 'offset', 'width', 'bottom', 'height']) || !unique(opening.id) || !['door', 'window'].includes(opening.kind)
        || !finite(opening.offset, 0, length) || !finite(opening.width, .1, length)
        || !finite(opening.bottom, 0, plan.h) || !finite(opening.height, .1, plan.h)
        || opening.offset + opening.width > length + EPSILON
        || opening.bottom + opening.height > plan.h + EPSILON || opening.offset < edge - EPSILON
        || (opening.kind === 'door' && opening.bottom !== 0)) return false;
      edge = opening.offset + opening.width;
      return true;
    });
  });
}

// 開口部を塞ぐ透明板は置かず、壁を左右・腰壁・垂れ壁に分割する。
export function wallPieces(wall, plan) {
  const length = wallLength(wall);
  const dx = (wall.end[0] - wall.start[0]) / length;
  const dz = (wall.end[1] - wall.start[1]) / length;
  const pieces = [];
  const add = (from, to, bottom, top) => {
    if (to - from < EPSILON || top - bottom < EPSILON) return;
    const middle = (from + to) / 2;
    pieces.push({
      position: [wall.start[0] + dx * middle - plan.w / 2, (bottom + top) / 2, wall.start[1] + dz * middle - plan.d / 2],
      size: [to - from, top - bottom, plan.wallThickness * (wall.thicknessRatio ?? 1)],
      rotation: -Math.atan2(dz, dx),
    });
  };
  let offset = 0;
  for (const opening of [...wall.openings].sort((a, b) => a.offset - b.offset)) {
    add(offset, opening.offset, 0, plan.h);
    add(opening.offset, opening.offset + opening.width, 0, opening.bottom);
    add(opening.offset, opening.offset + opening.width, opening.bottom + opening.height, plan.h);
    offset = opening.offset + opening.width;
  }
  add(offset, length, 0, plan.h);
  return pieces;
}

export function resizeFloorPlan(plan, w, d) {
  const scalePoint = ([x, z]) => [x * w / plan.w, z * d / plan.d];
  const next = { ...plan, w, d,
    floors: plan.floors.map(floor => ({ ...floor, points: floor.points.map(scalePoint) })),
    walls: plan.walls.map(wall => {
      const start = scalePoint(wall.start), end = scalePoint(wall.end);
      const ratio = Math.hypot(end[0] - start[0], end[1] - start[1]) / wallLength(wall);
      return { ...wall, start, end, openings: wall.openings.map(opening => ({ ...opening, offset: opening.offset * ratio, width: opening.width * ratio })) };
    }),
  };
  return isFloorPlan(next) ? next : null;
}

export function floorPlanBounds(plan) {
  const points = [...plan.floors.flatMap(floor => floor.points), ...plan.walls.flatMap(wall => [wall.start, wall.end])];
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minZ = Math.min(...points.map(p => p[1])), maxZ = Math.max(...points.map(p => p[1]));
  return { minX, maxX, minZ, maxZ, w: maxX - minX, d: maxZ - minZ };
}
