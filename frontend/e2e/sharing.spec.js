import { test, expect } from './fixtures/test.js';
import { verifySharedRoom } from './fixtures/shared-room-flow.js';

const count = page => page.locator('.room-metrics > div').filter({ hasText: 'FURNITURE' }).locator('strong');
async function share(page) {
  await page.getByRole('button', { name: '部屋を共有', exact: true }).click();
  await page.getByRole('button', { name: '共有リンクを作成', exact: true }).click();
  await expect(page.locator('.sharing-summary')).toContainText('共同編集中');
  return page.getByLabel('編集用リンク').inputValue();
}

test('共有リンクを作成・コピーし、確定済みの配置を保って退出できる', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: /^デスク/ }).click();
  const url = await share(page);
  expect(new URL(url).searchParams.get('room')).toMatch(/^[\w-]{32}$/);
  await page.getByRole('button', { name: 'コピー', exact: true }).click();
  await expect(page.getByRole('button', { name: 'コピー済み' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await page.getByRole('button', { name: '共同編集から退出', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.sharing-summary')).toContainText('個人で編集中');
  expect(new URL(page.url()).searchParams.has('room')).toBe(false);
  await expect(count(page)).toContainText('5');
});

test('クリップボードへのアクセスが拒否された場合に手動コピーを案内する', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => { throw new Error('permission denied'); } },
  }));
  await page.goto('/');
  const url = await share(page);
  await page.getByRole('button', { name: 'コピー', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('手動でコピー');
  await expect(page.getByLabel('編集用リンク')).toBeFocused();
  expect(await page.getByLabel('編集用リンク').evaluate(input => input.selectionEnd - input.selectionStart)).toBe(url.length);
});

test('2つのブラウザから同じ部屋に参加し、家具・間取り・参加人数が同期される', verifySharedRoom);

test('送信失敗時は編集を停止し、再接続後に未確定の操作を再送する', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^デスク/ }).click();
  await share(page);
  await page.getByRole('button', { name: '共有ダイアログを閉じる' }).click();
  const operations = '**/api/rooms/*/operations';
  await page.route(operations, route => route.abort('failed'));
  await page.getByLabel('家具の色').fill('#abcdef');
  await expect(page.locator('.sharing-summary')).toContainText('再接続中');
  await expect(page.getByRole('button', { name: /^デスク/ })).toBeDisabled();
  await expect(page.getByLabel('家具の色')).toBeDisabled();
  await page.unroute(operations);
  // The client reconnects automatically. Its button may disappear before a click.

  await expect(page.locator('.sharing-summary')).toContainText('変更は同期済み');
  await expect(page.getByLabel('家具の色')).toHaveValue('#abcdef');
  await expect(page.getByLabel('家具の色')).toBeEnabled();
});

test('存在しない部屋を案内し、初期配置を送信せずに個人編集へ戻れる', async ({ page }) => {
  await page.goto(`/?room=${'z'.repeat(32)}`);
  await expect(page.getByRole('heading', { name: '共有された部屋を開けませんでした' })).toBeVisible();
  await expect(page.getByRole('region', { name: '部屋の3Dプレビュー' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^デスク/ })).toBeDisabled();
  await page.getByRole('button', { name: '個人編集に戻る', exact: true }).click();
  await expect(page.locator('.sharing-summary')).toContainText('個人で編集中');
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(count(page)).toContainText('5');
});

test('リンクの作成失敗時も配置を保持し、再試行できる', async ({ page }) => {
  await page.route('**/api/rooms', route => route.fulfill({ status: 503, json: { error: '共有を開始できませんでした。' } }));
  await page.goto('/');
  await page.getByRole('button', { name: /^デスク/ }).click();
  await page.getByRole('button', { name: '部屋を共有', exact: true }).click();
  await page.getByRole('button', { name: '共有リンクを作成', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('共有を開始できませんでした');
  await expect(page.getByRole('button', { name: '共有リンクを作成', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '共有ダイアログを閉じる' }).click();
  await expect(count(page)).toContainText('5');
  expect(new URL(page.url()).searchParams.has('room')).toBe(false);
});
