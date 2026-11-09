import { wallPieces } from './floor-plan.js';

// 人手の部分注釈との比較。壁候補数を精度として扱わず、欠落と既知の誤検出を別々に測る。
export function evaluateWallReferences(segments, reference, tolerance = 4) {
  const distance = (point, line) => {
    const [x1, y1, x2, y2] = line, dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((point[0] - x1) * dx + (point[1] - y1) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(point[0] - x1 - t * dx, point[1] - y1 - t * dy);
  };
  const samples = line => {
    const [x1, y1, x2, y2] = line, length = Math.hypot(x2 - x1, y2 - y1);
    const count = Math.max(1, Math.ceil(length));
    return { length, points: Array.from({ length: count }, (_, i) => [x1 + (x2 - x1) * (i + .5) / count, y1 + (y2 - y1) * (i + .5) / count]) };
  };
  const coverage = reference.walls.map(line => {
    const [x1, y1, x2, y2] = line, length = Math.hypot(x2 - x1, y2 - y1);
    const candidates = segments.filter(s => Math.abs((x2 - x1) * (s[3] - s[1]) - (y2 - y1) * (s[2] - s[0]))
      / (length * Math.hypot(s[2] - s[0], s[3] - s[1]) || 1) < .1);
    const { points } = samples(line);
    return points.filter(p => candidates.some(s => distance(p, s) <= tolerance + 1e-7)).length / points.length;
  });
  const nonWallLength = segments.reduce((sum, line) => {
    const { length, points } = samples(line);
    const inside = points.filter(([x, y]) => reference.nonWalls.some(({ box: [left, top, right, bottom] }) => x >= left && x <= right && y >= top && y <= bottom));
    return sum + length * inside.length / points.length;
  }, 0);
  return { coverageByWall: coverage, coverage: coverage.length ? coverage.reduce((a, b) => a + b, 0) / coverage.length : 0, nonWallLength };
}

// 線の有無だけでなく、実際に描画する壁の箱が入口や輪郭を塞ぐかを確認する。
export function evaluateLayoutReferences(plan, reference) {
  const pieces = plan.walls.flatMap(wall => wallPieces(wall, plan));
  const solid = ([px, py]) => {
    const x = px / reference.width * plan.w - plan.w / 2;
    const z = py / reference.height * plan.d - plan.d / 2;
    return pieces.some(piece => {
      const dx = x - piece.position[0], dz = z - piece.position[2];
      const along = dx * Math.cos(piece.rotation) - dz * Math.sin(piece.rotation);
      const across = dx * Math.sin(piece.rotation) + dz * Math.cos(piece.rotation);
      return Math.abs(along) < piece.size[0] / 2 - 1e-7 && Math.abs(across) < piece.size[2] / 2 - 1e-7
        && .5 > piece.position[1] - piece.size[1] / 2 && .5 < piece.position[1] + piece.size[1] / 2;
    });
  };
  const count = (groups, predicate) => (groups ?? []).flatMap(group => group.points).filter(predicate).length;
  return { blockedOpenings: count(reference.openings, solid), missingWallPoints: count(reference.solidPoints, p => !solid(p)),
    unexpectedSolidPoints: count(reference.freePoints, solid) };
}
