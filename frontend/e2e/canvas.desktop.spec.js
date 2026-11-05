import { PerspectiveCamera, Vector3 } from 'three';
import { test, expect, waitForScene } from './fixtures/test.js';

test.use({ sceneMode: 'full' });

test('実際の3Dキャンバス上で家具をドラッグできる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^デスク/ }).click();
  await page.getByLabel('左右位置 (X)').fill('0.5');
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(() => canvas.evaluate(element => Boolean(element.getContext('webgl2')))).toBe(true);
  await waitForScene(page);
  const bounds = await canvas.boundingBox();
  const camera = new PerspectiveCamera(42, bounds.width / bounds.height, .1, 1000);
  camera.position.set(8, 7, 9);
  camera.lookAt(0, .5, 0);
  camera.updateMatrixWorld();
  const point = new Vector3(.5, .74, 0).project(camera);
  const x = bounds.x + (point.x + 1) * bounds.width / 2;
  const y = bounds.y + (1 - point.y) * bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 55, y - 15, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByLabel('左右位置 (X)')).not.toHaveValue('0.5');
  const value = Number(await page.getByLabel('左右位置 (X)').inputValue());
  expect(Number.isFinite(value)).toBe(true);
  expect(Math.abs(value)).toBeLessThanOrEqual(2.1);
});
