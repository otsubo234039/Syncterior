import { test, expect } from './fixtures/test.js';
import { openImageImport } from './fixtures/workspace.js';
import { measurementDrawing, pickMeasurementPoint } from './fixtures/floor-plan.js';

// DOM上のimageが残っていても、SVGのfocus枠が上から覆う不具合を実際の画素で検証する。
async function expectUnderlayVisible(page, testInfo, name) {
  const drawing = measurementDrawing(page);
  const positions = await drawing.evaluate(svg => {
    const box = svg.getBoundingClientRect(), matrix = svg.getScreenCTM();
    return [[.05,.5],[.5,.05],[.95,.5],[.5,.5]].map(([x,y]) => {
      const p = new DOMPoint(x * svg.viewBox.baseVal.width, y * svg.viewBox.baseVal.height).matrixTransform(matrix);
      return [p.x - box.left, p.y - box.top];
    });
  });
  const screenshot = await drawing.screenshot({ scale: 'css' });
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
  const samples = await page.evaluate(async ({ data, positions }) => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    return positions.map(([x,y]) => Array.from(context.getImageData(Math.round(x), Math.round(y), 1, 1).data).slice(0,3));
  }, { data: screenshot.toString('base64'), positions });
  for (const rgb of samples.slice(0,3)) expect(Math.min(...rgb), '壁の外側の白い下絵を黒いfocus枠が覆っていない').toBeGreaterThan(240);
  expect(Math.min(...samples[3]), '中央の色付き下絵が描画されている').toBeGreaterThan(80);
  expect(Math.min(...samples[3]), '中央の下絵が白く消えていない').toBeLessThan(240);
}

test('部屋のクリック・タップと補正後も下絵を表示し、キーボードで部屋と頂点の選択が分かる', async ({ page, isMobile }, testInfo) => {
  await page.goto('/'); await openImageImport(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 400;
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 400, 400);
    context.strokeStyle = '#222'; context.lineWidth = 8; context.strokeRect(40, 40, 320, 320);
    context.fillStyle = '#baddea'; context.fillRect(150, 150, 100, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles({ name: 'room-rendering.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByRole('status').filter({ hasText: /OpenCV .*壁候補を\d+本抽出/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'サイズ合わせの方法', exact: true }).selectOption('tatami');
  const drawing = measurementDrawing(page);
  const originalImage = await drawing.locator('image').getAttribute('href');
  await drawing.scrollIntoViewIfNeeded();
  if (isMobile) {
    const point = await drawing.evaluate(svg => {
      const p = new DOMPoint(svg.viewBox.baseVal.width / 2, svg.viewBox.baseVal.height / 2).matrixTransform(svg.getScreenCTM());
      return { x: p.x, y: p.y };
    });
    await page.touchscreen.tap(point.x, point.y);
  } else await pickMeasurementPoint(page, [.5, .5]);
  await expect(page.getByRole('button', { name: '輪郭の頂点1', exact: true })).toBeVisible();
  await expectUnderlayVisible(page, testInfo, '部屋のポインター選択直後');
  await expect(drawing.locator('image')).toHaveAttribute('href', originalImage);
  const candidate = drawing.locator('.floor-room-candidate:focus');
  await expect(candidate).toHaveCount(1);
  const candidateLabel = await candidate.getAttribute('aria-label');
  const handle = page.getByRole('button', { name: '輪郭の頂点1', exact: true });
  await handle.scrollIntoViewIfNeeded();
  const nearHandle = await handle.evaluate((node, mobile) => {
    const p = new DOMPoint(0, 0).matrixTransform(node.getScreenCTM());
    const x = p.x + (mobile ? 16 : 9), y = p.y + (mobile ? 10 : 6);
    return { x, y, px: p.x, py: p.y, hit: document.elementFromPoint(x, y)?.closest('.floor-measure-point') === node,
      radius: node.querySelector('circle').getAttribute('r'), scale: node.getScreenCTM().a, coarse: matchMedia('(pointer: coarse)').matches,
      distantHit: document.elementFromPoint(p.x + (mobile ? 28 : 20), p.y)?.closest('.floor-measure-point') === node };
  }, isMobile);
  expect(nearHandle.hit, '点から少し離れていても頂点をつかめる').toBe(true);
  expect(nearHandle.distantHit, `点から明らかに離れた場所では頂点をつかまない: ${JSON.stringify(nearHandle)}`).toBe(false);
  if (isMobile) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: nearHandle.x, y: nearHandle.y }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: nearHandle.x + 20, y: nearHandle.y + 10 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await session.detach(); }
  } else {
    await page.mouse.move(nearHandle.x, nearHandle.y); await page.mouse.down();
    await page.mouse.move(nearHandle.x + 20, nearHandle.y + 10); await page.mouse.up();
  }
  const moved = await handle.evaluate(node => {
    const p = new DOMPoint(0, 0).matrixTransform(node.getScreenCTM()); return { x: p.x, y: p.y };
  });
  expect(moved.x - nearHandle.px, 'つかんだ位置のずれを保って移動する').toBeCloseTo(20, 0);
  expect(moved.y - nearHandle.py).toBeCloseTo(10, 0);
  await page.getByRole('button', { name: candidateLabel, exact: true }).focus();
  // キーボード入力でfocus-visibleになっても、輪郭線だけで選択を示す。
  await page.keyboard.press('Enter');
  await expect(candidate).toHaveCSS('stroke-width', '3px');
  await expect(candidate).toHaveCSS('vector-effect', 'non-scaling-stroke');
  await expectUnderlayVisible(page, testInfo, '部屋のキーボード選択直後');
  const vertex = page.getByRole('button', { name: '輪郭の頂点1', exact: true });
  await vertex.focus(); await page.keyboard.press('ArrowRight');
  await expect(vertex.locator('circle').last()).toHaveCSS('stroke', 'rgb(52, 94, 78)');
  await expect(vertex.locator('circle').last()).toHaveCSS('vector-effect', 'non-scaling-stroke');
  await expectUnderlayVisible(page, testInfo, '頂点のキーボード調整直後');
  await page.getByLabel('選択した部屋の帖数', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'この帖数で全体を補正', exact: true }).click();
  await expectUnderlayVisible(page, testInfo, '部屋のサイズ補正直後');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
