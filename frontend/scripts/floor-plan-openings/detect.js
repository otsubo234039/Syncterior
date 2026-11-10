// 手動実験専用。製品Workerには読み込まない。
export function detectOpeningCandidates({ width, height, pixels, lines, lineWidths, strokeWidth }, mode, cv, own) {
  const verified = mode === 'verified' || mode === 'verified-apply';
  const strict = verified || mode === 'strict' || mode === 'strict-apply';
  const rgba = new Uint8ClampedArray(pixels);
  const ink = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const at = (y * width + x) * 4, alpha = rgba[at + 3] / 255;
    return (.299 * rgba[at] + .587 * rgba[at + 1] + .114 * rgba[at + 2]) * alpha + 255 * (1 - alpha) < 205;
  };
  const hit = (x, y, radius = 1) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (ink(x + dx, y + dy)) return true;
    return false;
  };
  if (mode === 'hough') {
    const source = own(cv.matFromArray(height, width, cv.CV_8UC4, rgba));
    const gray = own(new cv.Mat()), circles = own(new cv.Mat());
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    // 透明部分を白へ合成する。製品用の壁マスクとは独立した対照実験。
    for (let i = 0; i < width * height; i++) gray.data[i] = Math.round(gray.data[i] * rgba[i * 4 + 3] / 255 + 255 - rgba[i * 4 + 3]);
    const smooth = own(new cv.Mat()); cv.GaussianBlur(gray, smooth, new cv.Size(3, 3), 0);
    const edge = Math.min(width, height);
    cv.HoughCircles(smooth, circles, cv.HOUGH_GRADIENT, 1.2, Math.max(12, Math.round(edge * .04)), 100, 30, Math.max(5, Math.round(edge * .01)), Math.round(edge * .18));
    return Array.from({ length: circles.cols }, (_, i) => {
      const [x, y, radius] = circles.data32F.slice(i * 3, i * 3 + 3);
      return { kind: 'circle', center: [x, y], radius };
    });
  }
  const segments = [];
  for (let i = 0; i < lines.length; i += 4) {
    const [x1, y1, x2, y2] = lines.slice(i, i + 4), thickness = lineWidths[i / 4];
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < Math.max(9, strokeWidth * 2) || thickness < Math.max(1, strokeWidth * .6)) continue;
    if (Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) > 1) continue;
    segments.push({ a: [x1, y1], b: [x2, y2], thickness });
  }
  const anchors = segments.flatMap((s, id) => [s.a, s.b].map(point => ({ point, id, thickness: s.thickness })));
  const gaps = [], tolerance = Math.max(1.5, strokeWidth * .7);
  for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++) {
    const a = anchors[i], b = anchors[j]; if (a.id === b.id) continue;
    const [ax, ay] = a.point, [bx, by] = b.point;
    const horizontal = Math.abs(ay - by) <= tolerance, vertical = Math.abs(ax - bx) <= tolerance;
    if (!horizontal && !vertical) continue;
    const length = Math.hypot(ax - bx, ay - by);
    if (length < Math.max(7, strokeWidth * 1.7) || length > Math.max(width, height) * .16) continue;
    const axis = horizontal ? 0 : 1, normal = 1 - axis;
    const from = [...a.point], to = [...b.point];
    from[normal] = to[normal] = (a.point[normal] + b.point[normal]) / 2;
    if (from[axis] > to[axis]) { const copy = [...from]; from.splice(0, 2, ...to); to.splice(0, 2, ...copy); }
    const middle = from.map((v, k) => (v + to[k]) / 2);
    // すでに太い実壁がある区間には穴を提案しない。
    let filled = 0;
    for (let sample = 1; sample < 10; sample++) {
      const p = from.map((v, k) => v + (to[k] - v) * sample / 10);
      const radius = Math.max(1, Math.floor(Math.min(a.thickness, b.thickness) * .35));
      if ([-radius, 0, radius].every(offset => ink(p[0] + (axis ? offset : 0), p[1] + (axis ? 0 : offset)))) filled++;
    }
    if (filled >= (strict ? 3 : 6)) continue;
    if (gaps.some(g => Math.hypot(g.center[0] - middle[0], g.center[1] - middle[1]) < tolerance && Math.abs(g.length - length) < tolerance * 2)) continue;
    gaps.push({ from, to, center: middle, axis, length, thickness: (a.thickness + b.thickness) / 2 });
  }
  const candidates = [];
  for (const gap of gaps) {
    const normal = 1 - gap.axis, radius = Math.max(1, Math.min(3, Math.round(gap.thickness * .4)));
    let best = null;
    for (const [hinge, closed] of [[gap.from, gap.to], [gap.to, gap.from]]) for (const side of [-1, 1]) {
      const direction = Math.sign(closed[gap.axis] - hinge[gap.axis]), leafEnd = [...hinge]; leafEnd[normal] += side * gap.length;
      if (verified && segments.some(s => {
        if (Math.abs(s.a[gap.axis] - s.b[gap.axis]) > 1 || Math.abs(s.a[gap.axis] - hinge[gap.axis]) > tolerance) return false;
        const a = (s.a[normal] - hinge[normal]) * side, b = (s.b[normal] - hinge[normal]) * side;
        return Math.min(gap.length, Math.max(a, b)) - Math.max(0, Math.min(a, b)) > gap.length * .5;
      })) continue;
      let isolatedArc = 0;
      let leaf = 0, arc = 0; const bins = [0, 0, 0, 0, 0];
      for (let i = 0; i < 20; i++) {
        const distance = gap.length * (.15 + .8 * i / 19);
        if (hit(hinge[0] + (normal === 0 ? side * distance : 0), hinge[1] + (normal === 1 ? side * distance : 0), radius)) leaf++;
        const angle = (12 + i * 66 / 19) * Math.PI / 180;
        const p = [...hinge]; p[gap.axis] += direction * gap.length * Math.cos(angle); p[normal] += side * gap.length * Math.sin(angle);
        if (hit(p[0], p[1], radius)) {
          arc++; bins[Math.min(4, Math.floor(i / 4))]++;
          const offset = Math.max(3, gap.thickness * 1.2);
          const neighbors = [-offset, offset].map(d => {
            const q = [...hinge];q[gap.axis] += direction * (gap.length + d) * Math.cos(angle);q[normal] += side * (gap.length + d) * Math.sin(angle);
            return hit(q[0],q[1],1);
          });
          if (neighbors.every(value => !value)) isolatedArc++;
        }
      }
      const arcSupport = arc / 20, leafSupport = leaf / 20;
      if (arcSupport < (strict ? .65 : .45) || leafSupport < (strict ? .75 : .6) || bins.filter(n => n > 0).length < (strict ? 4 : 3)) continue;
      if (verified && isolatedArc < 9) continue;
      const score = arcSupport * .6 + leafSupport * .4;
      if (!best || score > best.score) best = { kind: 'door', ...gap, hinge, leafEnd, arcSupport, leafSupport, isolatedArc, score };
    }
    if (best) { candidates.push(best); continue; }
    // 平行な細線の帯。窓と引き戸の意味の識別はまだできない。
    const range = Math.max(3, Math.ceil(gap.thickness)), stripes = [];
    for (let offset = -range; offset <= range; offset++) {
      let support = 0;
      for (let i = 0; i < 20; i++) {
        const p = gap.from.map((v, k) => v + (gap.to[k] - v) * (.12 + .76 * i / 19)); p[normal] += offset;
        if (ink(...p)) support++;
      }
      stripes.push(support / 20 >= .7);
    }
    const runs = [];
    for (let i = 0; i < stripes.length; i++) if (stripes[i]) {
      let end = i; while (stripes[end + 1]) end++;
      runs.push(end - i + 1); i = end;
    }
    const coverage = stripes.filter(Boolean).length / stripes.length;
    if (runs.length >= 2 && runs.length <= 4 && Math.max(...runs) <= Math.max(2, gap.thickness * .6) && coverage < .65 && gap.length > range * 3) {
      candidates.push({ kind: 'window-band', ...gap, stripeCount: runs.length, score: 1 - coverage });
    }
  }
  candidates.sort((a, b) => (a.kind === 'door' ? 1 : 0) - (b.kind === 'door' ? 1 : 0) || a.score - b.score).reverse();
  const selected = [];
  for (const c of candidates) {
    if (selected.some(s => s.axis === c.axis && Math.hypot(s.center[0] - c.center[0], s.center[1] - c.center[1]) < Math.max(tolerance * 2, Math.min(s.length, c.length) * .4))) continue;
    selected.push(c); if (selected.length >= 150) break;
  }
  return selected;
}
