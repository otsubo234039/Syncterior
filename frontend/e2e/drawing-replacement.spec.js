import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures/test.js';
import { editablePlan, savedPlan, editDrawing, importDrawingImage } from './fixtures/plan-edit.js';
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

test('新しい画像で前の図面・下絵を消し、解析途中に図面ファイルを開いても古い結果と履歴を残さない', async ({ page }) => {
  await seedOldLayout(page); await page.goto('/');
  const before = await savedPlan(page);
  await importDrawingImage(page);
  await expect(editDrawing(page).locator('image')).toBeVisible();
  await page.getByRole('button', { name: '壁1を選択', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '壁の終点', exact: true }).focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeEnabled();
  const dialogs = []; page.on('dialog', dialog => { dialogs.push(dialog.message()); void dialog.dismiss(); });
  let release;
  const intercepted = new Promise(resolve => { release = resolve; });
  await page.route(/opencv[^/]*\.js/, route => release(route));
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/colored.jpg', import.meta.url)));
  const blocked = await intercepted;
  await expect(editDrawing(page)).toHaveCount(0);
  await expect(page.getByRole('group', { name: '壁候補と計測区間の図', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '図面を書き出す', exact: true })).toBeDisabled();
  await page.getByLabel('図面ファイルを開く', { exact: true }).setInputFiles({ name: 'next.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 1, plan: { ...editablePlan, name: '解析途中に開く図面', walls: [] } })) });
  await page.unroute(/opencv[^/]*\.js/); await blocked.abort().catch(() => {});
  await expect(page.locator('.drawing-metadata-panel > summary')).toContainText('解析途中に開く図面');
  await expect(editDrawing(page).locator('image')).toHaveCount(0);
  await expect(editDrawing(page).getByRole('button', { name: '壁1を選択', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeDisabled();
  expect(dialogs).toEqual([]); expect(await savedPlan(page)).toEqual(before);
});

test('画像の読み込み中に後から選んだ図面ファイルを、古い画像の完了で取り消さない', async ({ page }) => {
  await page.addInitScript(() => {
    const bitmap = window.createImageBitmap.bind(window), text = File.prototype.text;
    window.createImageBitmap = async (...args) => {
      if (args[0]?.name === 'slow.png') await new Promise(resolve => { window.__releaseImageRead = resolve; });
      return bitmap(...args);
    };
    File.prototype.text = async function () {
      if (this.name === 'pending.json') await new Promise(resolve => { window.__releaseDrawingRead = resolve; });
      return text.call(this);
    };
  });
  await page.goto('/'); await openImageImport(page);
  const bytes = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles({ name: 'slow.png', mimeType: 'image/png', buffer: Buffer.from(bytes, 'base64') });
  await expect.poll(() => page.evaluate(() => typeof window.__releaseImageRead)).toBe('function');
  await page.getByLabel('図面ファイルを開く', { exact: true }).setInputFiles({ name: 'pending.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 1, plan: { ...editablePlan, name: '後から選んだ図面' } })) });
  await expect.poll(() => page.evaluate(() => typeof window.__releaseDrawingRead)).toBe('function');
  await page.evaluate(() => window.__releaseImageRead());
  await expect(page.getByRole('button', { name: '解析を中止', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.__releaseDrawingRead());
  await expect(page.locator('.drawing-metadata-panel > summary')).toContainText('後から選んだ図面');
  await expect(editDrawing(page).locator('image')).toHaveCount(0);
});

test('別の間取り画像を取り込んで保存・再読込しても以前の家具に妨げられず3Dを表示できる', async ({ page }) => {
  await seedOldLayout(page); await page.goto('/');
  const before = await savedPlan(page);
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/monochrome.jpg', import.meta.url)));
  await expect(page.getByRole('status').filter({ hasText: '解析できました。サイズを合わせてください。' })).toBeVisible();
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
  await page.locator('.drawing-metadata-panel').getByLabel('図面名', { exact: true }).fill('取り込んだ図面を修正');
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
