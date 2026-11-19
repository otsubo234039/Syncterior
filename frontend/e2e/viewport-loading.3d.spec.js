import { openLayout } from './fixtures/workspace.js';
import { test, expect, waitForSceneToSettle } from './fixtures/test.js';

const hdr = /\.hdr(?:\?|$)/;
const loading = page => page.getByRole('status').filter({ hasText: '3Dを読み込み中…' });

for (const [name, width] of [['デスクトップ', 1440], ['モバイル幅', 390]]) {
  test(`${name}で3Dの素材取得中も表示を続け、初回描画後に操作を有効にする`, async ({ page }) => {
    let release, requested;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { requested = resolve; });
    await page.route(hdr, async route => { requested(); await gate; await route.fallback(); });
    await page.setViewportSize({ width, height: 950 }); await openLayout(page); await started;
    try {
      await expect(loading(page)).toBeVisible();
      await expect(page.locator('.viewport-scene')).toHaveAttribute('aria-busy', 'true');
      await expect(page.getByRole('button', { name: '寸法表示', exact: true })).toBeDisabled();
      await page.getByRole('region', { name: '部屋の3Dプレビュー' }).screenshot({ path: test.info().outputPath('asset-loading.png') });
    } finally { release(); }
    await expect(loading(page)).toHaveCount(0); await waitForSceneToSettle(page);
    await expect(page.locator('.viewport-scene')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('button', { name: '寸法表示', exact: true })).toBeEnabled();
    await expect(page.getByRole('group', { name: '視点の平行移動' })).toBeVisible();
    await page.getByRole('button', { name: '視点を右へ移動', exact: true }).click();
    await waitForSceneToSettle(page);
  });
}

test('3D素材の取得中に図面へ戻っても、古い完了通知で3Dを再表示しない', async ({ page }) => {
  let release, requested;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { requested = resolve; });
  await page.route(hdr, async route => { requested(); await gate; await route.fallback(); });
  await openLayout(page); await started;
  try {
    await expect(loading(page)).toBeVisible();
    await page.getByRole('button', { name: '図面モード', exact: true }).click();
    await expect(page.getByRole('region', { name: '図面の編集', exact: true })).toBeVisible();
  } finally { release(); }
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(loading(page)).toHaveCount(0);
  await page.getByRole('button', { name: '3D・家具配置', exact: true }).click();
  await expect(loading(page)).toHaveCount(0); await waitForSceneToSettle(page);
});

test.describe('3D素材の取得失敗', () => {
  // このR3F版はcatch済みの描画エラーもreportErrorへ通知する。
  test.use({ expectedPageErrors: [/^Could not load lebombo_1k\.hdr: fetch for "https:\/\/raw\.githack\.com\/pmndrs\/drei-assets\/[^"\s]+" responded with 503: Service Unavailable$/] });
  test('3D素材の取得に失敗したら読み込みを終えて平面図へ戻れる', async ({ page }) => {
    await page.route(hdr, route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await openLayout(page);
    await expect(page.getByRole('alert')).toHaveText('3Dを表示できませんでした。');
    await expect(loading(page)).toHaveCount(0);
    await page.getByRole('button', { name: '平面図で続ける', exact: true }).click();
    await expect(page.getByLabel('部屋の平面図')).toBeVisible();
    await page.getByRole('button', { name: /^デスク/ }).click();
    await expect(page.getByRole('heading', { name: 'デスク', exact: true })).toBeVisible();
  });
});
