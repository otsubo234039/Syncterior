import { isFloorPlan, isSimplePolygon, polygonArea } from './floor-plan.js';

function validMeasurement(plan, points) {
  return plan && Number.isFinite(plan.w) && Number.isFinite(plan.d) && plan.w > 0 && plan.d > 0
    && Array.isArray(points) && points.length === 2
    && [points[0], points[1]].every(p => Array.isArray(p) && p.length === 2 && [p[0], p[1]].every(n => Number.isFinite(n) && n >= 0 && n <= 1));
}

// 計測点は画像全体に対する比率。壁ID・部屋・認識された線の長さに依存しない。
export function measurementLength(plan, points) {
  if (!validMeasurement(plan, points)) return null;
  const length = Math.hypot((points[1][0] - points[0][0]) * plan.w, (points[1][1] - points[0][1]) * plan.d);
  return Number.isFinite(length) && length >= .02 ? length : null;
}

export function calibrateFloorPlan(plan, points, actualLength) {
  if (!isFloorPlan(plan) || !Number.isFinite(actualLength) || actualLength < .02) return null;
  const measured = measurementLength(plan, points);
  if (measured === null) return null;
  return scaleFloorPlan(plan, actualLength / measured);
}

// 対角の2点で囲んだ、画像の軸に平行な長方形だけを対象にする。
export function measurementArea(plan, points) {
  if (!validMeasurement(plan, points)) return null;
  const width = Math.abs(points[1][0] - points[0][0]) * plan.w;
  const depth = Math.abs(points[1][1] - points[0][1]) * plan.d;
  const area = width * depth;
  return width >= .02 && depth >= .02 && Number.isFinite(area) ? area : null;
}

export function calibrateFloorPlanByTatami(plan, points, tatami, areaPerTatami) {
  return calibrateByArea(plan, measurementArea(plan, points), tatami, areaPerTatami);
}

export function measurementPolygonArea(plan, points) {
  if (!plan || !Number.isFinite(plan.w) || !Number.isFinite(plan.d) || plan.w <= 0 || plan.d <= 0
    || !Array.isArray(points) || points.length < 3 || points.length > 64
    || !Array.from(points).every(p => Array.isArray(p) && p.length === 2 && [p[0], p[1]].every(n => Number.isFinite(n) && n >= 0 && n <= 1))) return null;
  const polygon = points.map(([x, y]) => [x * plan.w, y * plan.d]);
  const area = polygonArea(polygon);
  return Number.isFinite(area) && isSimplePolygon(polygon) ? area : null;
}

export function calibrateFloorPlanByPolygon(plan, points, tatami, areaPerTatami) {
  return calibrateByArea(plan, measurementPolygonArea(plan, points), tatami, areaPerTatami);
}

// 入力不備と、計算後のモデルの範囲外をUIで区別する。補正の許容範囲は変えない。
export function calibrationInputError(plan, points, { byArea, byPolygon, length, tatami, areaPerTatami }) {
  if (byArea) {
    const measured = byPolygon ? measurementPolygonArea(plan, points) : measurementArea(plan, points);
    const area = tatami * areaPerTatami;
    if (measured === null || !Number.isFinite(tatami) || tatami <= 0
      || !Number.isFinite(areaPerTatami) || areaPerTatami <= 0 || !Number.isFinite(area) || area <= 0) {
      return '輪郭・帖数・換算値を確認してください。';
    }
  } else if (measurementLength(plan, points) === null || !Number.isFinite(length) || length < .02) {
    return '2点と長さを確認してください。';
  }
  return null;
}

function calibrateByArea(plan, measured, tatami, areaPerTatami) {
  if (!isFloorPlan(plan) || !Number.isFinite(tatami) || tatami <= 0 || !Number.isFinite(areaPerTatami) || areaPerTatami <= 0) return null;
  const actualArea = tatami * areaPerTatami;
  if (measured === null || !Number.isFinite(actualArea) || actualArea <= 0) return null;
  return scaleFloorPlan(plan, Math.sqrt(actualArea / measured));
}

function scaleFloorPlan(plan, factor) {
  if (!Number.isFinite(factor) || factor <= 0) return null;
  const point = p => p.map(n => n * factor);
  if (Math.abs(factor - 1) < 1e-12) return plan;
  const next = { ...plan, w: plan.w * factor, d: plan.d * factor, wallThickness: plan.wallThickness * factor,
    floors: plan.floors.map(f => ({ ...f, points: f.points.map(point) })),
    walls: plan.walls.map(w => ({ ...w, start: point(w.start), end: point(w.end), openings: w.openings.map(o => ({ ...o, offset: o.offset * factor, width: o.width * factor })) })),
  };
  return isFloorPlan(next) ? next : null;
}
