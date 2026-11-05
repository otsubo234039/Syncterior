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

test('長方形家具を壁際で回転・数値移動しても各方向の境界に収まり中央へ戻らない', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^ダブルベッド/ }).click();
  const x = page.getByLabel('左右位置 (X)');
  const z = page.getByLabel('前後位置 (Z)');
  await x.fill('99');
  await z.fill('99');
  await expect(x).toHaveValue('2.0');
  await expect(z).toHaveValue('1.1');
  for (const [maxX, maxZ, sign] of [[1.7, 1.4, 1], [2, 1.1, 1], [1.7, 1.4, -1], [2, 1.1, -1]]) {
    await page.getByRole('button', { name: '90° 回転' }).click();
    await expect(x).not.toHaveValue('0.0');
    await expect(z).not.toHaveValue('0.0');
    await x.fill(String(sign * 99));
    await z.fill(String(sign * 99));
    await expect(x).toHaveValue((sign * maxX).toFixed(1));
    await expect(z).toHaveValue((sign * maxZ).toFixed(1));
  }
});
