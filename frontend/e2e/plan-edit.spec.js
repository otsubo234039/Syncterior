import { enterLayout, openDrawingTools } from './fixtures/workspace.js';
import { test, expect } from './fixtures/test.js';
import { seedEditablePlan, savedPlan, editDrawing, pickEditPoint, attachUnderlay } from './fixtures/plan-edit.js';

test('下絵を固定表示して壁を調整し、図面保存と3D配置への反映を分ける', async ({ page }) => {
  await seedEditablePlan(page); await page.goto('/');
  const before = await savedPlan(page);
  await attachUnderlay(page);
  const image = editDrawing(page).locator('image');
  await expect(image).toHaveAttribute('opacity', '0.6');
  await page.getByLabel('下絵の濃さ', { exact: true }).fill('0.3');
  await expect(image).toHaveAttribute('opacity', '0.3');
  await page.getByLabel('下絵を表示', { exact: true }).uncheck();
  await expect(image).toHaveCount(0);
  await page.getByLabel('下絵を表示', { exact: true }).check();
  await page.getByRole('button', { name: '壁1を選択', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '壁の終点', exact: true }).focus(); await page.keyboard.press('Shift+ArrowDown');
  await expect(page.getByRole('button', { name: '壁の終点', exact: true })).toHaveAttribute('transform', 'translate(7 1.1)');
  expect(await savedPlan(page)).toEqual(before);
  await page.locator('.drawing-editor').screenshot({ path: test.info().outputPath('underlay-editor.png') });
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  expect(await savedPlan(page)).toEqual(before);
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await expect.poll(async () => (await savedPlan(page)).room.customPlan.walls[0].end).toEqual([7,1.1]);
  expect((await savedPlan(page)).room.customPlan.walls[0].thicknessRatio).toBe(2);
  expect(JSON.stringify(await savedPlan(page))).not.toContain('data:image');
  await page.reload();
  expect((await savedPlan(page)).room.customPlan.walls[0].end).toEqual([7,1.1]);
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await expect(editDrawing(page).locator('image')).toHaveCount(0);
});

test('壁と開口を2点で追加し、取消・元に戻す・やり直すを利用できる', async ({ page }) => {
  await seedEditablePlan(page); await page.goto('/'); const before = await savedPlan(page);
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '壁を追加', exact: true }).click();
  await pickEditPoint(page, [2,3]); await pickEditPoint(page, [6,3]);
  await page.getByRole('button', { name: '扉を追加', exact: true }).click();
  await pickEditPoint(page, [3,3]); await pickEditPoint(page, [4,3]);
  await page.getByRole('button', { name: '選択・頂点を動かす', exact: true }).click();
  await expect(page.getByRole('button', { name: '扉1を選択', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '手直しを元に戻す', exact: true }).click();
  await expect(page.getByRole('button', { name: '扉1を選択', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '手直しをやり直す', exact: true }).click();
  await expect(page.getByRole('button', { name: '扉1を選択', exact: true })).toBeVisible();
  expect(await savedPlan(page)).toEqual(before);
  page.once('dialog', dialog => dialog.accept());
  await openDrawingTools(page);
  await page.getByRole('button', { name: '保存した図面を開く', exact: true }).click();
  await expect(page.getByRole('button', { name: '壁2を選択', exact: true })).toHaveCount(0);
});

