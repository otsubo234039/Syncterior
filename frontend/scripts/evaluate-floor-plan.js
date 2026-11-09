import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { runOpenCvWorker } from '../src/features/room-planner/utils/__tests__/helpers/opencv-worker.js';
import { floorPlanFromLines } from '../src/features/room-planner/utils/floor-plan-detection.js';
import { evaluateLayoutReferences, evaluateWallReferences } from '../src/features/room-planner/utils/floor-plan-evaluation.js';

const fixtures = new URL('../e2e/fixtures/floor-plans/', import.meta.url);
const references = JSON.parse(await readFile(new URL('references.json', fixtures), 'utf8'));
const baseline = JSON.parse(await readFile(new URL('baseline-lines.json', fixtures), 'utf8'));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const results = [];
  for (const [name, reference] of Object.entries(references.images)) {
    const bytes = await readFile(new URL(`${name}.jpg`, fixtures));
    const decoded = await page.evaluate(async url => {
      const bitmap = await createImageBitmap(await (await fetch(url)).blob());
      try {
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
        return { width: canvas.width, height: canvas.height, data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
      } finally { bitmap.close(); }
    }, `data:image/jpeg;base64,${bytes.toString('base64')}`);
    const started = performance.now();
    const output = await runOpenCvWorker({ ...decoded, pixels: new Uint8ClampedArray(decoded.data).buffer });
    const plan = floorPlanFromLines(output);
    const current = plan.walls.map(w => [w.start[0] / plan.w * decoded.width, w.start[1] / plan.d * decoded.height,
      w.end[0] / plan.w * decoded.width, w.end[1] / plan.d * decoded.height]);
    const metrics = evaluateWallReferences(current, reference, references.tolerance);
    results.push({ image: name, baseline: evaluateWallReferences(baseline[name], reference, references.tolerance),
      current: metrics, layout: evaluateLayoutReferences(plan, reference), wallCount: plan.walls.length, processingMs: performance.now() - started });
    if (metrics.coverage < reference.minCoverage || metrics.nonWallLength > reference.maxNonWallLength
      || Object.values(results.at(-1).layout).some(n => n > 0)) process.exitCode = 1;
  }
  const directory = new URL('../test-results/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('floor-plan-evaluation.json', directory), JSON.stringify({ description: references.description,
    tolerance: references.tolerance, includesBrowserDecodeAndDownloadTime: false, results }, null, 2));
  console.table(results.map(r => ({ 画像: r.image, '一部の壁の網羅率（前）': (r.baseline.coverage * 100).toFixed(1),
    '一部の壁の網羅率（後）': (r.current.coverage * 100).toFixed(1), '非壁領域の線長px（前）': r.baseline.nonWallLength.toFixed(1),
    '非壁領域の線長px（後）': r.current.nonWallLength.toFixed(1), '入口を塞ぐ点': r.layout.blockedOpenings, '欠落した出っ張り': r.layout.missingWallPoints, '輪郭外の壁': r.layout.unexpectedSolidPoints })));
  console.log('図面全体の精度ではなく、手動で選んだ部分注釈との比較です。結果: test-results/floor-plan-evaluation.json');
} finally { await browser.close(); }
