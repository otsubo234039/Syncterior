import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures/test.js';
import { openLayout } from './fixtures/workspace.js';

const bytes = readFileSync(new URL('./fixtures/floor-plans/colored.jpg', import.meta.url));
const photo = (name = '正面.jpg') => ({ name, mimeType: 'image/jpeg', buffer: bytes });
const saved = page => page.evaluate(() => localStorage.getItem('syncterior.personal-room'));
const panel = page => page.locator('.furniture-generator');
async function openGenerator(page) {
  await openLayout(page);
  await panel(page).locator('summary').click();
  return panel(page);
}
test('写真と家具名だけで作成を開始でき、接続失敗を表示しても入力と配置を失わない', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (request.method() === 'POST') requests.push(request.url()); });
  const form = await openGenerator(page), before = await saved(page);
  await expect(form.getByRole('button', { name: '画像からモデルを作成', exact: true })).toBeDisabled();
  await page.getByLabel('家具の写真（最大4枚）').setInputFiles(photo());
  await expect(page.getByRole('img', { name: '家具の参考画像1', exact: true })).toBeVisible();
  await expect(page.getByLabel('作成する家具の名前', { exact: true })).toHaveValue('正面');
  await page.getByLabel('作成する家具の名前', { exact: true }).fill('リビングの机');
  await expect(form.getByRole('spinbutton')).toHaveCount(0);
  await expect(form.getByText(/準備中|試作|サンプル|未接続/)).toHaveCount(0);
  await expect(form.getByRole('button', { name: '画像からモデルを作成', exact: true })).toBeEnabled();
  await expect(page.locator('.furniture-importer summary')).toHaveText('家具モデルを取り込む');
  await expect(page.locator('.furniture-importer').getByText(/サンプル/)).toHaveCount(0);
  await form.screenshot({ path: test.info().outputPath('画像から家具の作成.png') });
  await form.getByRole('button', { name: '画像からモデルを作成', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveText('モデルを作成できませんでした。もう一度お試しください。');
  await expect(page.getByLabel('作成する家具の名前', { exact: true })).toHaveValue('リビングの机');
  await expect(form.getByRole('img')).toHaveCount(1);
  await expect(form.getByRole('button', { name: '画像からモデルを作成', exact: true })).toBeEnabled();
  expect(await saved(page)).toBe(before);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await page.getByRole('button', { name: '3D・家具配置', exact: true }).click();
  await panel(page).locator('summary').click();
  await expect(panel(page).getByRole('img')).toHaveCount(0);
  await expect(page.getByLabel('作成する家具の名前', { exact: true })).toHaveValue('');
});

test('画像を4枚まで追加・削除でき、不正画像と枚数超過で既存の入力を失わない', async ({ page }) => {
  const form = await openGenerator(page);
  await page.getByLabel('家具の写真（最大4枚）').setInputFiles(photo());
  await expect(form.getByRole('img')).toHaveCount(1);
  await page.getByLabel('家具の写真（最大4枚）').setInputFiles([photo('側面.jpg'), photo('背面.jpg'), photo('反対側.jpg'), photo('余分.jpg')]);
  await expect(form.getByRole('alert')).toContainText('1〜4枚');
  await expect(form.getByRole('img')).toHaveCount(1);
  await page.getByLabel('家具の写真（最大4枚）').setInputFiles({ name: '壊れた.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
  await expect(form.getByRole('alert')).toContainText('画像を読み込めません');
  await expect(form.getByRole('img')).toHaveCount(1);
  await page.getByLabel('家具の写真（最大4枚）').setInputFiles([photo('側面.jpg'), photo('背面.jpg'), photo('反対側.jpg')]);
  await expect(form.getByRole('img')).toHaveCount(4);
  await expect(page.getByLabel('家具の写真（最大4枚）')).toBeDisabled();
  await page.getByRole('button', { name: '参考画像1を削除', exact: true }).click();
  await expect(form.getByRole('img')).toHaveCount(3);
  await expect(page.getByLabel('家具の写真（最大4枚）')).toBeEnabled();
  await page.getByRole('button', { name: '画像と入力をクリア' }).click();
  await expect(form.getByRole('img')).toHaveCount(0);
  await expect(page.getByLabel('作成する家具の名前', { exact: true })).toHaveValue('');
});

test('写真の差し替え後は遅い画像の結果を無視し、取消・モード切替で表示URLを解放する', async ({ page }) => {
  await page.addInitScript(() => {
    const decode = window.createImageBitmap.bind(window);
    window.createImageBitmap = async (...args) => {
      const result = await decode(...args);
      if (args[0].name === '遅い写真.jpg') await new Promise(resolve => { window.finishPhotoRead = resolve; });
      return result;
    };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    window.photoUrls = []; window.revokedPhotoUrls = [];
    URL.createObjectURL = blob => { const url = create(blob); if (blob.type.startsWith('image/')) window.photoUrls.push(url); return url; };
    URL.revokeObjectURL = url => { window.revokedPhotoUrls.push(url); return revoke(url); };
  });
  const form = await openGenerator(page);
  await page.getByLabel('家具の写真（最大4枚）').setInputFiles(photo('遅い写真.jpg'));
  await expect.poll(() => page.evaluate(() => typeof window.finishPhotoRead)).toBe('function');
  await form.getByRole('button', { name: '処理を中止', exact: true }).click();
  await page.getByLabel('家具の写真（最大4枚）').setInputFiles(photo('新しい写真.jpg'));
  await expect(page.getByLabel('作成する家具の名前', { exact: true })).toHaveValue('新しい写真');
  await page.evaluate(() => window.finishPhotoRead());
  await expect(form.getByRole('img')).toHaveCount(1);
  await expect(page.getByLabel('作成する家具の名前', { exact: true })).toHaveValue('新しい写真');
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.photoUrls.every(url => window.revokedPhotoUrls.includes(url)))).toBe(true);
});
