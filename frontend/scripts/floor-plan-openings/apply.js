import { isFloorPlan } from '../../src/features/room-planner/utils/floor-plan.js';

// 採否を見るための実験変換。候補ごとに検証し、入力と手動開口は変更しない。
export function applyOpeningCandidates(input, candidates, width, height, strict = false) {
  if (!isFloorPlan(input)) throw Error('不正な間取りです。');
  let plan = structuredClone(input);
  const applied = [], rejected = [];
  for (const [index, c] of candidates.entries()) {
    if (strict && c?.kind === 'window-band') { rejected.push({ index, reason: '窓と引き戸の種類・高さが未確定' }); continue; }
    if (!c || !['door', 'window-band'].includes(c.kind) || ![c.from, c.to, c.center].every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) { rejected.push({ index, reason: '候補の形式' }); continue; }
    const axis = c.axis, normal = 1 - axis;
    if (![0, 1].includes(axis)) { rejected.push({ index, reason: '軸の形式' }); continue; }
    const from = c.from[axis] * (axis ? plan.d / height : plan.w / width);
    const to = c.to[axis] * (axis ? plan.d / height : plan.w / width);
    const coordinate = c.center?.[normal] * (normal ? plan.d / height : plan.w / width);
    const tolerance = Math.max(plan.wallThickness, c.thickness * plan.w / width);
    if (![from, to, coordinate, tolerance].every(Number.isFinite) || to - from < .1) { rejected.push({ index, reason: '寸法の形式' }); continue; }
    const aligned = plan.walls.filter(w => Math.abs(w.start[normal] - coordinate) < tolerance && Math.abs(w.end[normal] - coordinate) < tolerance
      && Math.abs(w.start[normal] - w.end[normal]) < tolerance * .25);
    const low = w => Math.min(w.start[axis], w.end[axis]), high = w => Math.max(w.start[axis], w.end[axis]);
    const before = aligned.filter(w => low(w) < from - tolerance && Math.abs(high(w) - from) < tolerance * 2).sort((a, b) => Math.abs(high(a) - from) - Math.abs(high(b) - from))[0];
    const after = aligned.filter(w => high(w) > to + tolerance && Math.abs(low(w) - to) < tolerance * 2).sort((a, b) => Math.abs(low(a) - to) - Math.abs(low(b) - to))[0];
    const spanning = aligned.filter(w => low(w) < from - tolerance && high(w) > to + tolerance)[0];
    const hosts = before && after && before.id !== after.id ? [before, after] : spanning ? [spanning] : [];
    if (!hosts.length) { rejected.push({ index, reason: '対応する壁の両側がない' }); continue; }
    if (strict && plan.walls.some(w => Math.abs(w.start[axis] - w.end[axis]) < tolerance * .25
      && w.start[axis] > from + tolerance && w.start[axis] < to - tolerance
      && Math.min(w.start[normal], w.end[normal]) <= coordinate + tolerance
      && Math.max(w.start[normal], w.end[normal]) >= coordinate - tolerance)) {
      rejected.push({ index, reason: '開口の途中に直交する壁がある' }); continue;
    }
    const startAt = Math.min(...hosts.map(low)), endAt = Math.max(...hosts.map(high));
    const remove = aligned.filter(w => low(w) >= startAt - 1e-7 && high(w) <= endAt + 1e-7);
    if (remove.some(w => w.openings.length)) { rejected.push({ index, reason: '既存の開口を保護' }); continue; }
    const point = at => axis ? [coordinate, at] : [at, coordinate];
    const bottom = c.kind === 'door' ? 0 : Math.min(.9, plan.h * .35);
    const openingHeight = c.kind === 'door' ? Math.min(2, plan.h) : Math.min(1.1, plan.h - bottom);
    const next = { ...plan, walls: [...plan.walls.filter(w => !remove.includes(w)), {
      id: `experiment-wall-${index + 1}`, start: point(startAt), end: point(endAt), thicknessRatio: hosts[0].thicknessRatio ?? 1,
      openings: [{ id: `experiment-opening-${index + 1}`, kind: c.kind === 'door' ? 'door' : 'window', offset: from - startAt, width: to - from, bottom, height: openingHeight }],
    }] };
    if (!isFloorPlan(next)) { rejected.push({ index, reason: '実寸モデルの検証に失敗' }); continue; }
    plan = next; applied.push(index);
  }
  return { plan, applied, rejected };
}
