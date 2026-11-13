import { openLayout } from './fixtures/workspace.js';
import { test, expect, waitForSceneToSettle } from './fixtures/test.js';

test('平面図のドラッグとキャンセル後の操作・3Dの正面と初期視点が動作する', async ({ page }) => {
  await openLayout(page, '/');
  await waitForSceneToSettle(page);
  const canvas = page.locator('canvas');
  const initial = await canvas.screenshot();
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await waitForSceneToSettle(page);
  expect(initial.equals(await canvas.screenshot())).toBe(false);
  await page.getByRole('button', { name: '初期視点', exact: true }).click();
  await waitForSceneToSettle(page);
  const reset = await canvas.screenshot({ path: test.info().outputPath('initial-view.png') });
  await page.getByRole('button', { name: '初期視点', exact: true }).click();
  await waitForSceneToSettle(page);
  const repeated = await canvas.screenshot();
  // 同一視点でもソフトウェアWebGLの丸めでRGBが1段階だけ変わる場合がある。
  // PNGのバイナリではなく全画素を比較し、輪郭・位置の変化は検出する。
  const maxChannelDelta = await page.evaluate(async ([before, after]) => {
    const pixels = async encoded => {
      const img = new Image(); img.src = `data:image/png;base64,${encoded}`; await img.decode();
      const surface = document.createElement('canvas'); surface.width = img.width; surface.height = img.height;
      const ctx = surface.getContext('2d'); ctx.drawImage(img, 0, 0);
      return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
    };
    const a = await pixels(before), b = await pixels(after);
    if (a.width !== b.width || a.height !== b.height) return Infinity;
    let maximum = 0;
    for (let i = 0; i < a.data.length; i++) maximum = Math.max(maximum, Math.abs(a.data[i] - b.data[i]));
    return maximum;
  }, [reset.toString('base64'), repeated.toString('base64')]);
  expect(maxChannelDelta, '初期視点への再リセットはRGB各成分の丸め誤差以内で同じ画像になる').toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '平面図', exact: true }).click();
  const bed = page.getByRole('button', { name: 'ダブルベッドを選択', exact: true });
  await bed.scrollIntoViewIfNeeded();
  await page.getByLabel('部屋の平面図').screenshot({ path: test.info().outputPath('plan-view.png') });
  const bounds = await bed.boundingBox();
  await bed.click();
  const before = await page.getByLabel('左右位置 (X)').inputValue();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + bounds.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByLabel('左右位置 (X)')).not.toHaveValue(before);
  const movedBounds = await bed.boundingBox();
  await page.mouse.move(movedBounds.x + movedBounds.width / 2, movedBounds.y + movedBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(movedBounds.x + movedBounds.width / 2 + 5, movedBounds.y + movedBounds.height / 2);
  await bed.dispatchEvent('pointercancel', { pointerId: 1 });
  const after = await page.getByLabel('左右位置 (X)').inputValue();
  await page.mouse.move(bounds.x, bounds.y);
  await page.mouse.up();
  await expect(page.getByLabel('左右位置 (X)')).toHaveValue(after);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await waitForSceneToSettle(page);
  await expect(page.getByRole('heading', { name: 'ダブルベッド', exact: true })).toBeVisible();
});
