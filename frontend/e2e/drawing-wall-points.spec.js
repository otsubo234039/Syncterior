import { test, expect } from './fixtures/test.js';
import { seedEditablePlan, editablePlan, editDrawing } from './fixtures/plan-edit.js';

const endpoint = (page, side) => page.getByRole('button', { name: `壁の${side === 'start' ? '始点' : '終点'}`, exact: true });
const selectWall = page => page.getByRole('button', { name: '壁1を選択', exact: true }).click();
const readDrawing = page => page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.drawing')).plan);

async function screenPoint(page, point) {
  const svg = editDrawing(page);
  await svg.scrollIntoViewIfNeeded();
  return svg.evaluate((node, [x, y]) => {
    const p = new DOMPoint(x, y).matrixTransform(node.getScreenCTM());
    return { x: p.x, y: p.y };
  }, point);
}

async function startDrag(page, side, offset) {
  const from = await screenPoint(page, editablePlan.walls[0][side]);
  const to = await screenPoint(page, side === 'start' ? [2,2] : [6,2]);
  // 白い点の中心からずらして押し、実際のヒット領域からドラッグを開始する。
  await page.mouse.move(from.x + offset, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await expect.poll(async () => {
    const transform = await endpoint(page, side).getAttribute('transform');
    return Number(transform.slice(10, -1).split(' ')[1]);
  }).toBeCloseTo(2, 4);
}

for (const [label, side, offset] of [['白い点の内側', 'start', 2], ['白い点の周囲12px', 'end', 12]]) {
  test(`${label}から壁の${side === 'start' ? '始点' : '終点'}をドラッグし、履歴・保存・再読込を利用できる`, async ({ page }) => {
    await seedEditablePlan(page); await page.goto('/');
    const personal = await page.evaluate(() => localStorage.getItem('syncterior.personal-room'));
    await selectWall(page);
    await startDrag(page, side, offset);
    await page.mouse.up();
    await page.getByRole('button', { name: '図面を保存', exact: true }).click();
    const moved = await readDrawing(page);
    const expected = side === 'start' ? [2,2] : [6,2];
    moved.walls[0][side].forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 4));
    expect(moved.walls[0][side === 'start' ? 'end' : 'start']).toEqual(editablePlan.walls[0][side === 'start' ? 'end' : 'start']);
    expect(moved.walls[0].thicknessRatio).toBe(2);
    await page.getByRole('button', { name: '元に戻す', exact: true }).click();
    await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '図面を保存', exact: true }).click();
    expect(await readDrawing(page)).toEqual(editablePlan);
    await page.getByRole('button', { name: 'やり直す', exact: true }).click();
    await page.getByRole('button', { name: '図面を保存', exact: true }).click();
    expect(await readDrawing(page)).toEqual(moved);
    expect(await page.evaluate(() => localStorage.getItem('syncterior.personal-room'))).toBe(personal);
    await page.reload(); await selectWall(page);
    await expect(endpoint(page, side)).toHaveAttribute('transform', `translate(${moved.walls[0][side].join(' ')})`);
  });
}

for (const reason of ['Esc', 'pointercancel', 'lostpointercapture', 'blur']) {
  test(`壁の頂点を周囲からドラッグして${reason}で取り消すと形状と履歴を戻し、再び操作できる`, async ({ page }) => {
    await seedEditablePlan(page); await page.goto('/'); await selectWall(page);
    await startDrag(page, 'end', 12);
    if (reason === 'Esc') await page.keyboard.press('Escape');
    if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    if (reason === 'pointercancel') await endpoint(page, 'end').dispatchEvent('pointercancel');
    if (reason === 'lostpointercapture') await endpoint(page, 'end').evaluate(node => {
      if (node.hasPointerCapture(1)) node.releasePointerCapture(1);
    });
    await page.mouse.up();
    await expect(endpoint(page, 'end')).toHaveAttribute('transform', 'translate(7 1)');
    await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeDisabled();
    await startDrag(page, 'end', 12); await page.mouse.up();
    await page.getByRole('button', { name: '図面を保存', exact: true }).click();
    (await readDrawing(page)).walls[0].end.forEach((value, axis) => expect(value).toBeCloseTo([6,2][axis], 4));
  });
}