test('床の頂点を編集し、不正な形状を拒否してから有効な形状を適用できる', async ({ page }) => {
  await seedEditablePlan(page); await page.goto('/');
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await page.getByRole('button', { name: '床1を選択', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '床の頂点1', exact: true }).focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('alert')).toContainText('適用できません');
  await expect(page.getByRole('button', { name: '床の頂点1', exact: true })).toHaveAttribute('transform', 'translate(0 0)');
  await page.keyboard.press('Shift+ArrowRight');
  await page.getByRole('button', { name: '辺1に頂点を追加', exact: true }).click();
  await expect(page.getByRole('button', { name: '床の頂点5', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await expect.poll(async () => (await savedPlan(page)).room.customPlan.floors[0].points.length).toBe(5);
  expect((await savedPlan(page)).room.customPlan.floors[0].points[0]).toEqual([.1,0]);
});

test('家具に重なる壁を適用せず家具と保存内容を維持する', async ({ page }) => {
  await seedEditablePlan(page, [{ id: 'desk', type: 'desk', name: 'デスク', w: 1.2, d: .6, h: .74, x: -2, z: 0, rot: 0, color: '#b88b62' }]);
  await page.goto('/'); const before = await savedPlan(page);
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await page.getByRole('button', { name: '壁を追加', exact: true }).click();
  await pickEditPoint(page, [2,2]); await pickEditPoint(page, [2,4]);
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('家具が新しい床や壁に収まりません');
  expect(await savedPlan(page)).toEqual(before);
});

test('手直しの下絵で縦横比の違う画像と破損画像を拒否して配置を保持する', async ({ page }) => {
  await seedEditablePlan(page); await page.goto('/'); const before = await savedPlan(page);
  await page.getByLabel('手直し用の下絵', { exact: true }).setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toContainText('画像を読み込めません');
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 64; return c.toDataURL('image/png').split(',')[1]; });
  await page.getByLabel('手直し用の下絵', { exact: true }).setInputFiles({ name: 'square.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByRole('alert')).toContainText('縦横比が異なります');
  expect(await savedPlan(page)).toEqual(before);
});

test('窓の開口を追加・端点編集・削除・復元し、位置と高さを保存できる', async ({ page }) => {
  await seedEditablePlan(page); await page.goto('/');
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await page.getByRole('button', { name: '窓を追加', exact: true }).click();
  await pickEditPoint(page, [2,1]); await pickEditPoint(page, [3,1]);
  await page.getByRole('button', { name: '選択・頂点を動かす', exact: true }).click();
  await page.getByRole('button', { name: '窓1を選択', exact: true }).click();
  await page.getByRole('button', { name: '開口の始点', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: '選択した開口を削除', exact: true }).click();
  await expect(page.getByRole('button', { name: '窓1を選択', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '手直しを元に戻す', exact: true }).click();
  await expect(page.getByRole('button', { name: '窓1を選択', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await expect.poll(async () => (await savedPlan(page)).room.customPlan.walls[0].openings.length).toBe(1);
  const opening = (await savedPlan(page)).room.customPlan.walls[0].openings[0];
  expect(opening.kind).toBe('window'); expect(opening.bottom).toBe(1); expect(opening.height).toBe(1);
  expect(opening.width).toBeCloseTo(.99, 1);
});

test('グリッドを目安に壁の線を追加・削除し、元に戻してから保存できる', async ({ page }) => {
  await seedEditablePlan(page); await page.goto('/'); const before = await savedPlan(page);
  await enterLayout(page);
  await page.getByRole('button', { name: '平面図', exact: true }).click();
  await expect(page.getByRole('img', { name: 'グリッド：1目盛0.25m、太線1m', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  const dialog = page.locator('.drawing-editor');
  const grid = dialog.getByRole('img', { name: 'グリッド：1目盛0.25m、太線1m', exact: true });
  await expect(grid).toBeVisible();
  await dialog.getByLabel('グリッドを表示', { exact: true }).uncheck();
  await expect(grid).toHaveCount(0);
  await dialog.getByLabel('グリッドを表示', { exact: true }).check();
  await expect(grid).toBeVisible();
  await expect(dialog.getByRole('button', { name: '手直しを元に戻す', exact: true })).toBeDisabled();
  expect(await savedPlan(page)).toEqual(before);
  await dialog.getByRole('button', { name: '線を消す', exact: true }).click();
  await dialog.getByRole('button', { name: '壁1を選択', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '壁1を選択', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '手直しを元に戻す', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '壁1を選択', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '壁を追加', exact: true }).click();
  await pickEditPoint(page, [2,3]); await pickEditPoint(page, [6,3]);
  await expect(dialog.getByRole('button', { name: '壁2を選択', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '線を消す', exact: true }).click();
  await dialog.getByRole('button', { name: '壁2を選択', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(dialog.getByRole('button', { name: '壁2を選択', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '壁1を選択', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '手直しを元に戻す', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '壁2を選択', exact: true })).toBeVisible();
  expect(await savedPlan(page)).toEqual(before);
  await dialog.screenshot({ path: test.info().outputPath('grid-editor.png') });
  await dialog.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await expect.poll(async () => (await savedPlan(page)).room.customPlan.walls.length).toBe(2);
  expect(JSON.stringify(await savedPlan(page))).not.toContain('showGrid');
  await page.getByRole('button', { name: '3D', exact: true }).click();
});
