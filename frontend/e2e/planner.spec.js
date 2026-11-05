import { test, expect } from './fixtures/test.js';

const furnitureCount = page => page.locator('.room-metrics > div').filter({ hasText: 'FURNITURE' }).locator('strong');

test('初期配置・間取り切り替え・寸法表示・モバイル幅のレイアウトを確認する', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ワンルーム / 3Dレイアウト' })).toBeVisible();
  await expect(furnitureCount(page)).toContainText('4');
  await expect(page.getByRole('region', { name: '部屋の3Dプレビュー' })).toBeVisible();
  await page.getByRole('button', { name: /^1LDK/ }).click();
  await expect(page.getByRole('heading', { name: '1LDK / 3Dレイアウト' })).toBeVisible();
  await expect(page.locator('.width-tag')).toHaveText('7.2 m');
  const dimensions = page.getByRole('button', { name: '寸法表示', exact: true });
  await dimensions.click();
  await expect(dimensions).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.dimension-tag')).toHaveCount(0);
  await dimensions.click();
  await expect(page.locator('.dimension-tag')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('家具を追加し、選択した家具の編集・回転・削除ができる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(furnitureCount(page)).toContainText('5');
  await expect(page.getByRole('heading', { name: 'デスク', exact: true })).toBeVisible();
  await page.getByLabel('左右位置 (X)').fill('0.5');
  await page.getByLabel('前後位置 (Z)').fill('-0.5');
  await expect(page.getByLabel('左右位置 (X)')).toHaveValue('0.5');
  await expect(page.getByLabel('前後位置 (Z)')).toHaveValue('-0.5');
  await page.getByLabel('家具の色').fill('#123456');
  await expect(page.getByLabel('家具の色')).toHaveValue('#123456');
  await page.getByRole('button', { name: '90° 回転' }).click();
  await page.getByRole('button', { name: '選択を削除', exact: true }).click();
  await expect(furnitureCount(page)).toContainText('4');
  await expect(page.getByRole('heading', { name: '家具を選択してください' })).toBeVisible();
  await expect(page.getByRole('button', { name: '選択を削除', exact: true })).toBeDisabled();
});

test('共有API未設定時に利用状況を案内し、Escapeキーでダイアログを閉じられる', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174');
  await page.getByRole('button', { name: '部屋を共有', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('共同編集は現在利用できません');
  await expect(dialog.getByRole('button', { name: '共有リンクを作成', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(furnitureCount(page)).toContainText('5');
});
