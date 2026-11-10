// 比較専用。製品の感度設定や依存関係には追加しない。
export const modes = ['baseline', 'alpha', 'alpha-color', 'bilateral', 'clahe', 'sauvola', 'median', 'safe-alpha', 'guarded-clahe'];
const normalization = `    // 透明画素を白背景へ合成してから、外側の黒背景を判定する。
    let transparent = false, chromaticInk = false;
    for (let i = 0; i < count; i++) {
      const at = i * 4, alpha = rgba[at + 3];
      if (alpha < 255) transparent = true;
      if (alpha >= 128 && Math.max(rgba[at], rgba[at + 1], rgba[at + 2]) - Math.min(rgba[at], rgba[at + 1], rgba[at + 2]) > 45) chromaticInk = true;
      if (alpha < 255) {
        for (let c = 0; c < 3; c++) rgba[at + c] = Math.round(rgba[at + c] * alpha / 255 + 255 - alpha);
        rgba[at + 3] = 255;
      }
    }
`;
export function variant(source, mode) {
  if (mode === 'baseline') return source;
  source = source.replace('new Uint8ClampedArray(pixels), count', 'new Uint8ClampedArray(pixels.slice(0)), count');
  if (['safe-alpha', 'guarded-clahe'].includes(mode)) {
    source = source.replace('    const dark =', `
    // 色付き透明図面では既存の色救済を維持する。
    let chromaticInk = false;
    for (let at = 0; at < rgba.length; at += 4) {
      if (rgba[at + 3] >= 128 && Math.max(rgba[at], rgba[at + 1], rgba[at + 2]) - Math.min(rgba[at], rgba[at + 1], rgba[at + 2]) > 45) chromaticInk = true;
    }
    if (!chromaticInk) for (let at = 0; at < rgba.length; at += 4) {
      const alpha = rgba[at + 3];
      for (let c = 0; c < 3; c++) rgba[at + c] = Math.round(rgba[at + c] * alpha / 255 + 255 - alpha);
      rgba[at + 3] = 255;
    }
    const dark =`);
  } else source = source.replace('    const dark =', normalization + (mode === 'alpha' ? '' : '    retainColor ||= transparent && chromaticInk;\n') + '    const dark =');
  let filter = '';
  if (mode === 'bilateral') filter = `const filtered = own(new cv.Mat()); cv.bilateralFilter(gray, filtered, 5, 20, 2); filtered.copyTo(gray);`;
  if (mode === 'median') filter = `cv.medianBlur(gray, gray, 3);`;
  if (mode === 'clahe') filter = `const enhanced = own(new cv.Mat()), clahe = own(new cv.CLAHE(2, new cv.Size(8, 8))); clahe.apply(gray, enhanced); enhanced.copyTo(gray);`;
  if (mode === 'guarded-clahe') filter = `
    if (tail >= count * .1 && rgba.every((value, index) => index % 4 !== 3 || value === 255)) {
      const enhanced = own(new cv.Mat()), clahe = own(new cv.CLAHE(2, new cv.Size(8, 8)));
      clahe.apply(gray, enhanced); enhanced.copyTo(gray);
    }`;
  source = source.replace('    const blockSize =', filter + '\n    const blockSize =');
  if (mode === 'sauvola') source = source.replace('cv.adaptiveThreshold(gray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, 12);', `
    const float = own(new cv.Mat()), mean = own(new cv.Mat()), square = own(new cv.Mat()), variance = own(new cv.Mat());
    gray.convertTo(float, cv.CV_32F); cv.boxFilter(float, mean, -1, new cv.Size(blockSize, blockSize));
    cv.multiply(float, float, square); cv.boxFilter(square, variance, -1, new cv.Size(blockSize, blockSize));
    mask.create(height, width, cv.CV_8UC1);
    for (let i = 0; i < count; i++) {
      const m = mean.data32F[i], std = Math.sqrt(Math.max(0, variance.data32F[i] - m * m));
      mask.data[i] = gray.data[i] < m * (1 + .2 * (std / 128 - 1)) ? 255 : 0;
    }`);
  return source;
}
