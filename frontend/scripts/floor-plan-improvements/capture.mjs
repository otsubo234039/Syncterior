import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, open, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { floorPlanFromLines } from '../../src/features/room-planner/utils/floor-plan-detection.js';
import { wallPieces, isFloorPlan } from '../../src/features/room-planner/utils/floor-plan.js';
import { evaluateLayoutReferences, evaluateWallReferences } from '../../src/features/room-planner/utils/floor-plan-evaluation.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const output = join(root, 'docs/floor-plan-improvement-assets');
const modes = ['baseline', 'width', 'ends', 'width-ends', 'floor', 'color', 'guarded-ends', 'color-fallback'];
const requestedModes = process.argv.find(a => a.startsWith('--modes='))?.slice(8).split(',');
const selectedModes = requestedModes ?? modes;
if (selectedModes.some(mode => !modes.includes(mode))) throw Error('Unknown mode');
const allImages = ['monochrome', 'colored', 'dark-background', 'textured', 'cottage', 'riverside'];
const selectedImages = process.argv.find(a => a.startsWith('--images='))?.slice(9).split(',');
const images = selectedImages ?? allImages;
if (images.some(name => !allImages.includes(name))) throw Error('Unknown image');
const references = JSON.parse(await readFile(join(root, 'e2e/fixtures/floor-plans/references.json'), 'utf8'));
const extraReferences = JSON.parse(await readFile(join(root, 'e2e/fixtures/floor-plans/holdout/references.json'), 'utf8'));
Object.assign(references.images, extraReferences.images);
const refinements = (await readFile(join(root, 'scripts/floor-plan-improvements/refinements.js'), 'utf8')).replace('export function', 'function');
const originalWorker = execFileSync('git', ['show', 'b11497e:frontend/src/features/room-planner/utils/opencv-worker.js'], { cwd: root, encoding: 'utf8' });
const productionWorker = await readFile(join(root, 'src/features/room-planner/utils/opencv-worker.js'), 'utf8');
const viewer = (await readFile(join(root, 'scripts/floor-plan-comparison/viewer.html'), 'utf8'))
  .replace('const labels={', "const labels={baseline:'改善前',width:'輪郭による線幅補正',ends:'画素に沿う端点補正','width-ends':'線幅＋端点補正',floor:'床の輪郭推定',color:'有彩色の壁も保持','guarded-ends':'厳格な端点補正','color-fallback':'空結果だけ有彩色で再解析',");
