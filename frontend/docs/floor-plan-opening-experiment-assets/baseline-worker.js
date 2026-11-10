// Classic Worker: OpenCVのUMD配布をメイン画面から隔離して読み込む。
self.onmessage = async ({ data: { url, width, height, pixels, retainColor = false } }) => {
  const resources = [];
  const own = mat => { resources.push(mat); return mat; };
  try {
    if (!self.cv) importScripts(url);
    // この配布版は自身を返すthenable。Promiseへ値を渡さず初期化だけを待つ。
    const cv = self.cv;
    if (!cv.Mat) await new Promise(resolve => cv.then(() => resolve()));
    const rgba = new Uint8ClampedArray(pixels.slice(0)), count = width * height;

    // 無彩色画像の透明部分は白へ合成してから黒背景を判定する。
    // 色付き透明図面では白補完が文字を復活させるため、既存の色救済を維持する。
    let chromaticInk = false;
    for (let at = 0; at < rgba.length; at += 4) {
      if (rgba[at + 3] >= 128 && Math.max(rgba[at], rgba[at + 1], rgba[at + 2]) - Math.min(rgba[at], rgba[at + 1], rgba[at + 2]) > 45) chromaticInk = true;
    }
    if (!chromaticInk) for (let at = 0; at < rgba.length; at += 4) {
      const alpha = rgba[at + 3];
      for (let c = 0; c < 3; c++) rgba[at + c] = Math.round(rgba[at + c] * alpha / 255 + 255 - alpha);
      rgba[at + 3] = 255;
    }
    const dark = new Uint8Array(count), outside = new Uint8Array(count), queue = new Int32Array(count);
    for (let i = 0; i < count; i++) { const at = i * 4; dark[i] = Math.max(rgba[at], rgba[at + 1], rgba[at + 2]) < 40 ? 1 : 0; }
    let head = 0, tail = 0;
    const add = i => { if (dark[i] && !outside[i]) { outside[i] = 1; queue[tail++] = i; } };
    for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
    while (head < tail) {
      const i = queue[head++], x = i % width;
      if (x) add(i - 1); if (x + 1 < width) add(i + 1);
      if (i >= width) add(i - width); if (i + width < count) add(i + width);
    }
    const source = own(cv.matFromArray(height, width, cv.CV_8UC4, rgba));
    const gray = own(new cv.Mat()), mask = own(new cv.Mat());
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    let coloredPixels = 0;
    for (let i = 0; i < count; i++) {
      const at = i * 4, r = rgba[at], g = rgba[at + 1], b = rgba[at + 2];
      const colored = Math.max(r, g, b) - Math.min(r, g, b) > 45;
      if (colored && rgba[at + 3] >= 128 && !outside[i]) coloredPixels++;
      if (outside[i] || (!retainColor && colored) || rgba[at + 3] < 128) gray.data[i] = 255;
    }

    // 外周につながる黒が画像の10%以上の不透明画像だけ補正する。
    // 一律のCLAHEは木目や薄い線のある図面で壁を欠落させる。
    if (tail >= count * .1 && rgba.every((value, index) => index % 4 !== 3 || value === 255)) {
      const enhanced = own(new cv.Mat()), clahe = own(new cv.CLAHE(2, new cv.Size(8, 8)));
      clahe.apply(gray, enhanced); enhanced.copyTo(gray);
    }
    const blockSize = Math.max(15, Math.min(51, Math.round(Math.max(width, height) * .065) | 1));
    cv.adaptiveThreshold(gray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, 12);
    const minimum = Math.max(11, Math.round(Math.max(width, height) * .035)) | 1;
    const bands = [];
    const collectBands = (vertical, minLength) => {
      const opened = own(new cv.Mat());
      const kernel = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(vertical ? 1 : minLength, vertical ? minLength : 1)));
      cv.morphologyEx(mask, opened, cv.MORPH_OPEN, kernel);
      const along = vertical ? height : width, across = vertical ? width : height;
      const groups = [];
      for (let b = 0; b < across; b++) {
        let start = -1;
        for (let a = 0; a <= along; a++) {
          const solid = a < along && opened.data[vertical ? a * width + b : b * width + a];
          if (solid && start < 0) start = a;
          if (!solid && start >= 0) {
            const end = a - 1;
            if (end - start + 1 >= minLength) {
              const group = groups.find(g => g.last === b - 1 && Math.min(end, g.end) - Math.max(start, g.start) >= (minLength < minimum ? Math.max(end - start, g.end - g.start) : Math.min(end - start, g.end - g.start)) * .65);
              if (group) { group.last = b; group.start = Math.min(group.start, start); group.end = Math.max(group.end, end); }
              else groups.push({ start, end, first: b, last: b });
            }
            start = -1;
          }
        }
      }
      return groups.filter(g => g.last - g.first + 1 <= Math.max(width, height) * .04).map(group => {
        const profile = [];
        for (let a = group.start; a <= group.end; a++) {
          let first = -1, bestFirst = -1, bestLast = -1;
          for (let b = group.first; b <= group.last + 1; b++) {
            const solid = b <= group.last && opened.data[vertical ? a * width + b : b * width + a];
            if (solid && first < 0) first = b;
            if (!solid && first >= 0) {
              if (bestFirst < 0 || b - first > bestLast - bestFirst + 1) { bestFirst = first; bestLast = b - 1; }
              first = -1;
            }
          }
          profile.push({ a, low: bestFirst, high: bestLast, thickness: bestFirst < 0 ? 0 : bestLast - bestFirst + 1 });
        }
        const middle = (group.first + group.last) / 2;
        return { start: vertical ? [middle, group.start] : [group.start, middle],
          end: vertical ? [middle, group.end] : [group.end, middle], thickness: group.last - group.first + 1,
          length: group.end - group.start, vertical, profile };
      });
    };
    for (const vertical of [false, true]) bands.push(...collectBands(vertical, minimum));
    const weighted = bands.filter(b => b.length >= Math.max(width, height) * .12).sort((a, b) => a.thickness - b.thickness);
    const weight = b => b.length * Math.min(b.length, Math.max(width, height) / 2) * Math.min(b.thickness, 8);
    const total = weighted.reduce((sum, b) => sum + weight(b), 0);
    let sum = 0, strokeWidth = 2;
    for (const band of weighted) { sum += weight(band); if (sum >= total / 2) { strokeWidth = Math.max(1, Math.min(12, band.thickness)); break; } }
    const minimumStroke = Math.max(1, strokeWidth * .65);
    // 帯の包囲矩形をそのまま壁にしない。断面の太さ・位置が変わるところで分割する。
    const fragments = [];
    for (const band of bands) {
      // 太さの揺れだけなら元の帯を維持する。細い区間を含む帯だけ分割する。
      let lowRun = 0, longestLowRun = 0;
      for (const p of band.profile) { lowRun = p.thickness < strokeWidth * .5 ? lowRun + 1 : 0; longestLowRun = Math.max(longestLowRun, lowRun); }
      const widths = band.profile.map(p => p.thickness);
      if (band.thickness >= minimumStroke && longestLowRun < minimum
        && Math.max(...widths) - Math.min(...widths) < strokeWidth * .5) {
        fragments.push({ ...band, structural: true });
        continue;
      }
      let run = null;
      const finish = () => {
        if (!run || run.to - run.from < 2) { run = null; return; }
        const middle = (run.low + run.high) / 2;
        fragments.push({ start: band.vertical ? [middle, run.from] : [run.from, middle],
          end: band.vertical ? [middle, run.to] : [run.to, middle], thickness: run.high - run.low + 1,
          length: run.to - run.from, vertical: band.vertical, structural: run.category, lowSupport: band.thickness >= minimumStroke && !run.category });
        run = null;
      };
      for (const p of band.profile) {
        if (!p.thickness) { finish(); continue; }
        // 扉の細線で太い壁の両端がつながっていても、低支持の区間を分離する。
        const category = p.thickness >= minimumStroke;
        if (run && (run.category !== category || Math.abs(run.low - p.low) > 1 || Math.abs(run.high - p.high) > 1)) finish();
        if (!run) run = { from: p.a, to: p.a, low: p.low, high: p.high, category };
        else { run.to = p.a; run.low = Math.min(run.low, p.low); run.high = Math.max(run.high, p.high); }
      }
      finish();
    }
    const strong = fragments.filter(b => b.structural);
    const weak = [];
    for (const band of [...bands, ...fragments]) {
      if (band.thickness >= minimumStroke || band.length < minimum - 1) continue;
      if (!weak.some(other => other.vertical === band.vertical
        && Math.hypot(other.start[0] - band.start[0], other.start[1] - band.start[1]) < 1
        && Math.hypot(other.end[0] - band.end[0], other.end[1] - band.end[1]) < 1)) weak.push(band);
    }
    const initialPoints = strong.flatMap(b => [b.start, b.end]);
    const bounds = initialPoints.length ? [Math.min(...initialPoints.map(p => p[0])), Math.min(...initialPoints.map(p => p[1])),
      Math.max(...initialPoints.map(p => p[0])), Math.max(...initialPoints.map(p => p[1]))] : [0, 0, width, height];
    const connects = (p, band, exterior = false) => {
      const dx = band.end[0] - band.start[0], dy = band.end[1] - band.start[1];
      const t = Math.max(0, Math.min(1, ((p[0] - band.start[0]) * dx + (p[1] - band.start[1]) * dy) / (dx * dx + dy * dy)));
      const target = [band.start[0] + t * dx, band.start[1] + t * dy];
      const length = Math.hypot(p[0] - target[0], p[1] - target[1]);
      if (length > strokeWidth * (exterior ? 1.5 : .55) + .5) return false;
      let gaps = 0;
      const steps = Math.max(1, Math.ceil(length * 2));
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(p[0] + (target[0] - p[0]) * i / steps), y = Math.round(p[1] + (target[1] - p[1]) * i / steps);
        let supported = mask.data[y * width + x];
        if (!supported && exterior) {
          const radius = Math.ceil(strokeWidth * .5);
          for (let oy = -radius; oy <= radius && !supported; oy++) for (let ox = -radius; ox <= radius; ox++) {
            const px = x + ox, py = y + oy;
            if (px >= 0 && px < width && py >= 0 && py < height && mask.data[py * width + px]) { supported = true; break; }
          }
        }
        if (!supported) gaps++;
      }
      return gaps / (steps + 1) <= .2;
    };
    // 近接した二本の壁線が両端の短い辺で閉じる場合、輪郭を一つの厚い壁として扱う。
    const hasCap = (from, to) => {
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      let ink = 0;
      const steps = Math.max(1, Math.ceil(length * 2));
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(from[0] + (to[0] - from[0]) * i / steps), y = Math.round(from[1] + (to[1] - from[1]) * i / steps);
        if (x >= 0 && x < width && y >= 0 && y < height && mask.data[y * width + x]) ink++;
      }
      return ink / (steps + 1) >= .8;
    };
    for (let pass = 0; pass < 4; pass++) {
      let found = false;
      for (let i = 0; i < strong.length && !found; i++) for (let j = i + 1; j < strong.length && !found; j++) {
        const a = strong[i], b = strong[j];
        if (a.vertical !== b.vertical) continue;
        const along = a.vertical ? 1 : 0, across = a.vertical ? 0 : 1;
        const separation = Math.abs(a.start[across] - b.start[across]);
        let from = Math.max(a.start[along], b.start[along]), to = Math.min(a.end[along], b.end[along]);
        const low = Math.min(a.start[across] - a.thickness / 2, b.start[across] - b.thickness / 2);
        const high = Math.max(a.start[across] + a.thickness / 2, b.start[across] + b.thickness / 2);
        if (separation < strokeWidth * .5 || separation > strokeWidth * 2.5 || to - from < minimum
          || high - low > Math.min(50, strokeWidth * 3)) continue;
        const point = (band, position) => a.vertical ? [band.start[0], position] : [position, band.start[1]];
        const cappedStart = [0, 1, 2, 3].map(n => from + n).find(p => hasCap(point(a, p), point(b, p)));
        const cappedEnd = [0, 1, 2, 3].map(n => to - n).find(p => hasCap(point(a, p), point(b, p)));
        if (cappedStart === undefined || cappedEnd === undefined || cappedEnd - cappedStart < minimum) continue;
        from = cappedStart; to = cappedEnd;
        const pieces = [];
        for (const band of [a, b]) for (const [start, end] of [[band.start[along], from], [to, band.end[along]]]) {
          if (end - start >= 2) pieces.push({ ...band, start: point(band, start), end: point(band, end), length: end - start });
        }
        const middle = (low + high) / 2;
        pieces.push({ start: a.vertical ? [middle, from] : [from, middle], end: a.vertical ? [middle, to] : [to, middle],
          vertical: a.vertical, length: to - from, thickness: high - low });
        strong.splice(j, 1); strong.splice(i, 1, ...pieces); found = true;
      }
      if (!found) break;
    }
    const isTexture = band => {
      const vertical = band.start[0] === band.end[0], coordinate = b => b.start[vertical ? 0 : 1];
      const similar = weak.filter(b => (b.start[0] === b.end[0]) === vertical
        && Math.abs(b.start[vertical ? 1 : 0] - band.start[vertical ? 1 : 0]) < strokeWidth * 2
        && Math.abs(b.end[vertical ? 1 : 0] - band.end[vertical ? 1 : 0]) < strokeWidth * 2).sort((a, b) => coordinate(a) - coordinate(b));
      const index = similar.indexOf(band);
      for (let i = Math.max(0, index - 3); i <= Math.min(index, similar.length - 4); i++) {
        const gaps = [1, 2, 3].map(j => coordinate(similar[i + j]) - coordinate(similar[i + j - 1]));
        if (Math.min(...gaps) >= 2 && Math.max(...gaps) <= Math.min(...gaps) * 1.4) return true;
      }
      return false;
    };
    const openingBridge = band => {
      const vertical = band.vertical, along = vertical ? 1 : 0, across = vertical ? 0 : 1;
      const collinear = strong.filter(s => s.vertical === vertical && Math.abs(s.start[across] - band.start[across]) <= strokeWidth * .6);
      const before = collinear.some(s => Math.abs(s.end[along] - band.start[along]) <= strokeWidth + 1);
      const after = collinear.some(s => Math.abs(s.start[along] - band.end[along]) <= strokeWidth + 1);
      const jambAt = p => strong.some(s => s.vertical !== vertical && connects(p, s));
      return (before && after) || (before && jambAt(band.end)) || (after && jambAt(band.start));
    };
    // 短い折れ返しは、両端が別方向の壁につながり、開口の細線でないものに限る。
    const shortMinimum = Math.max(3, Math.floor(strokeWidth * .5) | 1);
    for (const vertical of [false, true]) {
      for (const band of collectBands(vertical, shortMinimum)) {
        if (band.length >= minimum - 1 || band.length < 2
          || band.thickness > strokeWidth * 2.5 || openingBridge(band)) continue;
        const neighbors = strong.filter(s => s.vertical !== band.vertical);
        if ([band.start, band.end].every(p => neighbors.some(s => connects(p, s)))) strong.push(band);
      }
    }
    const extendsBounds = b => [b.start, b.end].some(([x, y]) => x < bounds[0] - strokeWidth || x > bounds[2] + strokeWidth
      || y < bounds[1] - strokeWidth || y > bounds[3] + strokeWidth);
    const overlapsLowSupport = b => fragments.some(f => f.lowSupport && f.vertical === b.vertical
      && Math.abs(f.start[b.vertical ? 0 : 1] - b.start[b.vertical ? 0 : 1]) <= strokeWidth * .6
      && Math.min(f.end[b.vertical ? 1 : 0], b.end[b.vertical ? 1 : 0])
        - Math.max(f.start[b.vertical ? 1 : 0], b.start[b.vertical ? 1 : 0]) >= minimum / 2);
    const weakCandidates = weak.filter(b => !isTexture(b) && (!openingBridge(b) || !overlapsLowSupport(b) || extendsBounds(b)));
    // 接続は近さだけで決めず、間の画素にも線があることを確認する。
    for (let pass = 0; pass < 3; pass++) {
      const rescued = weakCandidates.filter(b => {
        if (strong.includes(b)) return false;
        const contacts = [b.start, b.end].filter(p => strong.some(s => connects(p, s, extendsBounds(b)))).length;
        const extendsOutside = [b.start, b.end].some(([x, y]) => x < bounds[0] - strokeWidth || x > bounds[2] + strokeWidth
          || y < bounds[1] - strokeWidth || y > bounds[3] + strokeWidth);
        return contacts === 2 || (contacts === 1 && extendsOutside && b.length >= minimum * 2);
      });
      strong.push(...rescued);
    }
    // 斜め壁は長さ・太さの裏付けがあるものだけ残す。扉の弧の接線を壁にしない。
    const diagonals = own(new cv.Mat());
    cv.HoughLinesP(mask, diagonals, 1, Math.PI / 180, minimum * 2, minimum * 3, 0);
    const lineWidths = [];
    const lines = strong.flatMap(band => {
      const vertical = band.start[0] === band.end[0];
      const endpoints = [band.start, band.end].map(p => {
        let best = p, closest = Infinity;
        for (const other of strong) {
          if (other === band || (other.start[0] === other.end[0]) === vertical || !connects(p, other)) continue;
          const intersection = vertical ? [p[0], other.start[1]] : [other.start[0], p[1]];
          const delta = Math.hypot(p[0] - intersection[0], p[1] - intersection[1]);
          if (delta < closest && delta <= strokeWidth * .55 + .5) { best = intersection; closest = delta; }
        }
        return best;
      });
      if (Math.hypot(endpoints[1][0] - endpoints[0][0], endpoints[1][1] - endpoints[0][1]) < 2) return [];
      lineWidths.push(band.thickness);
      return endpoints.flat();
    });
    for (let i = 0; i < diagonals.data32S.length; i += 4) {
      const [x1, y1, x2, y2] = Array.from(diagonals.data32S.subarray(i, i + 4));
      const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy);
      if (Math.min(Math.abs(dx), Math.abs(dy)) / length < .1) continue;
      let supported = 0;
      for (let sample = 1; sample < 10; sample++) {
        const x = x1 + dx * sample / 10, y = y1 + dy * sample / 10;
        const offset = Math.max(1, strokeWidth * .3);
        const points = [-offset, offset].map(n => [Math.round(x - dy / length * n), Math.round(y + dx / length * n)]);
        if (points.every(([px, py]) => px >= 0 && px < width && py >= 0 && py < height && mask.data[py * width + px])) supported++;
      }
      if (supported >= 7) { lines.push(x1, y1, x2, y2); lineWidths.push(strokeWidth); }
    }
    // 通常結果が空のときだけ有彩色の壁を救済する。通常の候補がある図面は変えない。
    // 初回のMatを解放してから同じOpenCVで一度だけ再解析し、ピークメモリを抑える。
    if (!retainColor && lines.length === 0 && coloredPixels > 0) {
      for (const resource of resources.reverse()) resource.delete();
      resources.length = 0;
      await self.onmessage({ data: { url, width, height, pixels, retainColor: true } });
      return;
    }
    self.postMessage({ lines, lineWidths, width, height, strokeWidth, blockSize, usedColorFallback: retainColor,
      engine: `OpenCV ${cv.getBuildInformation().match(/OpenCV\s+([^\s]+)/)?.[1] ?? '4.12'}` });
  } catch (error) {
    self.postMessage({ error: `画像解析に失敗しました。別の画像か手動編集をお試しください。 (${error.message ?? error})` });
  } finally { for (const resource of resources.reverse()) resource.delete(); }
};
