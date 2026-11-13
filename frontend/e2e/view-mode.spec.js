import { openLayout } from './fixtures/workspace.js';
import { test, expect } from './fixtures/test.js';

test('平面図と視点プリセットを切り替えても家具の配置・選択・個人保存を変更しない', async ({ page }) => {
  await openLayout(page, '/');
  await page.getByRole('button', { name: /^デスク/ }).click();
  await page.getByLabel('左右位置 (X)').fill('0.5');
  const saved = await page.evaluate(() => localStorage.getItem('syncterior.personal-room'));
  await page.getByRole('button', { name: '平面図', exact: true }).click();
  await expect(page.getByLabel('部屋の平面図')).toBeVisible();
  await expect(page.getByRole('button', { name: 'デスクを選択', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('左右位置 (X)')).toHaveValue('0.5');
  await page.getByRole('button', { name: 'ダブルベッドを選択', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'ダブルベッド', exact: true })).toBeVisible();
  for (const name of ['3D', '平面図', '正面', '初期視点']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'ダブルベッド', exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => localStorage.getItem('syncterior.personal-room'))).toBe(saved);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('平面図で選択した家具を数値編集・回転・削除できる', async ({ page }) => {
  await openLayout(page, '/');
  await page.getByRole('button', { name: '平面図', exact: true }).click();
  await page.getByRole('button', { name: 'ダブルベッドを選択', exact: true }).click();
  await page.getByLabel('左右位置 (X)').fill('0.4');
  await page.getByRole('button', { name: '90° 回転' }).click();
  await expect(page.getByRole('button', { name: 'ダブルベッドを選択', exact: true })).toHaveAttribute('transform', /translate\(0.4 /);
  await page.getByRole('button', { name: '選択を削除', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ダブルベッドを選択', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '3D', exact: true }).click();
});

test('取込間取りの床・厚い壁・扉と窓を平面図に表示し配置を維持する', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('syncterior.personal-room', JSON.stringify({
    version: 2, room: { planKey: 'custom', items: [], customPlan: {
      version: 1, name: '取込図面', w: 5, d: 4, h: 2.5, wallThickness: .12,
      floors: [{ id: 'floor', kind: 'room', points: [[0,0],[5,0],[5,2],[3,2],[3,4],[0,4]] }],
      walls: [{ id: 'wall', start: [0,0], end: [5,0], thicknessRatio: 2, openings: [
        { id: 'door', kind: 'door', offset: 1, width: .9, bottom: 0, height: 2 },
        { id: 'window', kind: 'window', offset: 3, width: 1, bottom: 1, height: 1 },
      ] }],
    } },
  })));
  await openLayout(page, '/');
  await page.getByRole('button', { name: '平面図', exact: true }).click();
  const drawing = page.getByLabel('部屋の平面図');
  await expect(drawing.locator('polygon')).toHaveAttribute('points', '-2.5,-2 2.5,-2 2.5,0 0.5,0 0.5,2 -2.5,2');
  await expect(drawing.locator('path[stroke="#46554c"]').first()).toHaveAttribute('stroke-width', '0.24');
  await expect(drawing.locator('path[stroke="#fff"]')).toHaveCount(1);
  await expect(drawing.locator('path[stroke="#83aebe"]')).toHaveCount(1);
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(drawing.getByRole('button', { name: 'デスクを選択' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '3D', exact: true }).click();
});
