import { reloadLayout, openImageImport, convertAndPreview } from './fixtures/workspace.js';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { isFloorPlan, wallLength } from '../src/features/room-planner/utils/floor-plan.js';
import { evaluateLayoutReferences, evaluateWallReferences } from '../src/features/room-planner/utils/floor-plan-evaluation.js';
import { test, expect } from './fixtures/test.js';
import { measurementDrawing, pickMeasurementPoint, calibrateDrawing } from './fixtures/floor-plan.js';

const references = JSON.parse(readFileSync(new URL('./fixtures/floor-plans/references.json', import.meta.url), 'utf8'));
const storage = page => page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')));
for (const [name, file] of [['白黒図面', 'monochrome'], ['着色図面', 'colored'], ['黒背景の図面', 'dark-background'], ['木目のある図面', 'textured']]) {
  test(`${name}を実際のOpenCVで解析し、一辺でサイズを合わせた枠を保存・復元できる`, async ({ page }, testInfo) => {
    await page.goto('/');
    await openImageImport(page);
    await expect(page.getByRole('combobox', { name: '検出感度' })).toHaveCount(0);
    await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL(`./fixtures/floor-plans/${file}.jpg`, import.meta.url)));
    await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
    await expect(measurementDrawing(page)).toBeVisible();
    const walls = await page.locator('.floor-drawing .floor-wall').count();
    expect(walls).toBeGreaterThan(2);
    for (const name of ['空の枠から編集', '壁を数値で追加', '全体寸法を更新']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    await expect(page.getByLabel('模型の表示倍率')).toHaveCount(0);
    const before = await calibrateDrawing(page);
    await testInfo.attach(`${file}-calibration`, { body: await page.locator('.floor-import').screenshot(), contentType: 'image/png' });
    expect(await storage(page)).toBeNull();
    await convertAndPreview(page);
    await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
    const value = await storage(page);
    expect(value.version).toBe(2); expect(value.room.items).toHaveLength(0);
    expect(value.room.customPlan.h).toBe(2.4);
    expect(value.room.customPlan.w).toBeCloseTo(before.w * 1.2, 6);
    expect(value.room.customPlan.d).toBeCloseTo(before.d * 1.2, 6);
    expect(value.room.customPlan.walls).toHaveLength(walls);
    const reference = references.images[file], model = value.room.customPlan;
    const lines = model.walls.map(w => [w.start[0] / model.w * reference.width, w.start[1] / model.d * reference.height,
      w.end[0] / model.w * reference.width, w.end[1] / model.d * reference.height]);
    const metrics = evaluateWallReferences(lines, reference, references.tolerance);
    expect(evaluateLayoutReferences(model, reference), '開口と出っ張りの立体形状を保持する').toEqual({ blockedOpenings: 0, missingWallPoints: 0, unexpectedSolidPoints: 0 });
    expect(metrics.coverage, '目視で注釈した一部の壁を十分に拾う').toBeGreaterThanOrEqual(file === 'dark-background' ? .85 : reference.minCoverage);
    expect(metrics.nonWallLength, '指定した文字・家具・タイル領域の誤検出を抑える').toBeLessThanOrEqual(reference.maxNonWallLength);
    await testInfo.attach(`${file}-partial-evaluation`, { body: JSON.stringify(metrics), contentType: 'application/json' });
    await testInfo.attach(`${file}-model`, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
    await reloadLayout(page);
    await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
    await openImageImport(page);
    await expect(measurementDrawing(page)).toBeVisible();
    await page.getByRole('button', { name: '3D・家具配置', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '部屋を共有', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('図面から作成した間取りの共有は未対応');
    await expect(page.getByRole('button', { name: '共有リンクを作成', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^ワンルーム/ }).click();
    await expect(page.locator('.width-tag')).toHaveText('5.4 m');
  });
}

test('不正な画像と中止後の再解析を処理し、既存の配置を保持する', async ({ page }) => {
  await page.goto('/');
  await openImageImport(page);
  const input = page.getByLabel('間取り画像', { exact: true });
  await input.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toContainText('JPEG・PNG・WebP');
  await expect(page.getByRole('heading', { name: '図面モード', exact: true })).toBeVisible();
  await input.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toBeVisible();
  // OpenCV配布の読み込み中に中止し、古い解析結果が後から適用されないことを確認する。
  let blocked;
  await page.route(/opencv[^/]*\.js/, route => { blocked = route; });
  await input.setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/monochrome.jpg', import.meta.url)));
  await page.getByRole('button', { name: '解析を中止', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '解析を中止しました。' })).toBeVisible();
  await page.unroute(/opencv[^/]*\.js/);
  await blocked?.abort().catch(() => {});
  await input.setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/colored.jpg', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
});

test('認識された長い壁の途中でも任意の2点を基準にでき、補正の取消と再適用で保存前の配置を保つ', async ({ page }) => {
  await page.goto('/');
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/colored.jpg', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
  const before = await calibrateDrawing(page);
  const dimensions = () => measurementDrawing(page).evaluate(svg => { const [, , w, d] = svg.getAttribute('viewBox').split(/\s+/).map(Number); return { w, d }; });
  expect((await dimensions()).w).toBeCloseTo(before.w * 1.2, 6);
  await page.getByRole('button', { name: 'この長さで全体を補正', exact: true }).click();
  expect((await dimensions()).w).toBeCloseTo(before.w * 1.2, 6);
  await page.getByRole('button', { name: 'サイズ補正を取り消す', exact: true }).click();
  expect((await dimensions()).w).toBeCloseTo(before.w, 6);
  expect(await storage(page)).toBeNull();
  await page.getByLabel('測った一辺の長さ (m)', { exact: true }).fill('9999');
  await page.getByRole('button', { name: 'この長さで全体を補正', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('有効な2点と長さ');
  expect((await dimensions()).w).toBeCloseTo(before.w, 6);
  await page.getByRole('button', { name: '2点を選び直す', exact: true }).click();
  await expect(page.getByRole('button', { name: 'この長さで全体を補正', exact: true })).toBeDisabled();
  await pickMeasurementPoint(page, [.5, .4]);
  await page.getByRole('button', { name: '終点を指定', exact: true }).click();
  // キーボードで同じ点まで戻してゼロ距離を作る。
  await pickMeasurementPoint(page, [.6, .4]);
  for (const name of ['計測の始点', '計測の終点']) {
    await page.getByRole('button', { name, exact: true }).focus();
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('Shift+ArrowLeft'); await page.keyboard.press('Shift+ArrowUp');
    }
  }
  await expect(page.getByRole('button', { name: 'この長さで全体を補正', exact: true })).toBeDisabled();
  const endpoint = page.getByRole('button', { name: '計測の終点', exact: true });
  await endpoint.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'この長さで全体を補正', exact: true })).toBeEnabled();
});

