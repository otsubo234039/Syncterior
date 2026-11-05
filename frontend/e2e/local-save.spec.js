import { test, expect } from './fixtures/test.js';

const KEY = 'syncterior.personal-room';
const count = page => page.locator('.room-metrics > div').filter({ hasText: 'FURNITURE' }).locator('strong');
const saving = page => page.getByRole('region', { name: '個人配置の保存' });
const saved = page => page.evaluate(key => localStorage.getItem(key), KEY);

test('個人編集を再読み込みと別タブで復元し、保存だけを消去して次の編集から再保存できる', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^1LDK/ }).click();
  await page.getByRole('button', { name: /^デスク/ }).click();
  await page.getByLabel('左右位置 (X)').fill('0.7');
  await page.getByLabel('前後位置 (Z)').fill('-0.5');
  await page.getByLabel('家具の色').fill('#123456');
  await page.getByRole('button', { name: '90° 回転' }).click();
  await expect(saving(page)).toContainText('保存しました');
  const raw = await saved(page);
  const data = JSON.parse(raw);
  expect(data.version).toBe(1);
  expect(Object.keys(data.room).sort()).toEqual(['items', 'planKey']);
  const desk = data.room.items.find(item => item.type === 'desk');
  expect(desk).toMatchObject({ x: .7, z: -.5, color: '#123456', rot: Math.PI / 2 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '1LDK / 3Dレイアウト' })).toBeVisible();
  await expect(count(page)).toContainText('5');
  await expect(saving(page)).toContainText('復元しました');
  await expect(page.getByRole('heading', { name: '家具を選択してください' })).toBeVisible();
  expect(await saved(page)).toBe(raw);
  const tab = await context.newPage();
  try {
    await tab.goto('/');
    await expect(tab.getByRole('heading', { name: '1LDK / 3Dレイアウト' })).toBeVisible();
    await expect(count(tab)).toContainText('5');
  } finally { await tab.close(); }
  await page.getByRole('button', { name: '保存した個人配置を消去', exact: true }).click();
  expect(await saved(page)).toBe(null);
  await expect(count(page)).toContainText('5');
  await expect(saving(page)).toContainText('消去しました');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ワンルーム / 3Dレイアウト' })).toBeVisible();
  await expect(count(page)).toContainText('4');
  expect(await saved(page)).toBe(null);
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(saving(page)).toContainText('保存しました');
  expect(JSON.parse(await saved(page)).room.items).toHaveLength(5);
});

test('破損した個人保存は案内して初期配置を表示し、編集すると有効な保存へ更新する', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(key => localStorage.setItem(key, '{broken'), KEY);
  await page.reload();
  await expect(saving(page)).toContainText('読み込めませんでした');
  await expect(count(page)).toContainText('4');
  expect(await saved(page)).toBe('{broken');
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(saving(page)).toContainText('保存しました');
  await page.reload();
  await expect(count(page)).toContainText('5');
  await expect(saving(page)).toContainText('復元しました');
});

test('保存領域の読み書き・消去が拒否されても編集を続けられ、回復後に保存を再試行する', async ({ page }) => {
  await page.addInitScript(key => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (name, ...args) {
        if (name === key && !window.__allowPersonalStorage) throw new DOMException('Storage blocked', 'SecurityError');
        return original.call(this, name, ...args);
      };
    }
  }, KEY);
  await page.goto('/');
  await expect(saving(page)).toContainText('読み込めませんでした');
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(count(page)).toContainText('5');
  await expect(saving(page)).toContainText('保存できませんでした');
  await page.getByRole('button', { name: '保存した個人配置を消去', exact: true }).click();
  await expect(saving(page)).toContainText('消去できませんでした');
  await expect(count(page)).toContainText('5');
  await page.evaluate(() => { window.__allowPersonalStorage = true; });
  await page.getByRole('button', { name: /^ダイニングチェア/ }).click();
  await expect(count(page)).toContainText('6');
  await expect(saving(page)).toContainText('保存しました');
  expect(JSON.parse(await saved(page)).room.items).toHaveLength(6);
});

test('共有リンクは個人配置を送信せず、共有の確定・未確定操作と退出でも個人保存を上書きしない', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^ファミリー/ }).click();
  await page.getByRole('button', { name: /^デスク/ }).click();
  const personal = await saved(page);
  const response = await request.post('/api/rooms', { data: { planKey: 'studio', items: [] } });
  expect(response.ok()).toBe(true);
  const shared = await response.json();
  const posts = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.goto(`/?room=${shared.id}`);
  await expect(page.locator('.sharing-summary')).toContainText('共同編集中');
  await expect(count(page)).toContainText('0');
  await expect(saving(page)).toHaveCount(0);
  expect(posts).toEqual([]);
  expect(await saved(page)).toBe(personal);
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(page.locator('.sharing-summary')).toContainText('変更は同期済み');
  await expect(count(page)).toContainText('1');
  expect(await saved(page)).toBe(personal);
  await page.route('**/api/rooms/*/operations', route => route.abort('failed'));
  await page.getByLabel('左右位置 (X)').fill('0.5');
  await expect(page.locator('.sharing-summary')).toContainText('再接続中');
  expect(await saved(page)).toBe(personal);
  await page.getByRole('button', { name: '未送信の変更を破棄して退出' }).click();
  await expect(page.locator('.sharing-summary')).toContainText('個人で編集中');
  await expect(count(page)).toContainText('1');
  expect(await saved(page)).toBe(personal);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ファミリー / 3Dレイアウト' })).toBeVisible();
  await expect(count(page)).toContainText('5');
  await expect(saving(page)).toContainText('復元しました');
});
