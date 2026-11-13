import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures/test.js';
import { editablePlan, savedPlan } from './fixtures/plan-edit.js';
import { openImageImport, openDrawingTools } from './fixtures/workspace.js';
import { calibrateDrawing } from './fixtures/floor-plan.js';

const oldPlan = { ...editablePlan, name: '以前の広い間取り', w: 60, d: 60,
  floors: [{ id: 'floor', kind: 'room', points: [[0,0],[60,0],[60,60],[0,60]] }] };
const desk = { id: 'old-desk', type: 'desk', name: 'デスク', w: 1.2, d: .6, h: .74, x: 20, z: 20, rot: 0, color: '#b88b62' };
async function seedOldLayout(page) {
  await page.addInitScript(({ plan, item }) => {
    if (!localStorage.getItem('syncterior.personal-room')) localStorage.setItem('syncterior.personal-room',
      JSON.stringify({ version: 2, room: { planKey: 'custom', customPlan: plan, items: [item] } }));
  }, { plan: oldPlan, item: desk });
}

test('別の間取り画像を取り込んで保存・再読込しても以前の家具に妨げられず3Dを表示できる', async ({ page }) => {
  await seedOldLayout(page); await page.goto('/');
  const before = await savedPlan(page);
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/monochrome.jpg', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
  await page.getByRole('button', { name: '図面へ変換', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '新しい図面から家具なしの3D' })).toBeVisible();
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  const converted = await page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.drawing')));
  expect(await savedPlan(page)).toEqual(before);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: '新しい図面から家具なしの3D' })).toBeVisible();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await expect(page.getByRole('region', { name: '部屋の3Dプレビュー', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const applied = await savedPlan(page);
  expect(applied.room.customPlan).toEqual(converted.plan); expect(applied.room.items).toEqual([]);
  expect(applied.drawingId).toBe(await page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.drawing')).drawingId));
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect.poll(async () => (await savedPlan(page)).room.items.length).toBe(1);
  const placed = (await savedPlan(page)).room.items;
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await page.locator('.drawing-metadata-panel > summary').click();
  await page.getByLabel('図面名', { exact: true }).fill('取り込んだ図面を修正');
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: '同じ図面の修正として3D' })).toBeVisible();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  expect((await savedPlan(page)).room.items).toEqual(placed);
});

test('同じ図面のサイズ補正では保存・再読込後も家具を消さず収まらない反映を拒否する', async ({ page }) => {
  await seedOldLayout(page); await page.goto('/'); const before = await savedPlan(page);
  await openImageImport(page);
  await calibrateDrawing(page, .5);
  await page.getByRole('button', { name: '図面へ変換', exact: true }).click();
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: '同じ図面の修正として3D' })).toBeVisible();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('家具が新しい床や壁に収まりません');
  expect(await savedPlan(page)).toEqual(before);
});

test('別の図面ファイルは家具なしで生成し、同じ図面ファイルを開き直すと家具を維持する', async ({ page }) => {
  await seedOldLayout(page); await page.goto('/');
  const plan = { ...editablePlan, name: '別の図面ファイル', walls: [] };
  await openDrawingTools(page);
  const input = page.getByLabel('図面ファイルを開く', { exact: true });
  await input.setInputFiles({ name: 'another.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, plan })) });
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  const document = await page.evaluate(() => localStorage.getItem('syncterior.drawing'));
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  expect((await savedPlan(page)).room.items).toEqual([]);
  await page.getByRole('button', { name: /^デスク/ }).click();
  const items = (await savedPlan(page)).room.items; expect(items).toHaveLength(1);
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await openDrawingTools(page);
  await input.setInputFiles({ name: 'same.json', mimeType: 'application/json', buffer: Buffer.from(document) });
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  expect((await savedPlan(page)).room.items).toEqual(items);
});
