// 実験専用。変更対象は既存の壁候補だけ。画像ごとの設定や正解注釈を参照しない。
export function refineWallCandidates({ width, height, mask, lines, lineWidths, strokeWidth }, mode, cv, own) {
  const result = { lines: [...lines], lineWidths: [...lineWidths], changedWidths: 0, changedEnds: 0, floors: [] };
  const ink = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    return x >= 0 && x < width && y >= 0 && y < height && mask.data[y * width + x] > 0;
  };
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (let i = 0; i < lines.length; i += 4) {
    let [x1, y1, x2, y2] = lines.slice(i, i + 4);
    const length = Math.hypot(x2 - x1, y2 - y1), dx = (x2 - x1) / length, dy = (y2 - y1) / length;
    const original = lineWidths[i / 4];
    if (mode.includes('width') && length >= strokeWidth * 3 && original <= strokeWidth * 1.5) {
      const sections = [];
      for (let sample = 1; sample < 10; sample++) {
        const x = x1 + (x2 - x1) * sample / 10, y = y1 + (y2 - y1) * sample / 10;
        if (!ink(x, y)) continue;
        let left = 0, right = 0;
        const limit = Math.ceil(Math.max(original, strokeWidth) * 1.5);
        while (left < limit && ink(x - dy * (left + 1), y + dx * (left + 1))) left++;
        while (right < limit && ink(x + dy * (right + 1), y - dx * (right + 1))) right++;
        if (left < limit && right < limit) sections.push({ thickness: left + right + 1, offset: (left - right) / 2 });
      }
      if (sections.length >= 7) {
        const proposed = median(sections.map(s => s.thickness));
        const consistent = sections.filter(s => Math.abs(s.thickness - proposed) <= 1).length >= 7;
        if (consistent && proposed >= original * .5 && proposed <= original * 1.5) {
          const offset = median(sections.map(s => s.offset));
          if (Math.abs(offset) <= strokeWidth * .5 && (Math.abs(proposed - original) >= 1 || Math.abs(offset) >= .5)) {
            x1 -= dy * offset; x2 -= dy * offset; y1 += dx * offset; y2 += dx * offset;
            result.lineWidths[i / 4] = proposed; result.changedWidths++;
          }
        }
      }
    }
    if (mode.includes('ends')) {
      const thickness = result.lineWidths[i / 4];
      // 各断面に十分な線画素が続く間だけ伸ばす。白い隙間で直ちに止める。
      const supported = (x, y) => {
        const radius = Math.max(0, Math.floor((thickness - 1) / 2));
        let count = 0;
        for (let n = -radius; n <= radius; n++) if (ink(x - dy * n, y + dx * n)) count++;
        return ink(x, y) && count / (radius * 2 + 1) >= (mode === 'guarded-ends' ? 1 : .8);
      };
      for (const start of [true, false]) {
        const sign = start ? -1 : 1;
        const x = start ? x1 : x2, y = start ? y1 : y2;
        let extension = 0;
        for (let distance = .5; distance <= Math.min(mode === 'guarded-ends' ? 2 : 4, strokeWidth * .75); distance += .5) {
          const px = x + dx * distance * sign, py = y + dy * distance * sign;
          if (px < 0 || px >= width || py < 0 || py >= height || !supported(px, py)) break;
          extension = distance;
        }
        if (extension) {
          if (start) { x1 += dx * extension * sign; y1 += dy * extension * sign; }
          else { x2 += dx * extension; y2 += dy * extension; }
          result.changedEnds++;
        }
      }
    }
    result.lines.splice(i, 4, x1, y1, x2, y2);
  }
  if (mode === 'floor') {
    // 仮閉鎖は床探索だけで使い、result.lines（3Dの壁）を変更しない。
    const walls = own(cv.Mat.zeros(height, width, cv.CV_8UC1));
    for (let i = 0; i < lines.length; i += 4) {
      const [x1, y1, x2, y2] = lines.slice(i, i + 4);
      cv.line(walls, new cv.Point(Math.round(x1), Math.round(y1)), new cv.Point(Math.round(x2), Math.round(y2)), new cv.Scalar(255), Math.max(1, Math.round(lineWidths[i / 4])));
    }
    const horizontal = own(new cv.Mat()), vertical = own(new cv.Mat()), closed = own(new cv.Mat());
    const length = Math.max(3, Math.round(strokeWidth * 6) | 1);
    const hKernel = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(length, 1)));
    const vKernel = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, length)));
    cv.morphologyEx(walls, horizontal, cv.MORPH_CLOSE, hKernel); cv.morphologyEx(walls, vertical, cv.MORPH_CLOSE, vKernel);
    cv.bitwise_or(horizontal, vertical, closed);
    const inverse = own(new cv.Mat()); cv.bitwise_not(closed, inverse);
    const labels = own(new cv.Mat()), stats = own(new cv.Mat()), centers = own(new cv.Mat());
    const count = cv.connectedComponentsWithStats(inverse, labels, stats, centers, 4, cv.CV_32S);
    const filled = own(closed.clone());
    for (let label = 1; label < count; label++) {
      const [x, y, w, h, area] = Array.from(stats.data32S.slice(label * 5, label * 5 + 5));
      if (x <= 0 || y <= 0 || x + w >= width || y + h >= height || area < width * height * .005) continue;
      for (let at = 0; at < labels.data32S.length; at++) if (labels.data32S[at] === label) filled.data[at] = 255;
    }
    const contours = own(new cv.MatVector()), hierarchy = own(new cv.Mat());
    cv.findContours(filled, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let largest = null, largestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const contour = own(contours.get(i)), area = cv.contourArea(contour);
      if (area > largestArea) { largest = contour; largestArea = area; }
    }
    if (largest && largestArea >= width * height * .15) {
      const simplified = own(new cv.Mat()); cv.approxPolyDP(largest, simplified, Math.max(1, strokeWidth * .35), true);
      const ring = [];
      for (let i = 0; i < simplified.data32S.length; i += 2) ring.push([simplified.data32S[i], simplified.data32S[i + 1]]);
      // 小さな部屋だけを床にしない。既存の壁候補のほぼすべてを包含することを求める。
      const contained = Array.from({ length: lines.length / 2 }, (_, i) => cv.pointPolygonTest(largest, new cv.Point(lines[i * 2], lines[i * 2 + 1]), false) >= 0).filter(Boolean).length;
      if (ring.length >= 3 && ring.length <= 64 && contained >= lines.length / 2 * .95) result.floors = [ring];
    }
  }
  return result;
}
