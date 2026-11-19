import { openLayout } from './fixtures/workspace.js';
import { test, expect } from './fixtures/test.js';

test('視点移動の矢印を十字に並べ、通常3Dだけで表示する', async ({ page }) => {
  await openLayout(page);
  const group = page.getByRole('group', { name: '視点の平行移動' });
  await expect(group).toBeVisible();
  await group.scrollIntoViewIfNeeded();
  const button = word => group.getByRole('button', { name: `視点を${word}へ移動`, exact: true });
  const boxes = await Promise.all(['前', '後ろ', '左', '右'].map(word => button(word).boundingBox()));
  const [front, back, left, right] = boxes.map(box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }));
  expect(front.x).toBe(back.x); expect(left.y).toBe(right.y);
  expect(front.y).toBeLessThan(left.y); expect(back.y).toBeGreaterThan(left.y);
  expect(left.x).toBeLessThan(front.x); expect(right.x).toBeGreaterThan(front.x);
  await expect(page.getByRole('region', { name: '部屋の3Dプレビュー' })).toBeInViewport();
  await page.getByRole('button', { name: '平面図', exact: true }).click();
  await expect(group).toHaveCount(0);
  await page.getByRole('button', { name: '一人称', exact: true }).click();
  await expect(group).toHaveCount(0);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(group).toBeVisible();
});
