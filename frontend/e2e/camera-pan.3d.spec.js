import { PerspectiveCamera, Vector3 } from 'three';
import { openLayout } from './fixtures/workspace.js';
import { test, expect, maxImageChannelDelta, waitForSceneToSettle } from './fixtures/test.js';

const saved = page => page.evaluate(() => localStorage.getItem('syncterior.personal-room'));

for (const [name, width] of [['デスクトップ', 1440], ['モバイル幅', 390]]) {
  test.describe(name, () => {
    test.use({ hasTouch: width === 390 });
    test(`${name}で十字ボタンのクリック・長押し・中断と初期視点への復帰を実3Dで確認する`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 }); await openLayout(page);
      await page.getByRole('button', { name: /^デスク/ }).click();
      const beforeSave = await saved(page), canvas = page.locator('canvas');
      await canvas.scrollIntoViewIfNeeded(); await waitForSceneToSettle(page);
      const initial = await canvas.screenshot();
      await page.getByRole('region', { name: '部屋の3Dプレビュー' }).screenshot({ path: test.info().outputPath('camera-pan-controls.png') });
      for (const word of ['前', '後ろ', '左', '右']) {
        const before = await canvas.screenshot();
        const arrow = page.getByRole('button', { name: `視点を${word}へ移動`, exact: true });
        if (width === 390) await arrow.tap(); else await arrow.click();
        await waitForSceneToSettle(page);
        expect(before.equals(await canvas.screenshot()), `${word}の矢印で視点が移動する`).toBe(false);
      }
      const right = page.getByRole('button', { name: '視点を右へ移動', exact: true });
      await right.focus(); await page.keyboard.press('Enter'); await waitForSceneToSettle(page);
      const box = await right.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      try {
        const first = await canvas.screenshot();
        await expect.poll(async () => first.equals(await canvas.screenshot())).toBe(false);
        await page.mouse.move(box.x - 10, box.y - 10);
      } finally { await page.mouse.up(); }
      await waitForSceneToSettle(page);
      // pointercancelとフォーカス喪失でも、押しっぱなしにしない。
      for (const event of ['pointercancel', 'lostpointercapture', 'blur', 'visibilitychange']) {
        await right.hover(); await page.mouse.down();
        if (event === 'pointercancel' || event === 'lostpointercapture') await right.dispatchEvent(event, { pointerId: 1 });
        else await page.evaluate(type => (type === 'blur' ? window : document).dispatchEvent(new Event(type)), event);
        await waitForSceneToSettle(page); await page.mouse.up();
      }
      await expect(page.getByRole('heading', { name: 'デスク', exact: true })).toBeVisible();
      expect(await saved(page)).toBe(beforeSave);
      await page.getByRole('button', { name: '初期視点', exact: true }).click(); await waitForSceneToSettle(page);
      // ソフトウェアWebGLの画素丸めに依存せず、移動先から確実に戻ることを確認する。
      const reset = await canvas.screenshot();
      await page.getByRole('button', { name: '視点を左へ移動', exact: true }).click(); await waitForSceneToSettle(page);
      expect(reset.equals(await canvas.screenshot())).toBe(false);
      expect(await maxImageChannelDelta(page, initial, reset)).toBeLessThanOrEqual(1);
      await right.hover(); await page.mouse.down();
      // フォーカス移動によるblurに頼らず、押している最中のアンマウントを確認する。
      await page.getByRole('button', { name: '平面図', exact: true }).evaluate(button => button.click());
      await expect(canvas).toHaveCount(0); await page.mouse.up();
      await page.getByRole('button', { name: '3D', exact: true }).click(); await waitForSceneToSettle(page);
    });
  });
}

test('家具上のホイール押し込みで平行移動し、キャンセル・画面離脱で停止して回転とズームも維持する', async ({ page }) => {
  await openLayout(page); await page.getByRole('button', { name: /^デスク/ }).click();
  await page.getByLabel('左右位置 (X)').fill('0.5');
  const beforeSave = await saved(page), canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded(); await waitForSceneToSettle(page);
  const box = await canvas.boundingBox(), camera = new PerspectiveCamera(42, box.width / box.height, .1, 1000);
  camera.position.set(8, 7, 9); camera.lookAt(0, .5, 0); camera.updateMatrixWorld();
  const point = new Vector3(.5, .74, 0).project(camera);
  const x = box.x + (point.x + 1) * box.width / 2, y = box.y + (1 - point.y) * box.height / 2;
  const initial = await canvas.screenshot();
  await page.mouse.move(x, y); await page.mouse.down({ button: 'middle' });
  await page.mouse.move(x + 45, y + 30, { steps: 4 }); await page.mouse.up({ button: 'middle' });
  await waitForSceneToSettle(page);
  expect(initial.equals(await canvas.screenshot())).toBe(false);
  await expect(page.getByRole('heading', { name: 'デスク', exact: true })).toBeVisible();
  expect(await saved(page)).toBe(beforeSave);
  let moveCount = 0;
  for (const type of ['pointercancel', 'lostpointercapture', 'blur', 'visibilitychange']) {
    await page.mouse.down({ button: 'middle' });
    if (type === 'pointercancel' || type === 'lostpointercapture') await canvas.dispatchEvent(type, { pointerId: 1, bubbles: true });
    else await page.evaluate(type => (type === 'blur' ? window : document).dispatchEvent(new Event(type)), type);
    await waitForSceneToSettle(page);
    const stopped = await canvas.screenshot();
    moveCount++; await page.mouse.move(x + moveCount * 15, y + moveCount * 15); await page.mouse.up({ button: 'middle' });
    await waitForSceneToSettle(page);
    expect(stopped.equals(await canvas.screenshot()), `${type}で移動が終わる`).toBe(true);
  }
  const changed = async action => {
    const before = await canvas.screenshot(); await action(); await waitForSceneToSettle(page);
    expect(before.equals(await canvas.screenshot())).toBe(false);
  };
  await changed(() => page.mouse.wheel(0, 160));
  await changed(async () => {
    await page.mouse.move(box.x + box.width * .85, box.y + box.height * .25); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .75, box.y + box.height * .3, { steps: 4 }); await page.mouse.up();
  });
  await page.mouse.down({ button: 'middle' });
  await page.getByRole('button', { name: '一人称', exact: true }).evaluate(button => button.click());
  await expect(canvas).toHaveAttribute('aria-label', '一人称視点の操作');
  await page.mouse.up({ button: 'middle' });
  await page.getByRole('button', { name: '3D', exact: true }).click(); await waitForSceneToSettle(page);
});
