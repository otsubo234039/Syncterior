import { isFloorPlan, wallLength } from './floor-plan.js';

// 認識エンジンと保存する実寸モデルを分離。画像全体の座標を維持して欠落部の追加を可能にする。
export function floorPlanFromLines({ width, height, lines, lineWidths, strokeWidth = 4 }) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 32 && n <= 1024)
    || !Array.isArray(lines) || lines.length % 4 || lines.length > 200_000
    || (lineWidths !== undefined && (!Array.isArray(lineWidths) || lineWidths.length !== lines.length / 4
      || !lineWidths.every(n => Number.isFinite(n) && n > 0 && n <= 50)))
    || !lines.every(Number.isFinite) || !Number.isFinite(strokeWidth) || strokeWidth < .5 || strokeWidth > 50) throw new Error('画像の解析結果が不正です。');
  const segments = [];
  for (let i = 0; i < lines.length; i += 4) {
    let [x1, y1, x2, y2] = lines.slice(i, i + 4);
    if ([x1, x2].some(x => x < 0 || x >= width) || [y1, y2].some(y => y < 0 || y >= height)) continue;
    const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy);
    if (length < 2) continue;
    // 小さな傾きは図面の水平・垂直線へ揃える。
    if (Math.abs(dy) < length * .05) y1 = y2 = (y1 + y2) / 2;
    else if (Math.abs(dx) < length * .05) x1 = x2 = (x1 + x2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    if (angle < 0 || angle >= Math.PI) [x1, y1, x2, y2] = [x2, y2, x1, y1];
    segments.push({ start: [x1, y1], end: [x2, y2], length: Math.hypot(x2 - x1, y2 - y1), thickness: lineWidths?.[i / 4] ?? strokeWidth });
  }
  segments.sort((a, b) => b.length - a.length);
  const merged = [];
  const tolerance = Math.max(1.5, strokeWidth * .6);
  for (const segment of segments) {
    const dx = (segment.end[0] - segment.start[0]) / segment.length;
    const dy = (segment.end[1] - segment.start[1]) / segment.length;
    const duplicate = merged.find(wall => {
      if (Math.abs(wall.thickness - segment.thickness) > Math.max(1, Math.min(wall.thickness, segment.thickness) * .2)) return false;
      const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
      const wx = (wall.end[0] - wall.start[0]) / length, wy = (wall.end[1] - wall.start[1]) / length;
      if (Math.abs(dx * wy - dy * wx) > .06) return false;
      const projected = [segment.start, segment.end].map(p => (p[0] - wall.start[0]) * wx + (p[1] - wall.start[1]) * wy);
      const distance = p => Math.abs((p[0] - wall.start[0]) * wy - (p[1] - wall.start[1]) * wx);
      if (Math.max(...[segment.start, segment.end].map(distance)) > tolerance
        || Math.min(...projected) > length + 1e-7 || Math.max(...projected) < -1e-7) return false;
      const start = [...wall.start], from = Math.min(0, ...projected), to = Math.max(length, ...projected);
      wall.start = [start[0] + wx * from, start[1] + wy * from];
      wall.end = [start[0] + wx * to, start[1] + wy * to];
      return true;
    });
    if (!duplicate) merged.push({ start: segment.start, end: segment.end, thickness: segment.thickness });
    if (merged.length > 300) throw new Error('壁候補が多すぎます。図面の周囲の余白を減らすか、手動で壁を指定してください。');
  }
  // 同じ位置に重なり、太い壁の中へ完全に収まる細い候補は二重に描画しない。
  const walls = merged.filter((wall, index) => !merged.some((other, otherIndex) => {
    if (otherIndex === index || other.thickness < wall.thickness
      || (other.thickness === wall.thickness && otherIndex > index)) return false;
    const dx = other.end[0] - other.start[0], dy = other.end[1] - other.start[1], length = Math.hypot(dx, dy);
    const ux = dx / length, uy = dy / length;
    const childLength = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
    if (Math.abs((wall.end[0] - wall.start[0]) * uy - (wall.end[1] - wall.start[1]) * ux) / childLength > .02) return false;
    const along = p => (p[0] - other.start[0]) * ux + (p[1] - other.start[1]) * uy;
    const normal = p => Math.abs((p[0] - other.start[0]) * uy - (p[1] - other.start[1]) * ux);
    return [wall.start, wall.end].every(p => along(p) >= -1e-7 && along(p) <= length + 1e-7
      && normal(p) + wall.thickness / 2 <= other.thickness / 2 + 1e-7);
  }));
  const all = walls.flatMap(w => [w.start, w.end]);
  const minX = all.length ? Math.max(0, Math.min(...all.map(p => p[0])) - 2) : 0;
  const maxX = all.length ? Math.min(width, Math.max(...all.map(p => p[0])) + 2) : width;
  const minY = all.length ? Math.max(0, Math.min(...all.map(p => p[1])) - 2) : 0;
  const maxY = all.length ? Math.min(height, Math.max(...all.map(p => p[1])) + 2) : height;
  const unit = 8 / Math.max(32, maxX - minX);
  const convert = p => [Math.max(0, Math.min(width, p[0])) * unit, Math.max(0, Math.min(height, p[1])) * unit];
  // 画素上で有効な短線も、実寸の最小壁長に満たない場合は個別に除く。
  const plan = { version: 1, name: '取込間取り', w: width * unit, d: height * unit, h: 2.4, wallThickness: Math.max(.05, Math.min(1, lineWidths ? strokeWidth * unit : .12)),
    floors: [{ id: 'floor-1', kind: 'room', points: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]].map(convert) }],
    walls: walls.map((wall, i) => ({ id: `wall-${i + 1}`, start: convert(wall.start), end: convert(wall.end), openings: [],
      ...(lineWidths ? { thicknessRatio: Math.max(.1, Math.min(8, wall.thickness / strokeWidth)) } : {}) })).filter(wall => wallLength(wall) >= .02) };
  if (!isFloorPlan(plan)) throw new Error('間取りを生成できませんでした。余白の少ない画像をお試しください。');
  return plan;
}
