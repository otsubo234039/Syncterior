import { test, expect } from './fixtures/test.js';

const viewportModule = /\/assets\/planner-viewport-[^/]+\.js(?:\?.*)?$/;
const loading = page => page.getByRole('status').filter({ hasText: '3Dを読み込み中…' });

test('3Dモジュールの取得中に読み込み表示を出し、平面図への切替後に古い表示を戻さない', async ({ page }) => {
  let release, requested;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { requested = resolve; });
  await page.route(viewportModule, async route => { requested(); await gate; await route.fallback(); });
  await page.goto('/');
  await expect(page.getByRole('region', { name: '図面の編集', exact: true })).toBeVisible();
  await expect(loading(page)).toHaveCount(0);
  await page.getByRole('button', { name: '3D・家具配置', exact: true }).click(); await started;
  try {
    await expect(loading(page)).toBeVisible();
    await expect(page.getByRole('button', { name: '寸法表示', exact: true })).toBeDisabled();
    await expect(page.getByRole('group', { name: '視点の平行移動' })).toHaveCount(0);
    await expect(page.locator('.viewport-loading-ring')).toHaveCSS('animation-name', 'viewport-loading-spin');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.viewport-loading-ring')).toHaveCSS('animation-name', 'none');
    await page.getByRole('region', { name: '部屋の3Dプレビュー' }).screenshot({ path: test.info().outputPath('module-loading.png') });
    await page.getByRole('button', { name: '平面図', exact: true }).click();
    await expect(loading(page)).toHaveCount(0);
  } finally { release(); }
  await expect(page.getByLabel('部屋の平面図')).toBeVisible();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(loading(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '寸法表示', exact: true })).toBeEnabled();
  await expect(page.getByRole('group', { name: '視点の平行移動' })).toBeVisible();
});

test('3Dモジュールを開けない場合は読み込みを終えて、平面図で編集を続けられる', async ({ page }) => {
  await page.route(viewportModule, route => route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("3D module unavailable"); export default function Viewport() { return null; }' }));
  await page.goto('/');
  await page.getByRole('button', { name: '3D・家具配置', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('3Dを表示できませんでした。');
  await expect(loading(page)).toHaveCount(0);
  await page.getByRole('button', { name: '平面図で続ける', exact: true }).click();
  await expect(page.getByLabel('部屋の平面図')).toBeVisible();
  await page.getByRole('button', { name: /^デスク/ }).click();
  await expect(page.getByRole('heading', { name: 'デスク', exact: true })).toBeVisible();
});
