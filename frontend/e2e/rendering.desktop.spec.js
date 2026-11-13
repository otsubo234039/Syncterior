import { openLayout } from './fixtures/workspace.js';
import { test, expect } from './fixtures/test.js';

test.use({ sceneMode: 'full' });

test('静止中は描画を止め、家具と視点の変更時に3D表示を更新する', async ({ page }) => {
  await openLayout(page, '/');
  await page.getByRole('button', { name: /^デスク/ }).click();
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const calls = () => page.evaluate(() => window.__e2eDrawCalls);
  await expect.poll(calls).toBeGreaterThan(0);
  const idle = () => expect.poll(() => page.evaluate(async () => {
    const before = window.__e2eDrawCalls;
    for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame);
    return before === window.__e2eDrawCalls;
  })).toBe(true);
  async function changesImage(action) {
    await idle();
    const before = await canvas.screenshot();
    const count = await calls();
    await action();
    await expect.poll(calls).toBeGreaterThan(count);
    const after = await canvas.screenshot();
    expect(before.equals(after), '操作後にキャンバスの画像が変化する').toBe(false);
  }
  await changesImage(() => page.getByLabel('左右位置 (X)').fill('1.4'));
  await changesImage(() => page.getByLabel('家具の色').fill('#123456'));
  await changesImage(() => page.getByRole('button', { name: '90° 回転' }).click());
  await changesImage(() => page.getByRole('button', { name: '選択を削除', exact: true }).click());
  await changesImage(async () => {
    const bounds = await canvas.boundingBox();
    const x = bounds.x + bounds.width * .9;
    const y = bounds.y + bounds.height * .15;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 60, y + 20, { steps: 8 });
    await page.mouse.up();
  });
  // OrbitControlsの慣性移動中は描画が続く。停止は各家具操作の前、視点は画像更新で検証する。
});