const inputPath = name => join(root, 'e2e/fixtures/floor-plans', ['cottage', 'riverside'].includes(name) ? `holdout/${name}.png` : `${name}.jpg`);
const lock = join(root, '.playwright-run.lock');
async function acquire() {
  for (let i = 0; i < 2; i++) {
    try {
      const file = await open(lock, 'wx');
      try { await file.writeFile(String(process.pid)); } finally { await file.close(); }
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = Number(await readFile(lock, 'utf8'));
      if (Number.isSafeInteger(owner) && owner > 0) {
        try { process.kill(owner, 0); } catch (check) { if (check.code === 'ESRCH') { await unlink(lock); continue; } }
      }
      throw Error('E2Eまたは比較キャプチャが実行中です。');
    }
  }
  throw Error('実行ロックを取得できませんでした。');
}
await acquire();
let browser;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    let body, mime = 'text/javascript';
    if (path === '/viewer.html') { body = viewer; mime = 'text/html'; }
    else if (/^\/worker-[a-z-]+\.js$/.test(path)) {
      const mode = path.slice('/worker-'.length, -3);
      if (!modes.includes(mode)) throw Error('Unknown mode');
      const worker = mode === 'color-fallback' ? productionWorker : mode === 'color' ? originalWorker.replace('Math.max(r, g, b) - Math.min(r, g, b) > 45 || ', '') : originalWorker;
      body = mode === 'baseline' ? worker : refinements + '\n' + worker.replace('self.postMessage({ lines, lineWidths, width, height, strokeWidth, blockSize,',
        `const refinement = refineWallCandidates({ width, height, mask, lines, lineWidths, strokeWidth }, '${mode}', cv, own);\n    self.postMessage({ ...refinement, width, height, strokeWidth, blockSize,`);
    } else if (path === '/opencv.js') body = await readFile(require.resolve('@techstark/opencv-js/dist/opencv.js'));
    else if (/^\/images\/[a-z-]+\.jpg$/.test(path)) {
      const name = path.split('/').at(-1).slice(0, -4);
      if (!images.includes(name)) throw Error('Unknown image');
      body = await readFile(inputPath(name)); mime = ['cottage', 'riverside'].includes(name) ? 'image/png' : 'image/jpeg';
    } else if (/^\/three\/[a-z.]+\.js$/.test(path)) body = await readFile(join(root, 'node_modules/three/build', path.split('/').at(-1)));
    else { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime); res.end(body);
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
try {
  await mkdir(join(output, 'models'), { recursive: true });
  await mkdir(join(output, 'raw'), { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const launch = () => chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const rows = (requestedModes || selectedImages) ? JSON.parse(await readFile(join(output, 'run.json'), 'utf8')).filter(row => !images.includes(row.image) || !selectedModes.includes(row.mode)) : [];
  for (const image of images) {
    for (const mode of selectedModes) {
      browser = await launch();
      const context = await browser.newContext({ viewport: { width: 1000, height: 1600 }, deviceScaleFactor: 1 });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/viewer.html'); await page.waitForFunction(() => window.ready);
      const raw = await page.evaluate(async ({ image, mode }) => {
        const bitmap = await createImageBitmap(await (await fetch(`/images/${image}.jpg`)).blob());
        const ratio = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
        const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return new Promise((resolve, reject) => {
          const worker = new Worker(`/worker-${mode}.js`);
          const finish = (error, value) => { clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(value); };
          const timer = setTimeout(() => finish(Error('Worker timeout')), 60000);
          worker.onerror = error => finish(Error(error.message)); worker.onmessage = ({ data }) => finish(null, data);
          worker.postMessage({ url: '/opencv.js', width: canvas.width, height: canvas.height, pixels: data.data.buffer }, [data.data.buffer]);
        });
      }, { image, mode });
      if (raw.error) throw Error(`${image}/${mode}: ${raw.error}`);
      await writeFile(join(output, 'raw', `${mode}-${image}.json`), JSON.stringify(raw));
      let plan = floorPlanFromLines(raw), floorApplied = false;
      if (raw.floors?.length) {
        const candidate = { ...plan, floors: raw.floors.map((ring, i) => ({ id: `floor-${i + 1}`, kind: 'room', points: ring.map(([x, y]) => [x / raw.width * plan.w, y / raw.height * plan.d]) })) };
        if (isFloorPlan(candidate)) { plan = candidate; floorApplied = true; }
      }
      const convert = ([x, y]) => [x / plan.w * raw.width, y / plan.d * raw.height];
      const polygons = plan.walls.flatMap(wall => wallPieces(wall, plan).map(piece => ({
        outer: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
          const x = a * piece.size[0] / 2, z = b * piece.size[2] / 2;
          return convert([piece.position[0] + plan.w / 2 + x * Math.cos(piece.rotation) + z * Math.sin(piece.rotation), piece.position[2] + plan.d / 2 - x * Math.sin(piece.rotation) + z * Math.cos(piece.rotation)]);
        }), holes: [],
      })));
      const data = { method: mode, image, width: raw.width, height: raw.height, polygons, floors: plan.floors.map(f => ({ outer: f.points.map(convert), holes: [] })), plan };
      const reference = references.images[image];
      const lines = plan.walls.map(w => [...convert(w.start), ...convert(w.end)]);
      const metrics = reference ? { ...evaluateWallReferences(lines, reference, references.tolerance), ...evaluateLayoutReferences(plan, reference) } : null;
      await page.evaluate(data => window.showResult(data), data);
      await page.locator('#overlay').screenshot({ path: join(output, `${mode}-${image}-recognition.png`) });
      await page.locator('#view').screenshot({ path: join(output, `${mode}-${image}-3d.png`) });
      await page.evaluate(() => window.disposeResult());
      if (errors.length) throw Error(errors.join('\n'));
      const row = { image, mode, usedColorFallback: raw.usedColorFallback ?? false, width: raw.width, height: raw.height, walls: plan.walls.length, changedWidths: raw.changedWidths ?? 0, changedEnds: raw.changedEnds ?? 0, floorApplied, metrics, errors };
      rows.push(row);
      await writeFile(join(output, 'run.json'), JSON.stringify(rows, null, 2) + '\n');
      await writeFile(join(output, 'models', `${mode}-${image}.json`), JSON.stringify(data));
      await context.close(); await browser.close(); browser = null;
      console.log(JSON.stringify({ ...row, metrics: metrics && { ...metrics, coverageByWall: undefined } }));
    }
  }
  await writeFile(join(output, 'run.json'), JSON.stringify(rows, null, 2) + '\n');
} finally {
  try { await browser?.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
  finally { if (await readFile(lock, 'utf8') === String(process.pid)) await unlink(lock); }
}
