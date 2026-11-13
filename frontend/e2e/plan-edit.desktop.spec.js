import { openLayout } from './fixtures/workspace.js';
import { test, expect, waitForSceneToSettle } from './fixtures/test.js';
import { seedEditablePlan, editDrawing } from './fixtures/plan-edit.js';

test('図面の端点ドラッグをキャンセルでき、適用した壁の変更が実3Dへ反映される', async ({ page }) => {
  await seedEditablePlan(page); await openLayout(page); await waitForSceneToSettle(page);
  const before = await page.locator('canvas').screenshot();
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await page.getByRole('button', { name: '壁1を選択', exact: true }).focus(); await page.keyboard.press('Enter');
  const endpoint = page.getByRole('button', { name: '壁の終点', exact: true });
  await endpoint.scrollIntoViewIfNeeded();
  const b = await endpoint.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 40, { steps: 4 });
  await expect(endpoint).not.toHaveAttribute('transform', 'translate(7 1)');
  await endpoint.dispatchEvent('pointercancel', { pointerId: 1 }); await page.mouse.up();
  await expect(endpoint).toHaveAttribute('transform', 'translate(7 1)');
  await endpoint.focus(); for (let i = 0; i < 10; i++) await page.keyboard.press('Shift+ArrowDown');
  await editDrawing(page).screenshot({ path: test.info().outputPath('edit-plan.png') });
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
  await waitForSceneToSettle(page);
  const after = await page.locator('canvas').screenshot();
  expect(before.equals(after)).toBe(false);
});
