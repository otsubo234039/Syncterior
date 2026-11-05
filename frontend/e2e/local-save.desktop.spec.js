import { PerspectiveCamera, Vector3 } from 'three';
import { test, expect, waitForSceneToSettle } from './fixtures/test.js';

test.use({ sceneMode: 'full' });

test('再読み込みで復元した家具が実3Dに描画され、元の位置と色で再選択できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^デスク/ }).click();
  await page.getByLabel('左右位置 (X)').fill('0.7');
  await page.getByLabel('前後位置 (Z)').fill('0.5');
  await page.getByLabel('家具の色').fill('#123456');
  await page.getByRole('button', { name: '90° 回転' }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: '個人配置の保存' })).toContainText('復元しました');
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  await waitForSceneToSettle(page);
  const bounds = await canvas.boundingBox();
  const camera = new PerspectiveCamera(42, bounds.width / bounds.height, .1, 1000);
  camera.position.set(8, 7, 9);
  camera.lookAt(0, .5, 0);
  camera.updateMatrixWorld();
  const point = new Vector3(.7, .74, .5).project(camera);
  await page.mouse.click(bounds.x + (point.x + 1) * bounds.width / 2, bounds.y + (1 - point.y) * bounds.height / 2);
  await expect(page.getByRole('heading', { name: 'デスク', exact: true })).toBeVisible();
  await expect(page.getByLabel('左右位置 (X)')).toHaveValue('0.7');
  await expect(page.getByLabel('前後位置 (Z)')).toHaveValue('0.5');
  await expect(page.getByLabel('家具の色')).toHaveValue('#123456');
});