test('長辺1024pxへ縮小する追加図面を解析し、短い断片があっても保存・復元できる', async ({ page }) => {
  await page.goto('/');
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/holdout/riverside.png', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
  await calibrateDrawing(page);
  await convertAndPreview(page);
  await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
  const saved = await storage(page);
  expect(isFloorPlan(saved.room.customPlan)).toBe(true);
  expect(saved.room.customPlan.walls.length).toBeGreaterThan(50);
  expect(saved.room.customPlan.walls.every(wall => wallLength(wall) >= .02)).toBe(true);
  await reloadLayout(page);
  await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
  expect(await storage(page)).toEqual(saved);
});

test('通常解析が空になる色付き壁の追加図面を自動再解析し、保存して編集を続けられる', async ({ page }) => {
  await page.goto('/');
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/holdout/cottage.png', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();

  await calibrateDrawing(page);
  await convertAndPreview(page);
  await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
  expect((await storage(page)).room.customPlan.walls.length).toBeGreaterThan(10);
});

test('透明PNGの黒い枠を白背景と同じ形状で取り込み保存できる', async ({ page }) => {
  await page.goto('/');
  const plans = [];
  for (const transparent of [false, true]) {
    // 復元した配置から図面モードの変換パネルを開き直す。
    if (transparent) await reloadLayout(page);
    const bytes = await page.evaluate(transparent => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,200,200); }
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(20,20,165,5); ctx.fillRect(20,20,5,165);
      ctx.fillRect(180,20,5,165); ctx.fillRect(20,180,165,5);
      return Array.from(Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), char => char.charCodeAt(0)));
    }, transparent);
    await openImageImport(page);
    await page.getByLabel('間取り画像', { exact: true }).setInputFiles({ name: 'frame.png', mimeType: 'image/png', buffer: Buffer.from(bytes) });
    await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
    await expect(page.locator('.floor-drawing line')).toHaveCount(4);
    await convertAndPreview(page);
    await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
    plans.push((await storage(page)).room.customPlan);
  }
  expect(plans[1]).toEqual(plans[0]);
  await reloadLayout(page);
  await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
  expect((await storage(page)).room.customPlan).toEqual(plans[1]);
});

test('計測点をドラッグしても保存せず、ポインターのキャンセル後も選び直せる', async ({ page }) => {
  await page.goto('/');
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/monochrome.jpg', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
  await pickMeasurementPoint(page, [.22, .42]); await pickMeasurementPoint(page, [.47, .42]);
  const start = page.getByRole('button', { name: '計測の始点', exact: true });
  await start.scrollIntoViewIfNeeded();
  const endBefore = await page.getByRole('button', { name: '計測の終点', exact: true }).getAttribute('transform');
  const before = await start.getAttribute('transform'), box = await start.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await expect.poll(() => start.evaluate(el => el.hasPointerCapture(1))).toBe(true);
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 10, { steps: 4 });
  await expect(start).not.toHaveAttribute('transform', before);
  await start.dispatchEvent('pointercancel', { pointerId: 1 });
  await expect.poll(() => start.evaluate(el => el.hasPointerCapture(1))).toBe(false);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: '計測の終点', exact: true })).toHaveAttribute('transform', endBefore);
  expect(await storage(page)).toBeNull();
  await page.getByRole('button', { name: '2点を選び直す', exact: true }).click();
  await expect(start).toHaveCount(0);
  await pickMeasurementPoint(page, [.2, .3]); await pickMeasurementPoint(page, [.6, .3]);
  await expect(page.getByRole('button', { name: 'この長さで全体を補正', exact: true })).toBeEnabled();
});
