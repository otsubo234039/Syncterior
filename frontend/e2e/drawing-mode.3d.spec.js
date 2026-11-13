import { test, expect, waitForSceneToSettle } from './fixtures/test.js';
import { editablePlan } from './fixtures/plan-edit.js';
import { fileURLToPath } from 'node:url';
import { openImageImport } from './fixtures/workspace.js';

test('保存した2D図面から同じ壁・床・高さの3Dを生成し、家具を配置できる', async ({ page }) => {
  await page.addInitScript(plan => localStorage.setItem('syncterior.drawing', JSON.stringify({ version: 1, plan })), editablePlan);
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await waitForSceneToSettle(page);
  const room = await page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')).room);
  expect(room.customPlan).toEqual(editablePlan); expect(room.items).toHaveLength(0);
  await page.getByRole('region', { name: '部屋の3Dプレビュー', exact: true }).screenshot({ path: test.info().outputPath('drawing-generated-3d.png') });
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(page.getByRole('heading', { name: 'デスク', exact: true })).toBeVisible();
  await waitForSceneToSettle(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')).room.items.length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.drawing')).plan)).toEqual(editablePlan);
});

test('別画像への取り替え時は前の家具の範囲に制限されず実際の3Dを生成できる', async ({ page }) => {
  await page.addInitScript(plan => {
    const old = { ...plan, w: 60, d: 60, floors: [{ id: 'floor', kind: 'room', points: [[0,0],[60,0],[60,60],[0,60]] }] };
    localStorage.setItem('syncterior.personal-room', JSON.stringify({ version: 2, room: { planKey: 'custom', customPlan: old,
      items: [{ id: 'old-desk', type: 'desk', name: 'デスク', w: 1.2, d: .6, h: .74, x: 20, z: 20, rot: 0, color: '#b88b62' }] } }));
  }, editablePlan);
  await page.goto('/');
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/monochrome.jpg', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
  await page.getByRole('button', { name: '図面へ変換', exact: true }).click();
  const width = await page.locator('.floor-edit-drawing').evaluate(svg => Number(svg.getAttribute('viewBox').split(/\s+/)[2]) / 1.04);
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await waitForSceneToSettle(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const room = await page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')).room);
  expect(room.items).toEqual([]); expect(room.customPlan.w).toBeCloseTo(width, 6);
  await page.getByRole('region', { name: '部屋の3Dプレビュー', exact: true }).screenshot({ path: test.info().outputPath('replacement-generated-3d.png') });
});
