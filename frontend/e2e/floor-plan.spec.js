import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { evaluateLayoutReferences, evaluateWallReferences } from '../src/features/room-planner/utils/floor-plan-evaluation.js';
import { test, expect } from './fixtures/test.js';

const references = JSON.parse(readFileSync(new URL('./fixtures/floor-plans/references.json', import.meta.url), 'utf8'));
const storage = page => page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')));
for (const [name, file] of [['白黒図面', 'monochrome'], ['着色図面', 'colored'], ['黒背景の図面', 'dark-background'], ['木目のある図面', 'textured']]) {
  test(`${name}を実際のOpenCVで解析し、数値調整した枠を保存・復元できる`, async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByText('間取り画像から3Dの枠を作る', { exact: true }).click();
    await expect(page.getByRole('combobox', { name: '検出感度' })).toHaveCount(0);
    await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL(`./fixtures/floor-plans/${file}.jpg`, import.meta.url)));
    await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
    await expect(page.getByRole('img', { name: '壁候補と床の編集図' })).toBeVisible();
    const walls = await page.locator('.floor-drawing line').count();
    expect(walls).toBeGreaterThan(2);
    await page.getByLabel('全体の幅 (m)', { exact: true }).fill('10');
    await page.getByLabel('壁の高さ (m)', { exact: true }).fill('2.7');
    await page.getByRole('button', { name: '全体寸法を更新', exact: true }).click();
    await page.getByRole('button', { name: 'この枠で3Dを作成', exact: true }).click();
    await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
    const value = await storage(page);
    expect(value.version).toBe(2); expect(value.room.items).toHaveLength(0);
    expect(value.room.customPlan.h).toBe(2.7);
    expect(value.room.customPlan.walls).toHaveLength(walls);
    const reference = references.images[file], model = value.room.customPlan;
    const lines = model.walls.map(w => [w.start[0] / model.w * reference.width, w.start[1] / model.d * reference.height,
      w.end[0] / model.w * reference.width, w.end[1] / model.d * reference.height]);
    const metrics = evaluateWallReferences(lines, reference, references.tolerance);
    expect(evaluateLayoutReferences(model, reference), '開口と出っ張りの立体形状を保持する').toEqual({ blockedOpenings: 0, missingWallPoints: 0, unexpectedSolidPoints: 0 });
    expect(metrics.coverage, '目視で注釈した一部の壁を十分に拾う').toBeGreaterThanOrEqual(reference.minCoverage);
    expect(metrics.nonWallLength, '指定した文字・家具・タイル領域の誤検出を抑える').toBeLessThanOrEqual(reference.maxNonWallLength);
    await testInfo.attach(`${file}-partial-evaluation`, { body: JSON.stringify(metrics), contentType: 'application/json' });
    await testInfo.attach(`${file}-model`, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
    await page.reload();
    await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
    await expect(page.getByRole('img', { name: '壁候補と床の編集図' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '部屋を共有', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('取込間取りの共有は未対応');
    await expect(page.getByRole('button', { name: '共有リンクを作成', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^ワンルーム/ }).click();
    await expect(page.locator('.width-tag')).toHaveText('5.4 m');
  });
}

test('不正な画像と中止後の再解析を処理し、既存の配置を保持する', async ({ page }) => {
  await page.goto('/');
  await page.getByText('間取り画像から3Dの枠を作る', { exact: true }).click();
  const input = page.getByLabel('間取り画像', { exact: true });
  await input.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toContainText('JPEG・PNG・WebP');
  await expect(page.getByRole('heading', { name: 'ワンルーム / 3Dレイアウト' })).toBeVisible();
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

test('壁の端点・開口部・床輪郭を編集し、不正な輪郭は適用しない', async ({ page }) => {
  await page.goto('/');
  await page.getByText('間取り画像から3Dの枠を作る', { exact: true }).click();
  await page.getByRole('button', { name: '空の枠から編集' }).click();
  // 図面にポインターで2点を指定して壁を追加する。
  await page.getByRole('combobox', { name: '図面の操作', exact: true }).selectOption('wall');
  const drawing = page.getByRole('img', { name: '壁候補と床の編集図' });
  const box = await drawing.boundingBox();
  await drawing.click({ position: { x: box.width * .2, y: box.height * .3 } });
  await drawing.click({ position: { x: box.width * .8, y: box.height * .3 } });
  await expect(page.getByLabel('壁の始点 X (m)')).toBeVisible();
  await page.getByLabel('壁の始点 X (m)').fill('1'); await page.getByLabel('壁の始点 Z (m)').fill('1');
  await page.getByLabel('壁の終点 X (m)').fill('7'); await page.getByLabel('壁の終点 Z (m)').fill('1');
  await page.getByLabel('この壁の厚さ (m)', { exact: true }).fill('0.25');
  await page.getByRole('button', { name: '壁を更新', exact: true }).click();
  await page.getByLabel('壁の基準厚さ (m)', { exact: true }).fill('0.24');
  await page.getByRole('button', { name: '全体寸法を更新', exact: true }).click();
  await expect(page.getByLabel('この壁の厚さ (m)', { exact: true })).toHaveValue('0.5');
  await page.getByRole('button', { name: '開口部を追加', exact: true }).click();
  await expect(page.getByLabel('開口部 1を削除')).toBeVisible();
  // 同じ位置の開口部は重複するため拒否する。
  await page.getByRole('button', { name: '開口部を追加', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('開口部の重なり');
  await page.getByLabel('編集する壁・床').selectOption({ label: '室内床 1' });
  await page.getByLabel('床の頂点 2 Z (m)').fill('8');
  await page.getByLabel('床の頂点 3 Z (m)').fill('0');
  await page.getByRole('button', { name: '床を更新', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('床の頂点 2 Z (m)').fill('0');
  await page.getByLabel('床の頂点 3 Z (m)').fill('8');
  await page.getByLabel('床の分類').selectOption('balcony');
  await page.getByRole('button', { name: '床を更新', exact: true }).click();
  await page.getByRole('button', { name: 'この枠で3Dを作成', exact: true }).click();
  expect((await storage(page)).room.customPlan.floors[0].kind).toBe('balcony');
  const model = (await storage(page)).room.customPlan;
  expect(model.walls[0].openings).toHaveLength(1);
  expect(model.wallThickness * model.walls[0].thicknessRatio).toBeCloseTo(0.5);
});
