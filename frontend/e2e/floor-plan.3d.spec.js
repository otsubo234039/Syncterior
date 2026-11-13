import { openLayout, openImageImport, convertAndPreview } from './fixtures/workspace.js';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { evaluateLayoutReferences } from '../src/features/room-planner/utils/floor-plan-evaluation.js';
const references = JSON.parse(readFileSync(new URL('./fixtures/floor-plans/references.json', import.meta.url), 'utf8'));
import { test, expect, drawCalls, waitForSceneToSettle } from './fixtures/test.js';
import { calibrateDrawing } from './fixtures/floor-plan.js';

for (const [name, file] of [['白黒図面', 'monochrome'], ['着色図面', 'colored'], ['黒背景の図面', 'dark-background'], ['木目のある図面', 'textured']]) {
  test(`${name}の壁候補を実WebGLで立体化し、一辺の実測補正を実寸モデルと3Dへ反映する`, async ({ page }, testInfo) => {
    if (['colored', 'textured'].includes(file)) await page.setViewportSize({ width: 390, height: 844 });
    await openLayout(page);
    await waitForSceneToSettle(page);
    await openImageImport(page);
    await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL(`./fixtures/floor-plans/${file}.jpg`, import.meta.url)));
    await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
    await testInfo.attach(`${file}-overlay`, { body: await page.locator('.floor-drawing').screenshot(), contentType: 'image/png' });
    const before = await drawCalls(page);
    await convertAndPreview(page);
    await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
    await expect.poll(() => drawCalls(page)).toBeGreaterThan(before);
    await waitForSceneToSettle(page);
    const canvas = page.getByRole('region', { name: '部屋の3Dプレビュー' });
    await canvas.scrollIntoViewIfNeeded();
    const image = await canvas.screenshot();
    await testInfo.attach(`${file}-3d`, { body: image, contentType: 'image/png' });
    const saved = await page.evaluate(() => localStorage.getItem('syncterior.personal-room'));
    expect(evaluateLayoutReferences(JSON.parse(saved).room.customPlan, references.images[file])).toEqual({ blockedOpenings: 0, missingWallPoints: 0, unexpectedSolidPoints: 0 });
    const draws = await drawCalls(page);
    await openImageImport(page);
    const beforeSize = await calibrateDrawing(page);
    await convertAndPreview(page);
    await expect.poll(() => drawCalls(page)).toBeGreaterThan(draws);
    await waitForSceneToSettle(page);
    await canvas.scrollIntoViewIfNeeded();
    expect(await canvas.screenshot()).not.toEqual(image);
    const calibrated = await page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')));
    expect(calibrated.room.customPlan.w).toBeCloseTo(beforeSize.w * 1.2, 6);
    expect(calibrated.room.customPlan.h).toBe(2.4);
    expect(calibrated.room.customPlan.wallThickness).toBeCloseTo(JSON.parse(saved).room.customPlan.wallThickness * 1.2, 6);
    await expect(page.getByLabel('模型の表示倍率')).toHaveCount(0);
    await testInfo.attach(`${file}-calibrated-3d`, { body: await canvas.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: /^ワンルーム/ }).click();
    await waitForSceneToSettle(page);
    await expect(page.locator('.width-tag')).toHaveText('5.4 m');
  });
}


test('追加の大きい図面を実WebGLで立体化し、実寸の下限を満たした壁を描画する', async ({ page }, testInfo) => {
  await openLayout(page);
  await waitForSceneToSettle(page);
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/holdout/riverside.png', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
  await calibrateDrawing(page);
  const before = await drawCalls(page);
  await convertAndPreview(page);
  await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(before);
  await waitForSceneToSettle(page);
  const canvas = page.getByRole('region', { name: '部屋の3Dプレビュー' });
  await canvas.scrollIntoViewIfNeeded();
  await testInfo.attach('riverside-product-3d', { body: await canvas.screenshot(), contentType: 'image/png' });
});

test('有彩色の壁を再解析した追加図面を実WebGLで立体化できる', async ({ page }, testInfo) => {
  await openLayout(page);
  await waitForSceneToSettle(page);
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/holdout/cottage.png', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
  await calibrateDrawing(page);
  const before = await drawCalls(page);
  await convertAndPreview(page);
  await expect(page.getByRole('heading', { name: '取込間取り / 3Dレイアウト' })).toBeVisible();
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(before);
  await waitForSceneToSettle(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')));
  expect(saved.room.customPlan.walls.length).toBeGreaterThan(10);
  const canvas = page.getByRole('region', { name: '部屋の3Dプレビュー' });
  await canvas.scrollIntoViewIfNeeded();
  await testInfo.attach('cottage-product-3d', { body: await canvas.screenshot(), contentType: 'image/png' });
});
