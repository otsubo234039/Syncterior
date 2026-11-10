import { isFloorPlan } from './floor-plan.js';

// 計測点は画像全体に対する比率。壁ID・部屋・認識された線の長さに依存しない。
export function measurementLength(plan, points) {
  if (!plan || !Number.isFinite(plan.w) || !Number.isFinite(plan.d) || plan.w <= 0 || plan.d <= 0 || !Array.isArray(points) || points.length !== 2 || ![points[0], points[1]].every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 1))) return null;
  const length = Math.hypot((points[1][0] - points[0][0]) * plan.w, (points[1][1] - points[0][1]) * plan.d);
  return Number.isFinite(length) && length >= .02 ? length : null;
}

export function calibrateFloorPlan(plan, points, actualLength) {
  if (!isFloorPlan(plan) || !Number.isFinite(actualLength) || actualLength < .02) return null;
  const measured = measurementLength(plan, points);
  if (measured === null) return null;
  const factor = actualLength / measured, point = p => p.map(n => n * factor);
  if (Math.abs(factor - 1) < 1e-12) return plan;
  const next = { ...plan, w: plan.w * factor, d: plan.d * factor, wallThickness: plan.wallThickness * factor,
    floors: plan.floors.map(f => ({ ...f, points: f.points.map(point) })),
    walls: plan.walls.map(w => ({ ...w, start: point(w.start), end: point(w.end), openings: w.openings.map(o => ({ ...o, offset: o.offset * factor, width: o.width * factor })) })),
  };
  return isFloorPlan(next) ? next : null;
}
