import { test, expect } from './fixtures/test.js';
import { seedEditablePlan, editablePlan, editDrawing } from './fixtures/plan-edit.js';

const wall = page => page.getByRole('button', { name: '壁1を選択', exact: true });
const endpoint = (page, side) => page.getByRole('button', { name: `壁の${side === 'start' ? '始点' : '終点'}`, exact: true });
const undo = page => page.getByRole('button', { name: '元に戻す', exact: true });
const redo = page => page.getByRole('button', { name: 'やり直す', exact: true });
const save = page => page.getByRole('button', { name: '図面を保存', exact: true }).click();
const readDrawing = page => page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.drawing')).plan);

async function openPlan(page, plan = editablePlan) {
  await seedEditablePlan(page);
  await page.addInitScript(plan => {
    if (!localStorage.getItem('syncterior.drawing')) localStorage.setItem('syncterior.drawing', JSON.stringify({ version: 1, plan }));
  }, plan);
  await page.goto('/');
  await expect(wall(page)).toBeVisible();
}

async function screenPoint(page, point) {
  return editDrawing(page).evaluate((svg, [x, y]) => {
    const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }, point);
}

async function startDrag(page, from = [4,1], to = [4.5,2]) {
  await editDrawing(page).scrollIntoViewIfNeeded();
  const a = await screenPoint(page, from), b = await screenPoint(page, to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
}

async function expectEndpoints(page, start, end) {
  for (const [side, point] of [['start', start], ['end', end]]) {
    await expect.poll(async () => (await endpoint(page, side).getAttribute('transform'))
      .slice(10, -1).split(' ').map(value => Number(Number(value).toFixed(5)))).toEqual(point);
  }
}

test('未選択の壁を中心以外からドラッグし、開口ごと移動・一括Undo・Redo・保存・復元できる', async ({ page }) => {
  const plan = structuredClone(editablePlan);
  plan.walls[0].openings = [
    { id: 'door', kind: 'door', offset: .5, width: 1, bottom: 0, height: 2 },
    { id: 'window', kind: 'window', offset: 2, width: 1, bottom: 1, height: 1 },
  ];
  plan.walls.push({ id: 'other', start: [7,1], end: [7,5], openings: [] });
  await openPlan(page, plan);
  const personal = await page.evaluate(() => localStorage.getItem('syncterior.personal-room'));
  await startDrag(page, [4.5,1.1], [5.25,3.1]);
  await expectEndpoints(page, [1.75,3], [7.75,3]);
  await page.mouse.up();
  await expect.poll(async () => (await page.getByRole('button', { name: '扉1を選択', exact: true }).getAttribute('transform'))
    .match(/^translate\(([^)]+)\)/)[1].split(' ').map(value => Number(Number(value).toFixed(5)))).toEqual([2.25,3]);
  await save(page);
  const moved = await readDrawing(page);
  expect(moved.walls[0].openings).toEqual(plan.walls[0].openings);
  expect(moved.walls[0].thicknessRatio).toBe(2);
  expect(moved.walls[1]).toEqual(plan.walls[1]); expect(moved.floors).toEqual(plan.floors);
  await undo(page).click(); await expect(undo(page)).toBeDisabled();
  await save(page); expect(await readDrawing(page)).toEqual(plan);
  await redo(page).click(); await save(page); expect(await readDrawing(page)).toEqual(moved);
  expect(await page.evaluate(() => localStorage.getItem('syncterior.personal-room'))).toBe(personal);
  await page.reload(); await wall(page).focus(); await page.keyboard.press('Enter');
  await expectEndpoints(page, [1.75,3], [7.75,3]);
  // 白い点は線全体の移動後も端点だけを編集する。
  await endpoint(page, 'end').focus(); await page.keyboard.press('Shift+ArrowUp');
  await expectEndpoints(page, [1.75,3], [7.75,2.9]);
});

test('斜めの壁を図面の端までドラッグしても長さと向きが変わらず、境界から戻せる', async ({ page }) => {
  const plan = structuredClone(editablePlan);
  plan.walls[0].start = [2,2]; plan.walls[0].end = [5,4];
  await openPlan(page, plan);
  await startDrag(page, [3.5,3], [.5,5.5]);
  await expectEndpoints(page, [0,4], [3,6]);
  const b = await screenPoint(page, [8.1,3]);
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await expectEndpoints(page, [5,2], [8,4]);
  const c = await screenPoint(page, [4,3.5]);
  await page.mouse.move(c.x, c.y, { steps: 5 });
  await expectEndpoints(page, [2.5,2.5], [5.5,4.5]);
  await page.mouse.up(); await save(page);
  const moved = await readDrawing(page);
  expect(moved.walls[0].end[0] - moved.walls[0].start[0]).toBeCloseTo(3, 6);
  expect(moved.walls[0].end[1] - moved.walls[0].start[1]).toBeCloseTo(2, 6);
});

for (const reason of ['Esc', 'pointercancel', 'lostpointercapture', 'blur', '画面の非表示', '編集方法の切替', '図面モードの終了']) {
  test(`線のドラッグを${reason}で取り消すと形状と履歴を戻し、再び移動できる`, async ({ page }) => {
    await openPlan(page);
    await startDrag(page); await expectEndpoints(page, [1.5,2], [7.5,2]);
    if (reason === 'Esc') await page.keyboard.press('Escape');
    if (reason === 'pointercancel') await wall(page).dispatchEvent('pointercancel');
    if (reason === 'lostpointercapture') await wall(page).evaluate(node => node.releasePointerCapture(1));
    if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    if (reason === '画面の非表示') await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    if (reason === '編集方法の切替') {
      await page.getByRole('button', { name: '壁を追加', exact: true }).dispatchEvent('click');
      await page.getByRole('button', { name: '選択・線や頂点を動かす', exact: true }).dispatchEvent('click');
    }
    if (reason === '図面モードの終了') {
      await page.getByRole('button', { name: '3D・家具配置', exact: true }).dispatchEvent('click');
      await expect(editDrawing(page)).toHaveCount(0);
      await page.getByRole('button', { name: '図面モード', exact: true }).dispatchEvent('click');
    }
    await page.mouse.up(); await expect(undo(page)).toBeDisabled();
    await save(page); expect(await readDrawing(page)).toEqual(editablePlan);
    await startDrag(page); await page.mouse.up();
    await expectEndpoints(page, [1.5,2], [7.5,2]);
  });
}

test('壁のクリックや移動して開始位置へ戻す操作ではUndo履歴を追加せず、Redoも残す', async ({ page }) => {
  await openPlan(page);
  await startDrag(page); await page.mouse.up(); await undo(page).click();
  await expect(redo(page)).toBeEnabled();
  await wall(page).click(); await expect(undo(page)).toBeDisabled();
  await editDrawing(page).scrollIntoViewIfNeeded();
  const click = await screenPoint(page, [4,1]);
  await page.mouse.move(click.x, click.y); await page.mouse.down();
  await page.mouse.move(click.x + 1, click.y + 1); await page.mouse.up();
  await expect(undo(page)).toBeDisabled(); await expect(redo(page)).toBeEnabled();
  await startDrag(page); await expectEndpoints(page, [1.5,2], [7.5,2]);
  const origin = await screenPoint(page, [4,1]);
  await page.mouse.move(origin.x, origin.y, { steps: 5 }); await page.mouse.up();
  await expectEndpoints(page, [1,1], [7,1]);
  await expect(undo(page)).toBeDisabled(); await expect(redo(page)).toBeEnabled();
  await redo(page).click(); await save(page);
  const moved = await readDrawing(page);
  expect(moved.walls[0].start[0]).toBeCloseTo(1.5, 5);
});

test('壁の線を矢印キーで移動し、開口上のクリックは開口の選択として扱う', async ({ page }) => {
  const plan = structuredClone(editablePlan);
  plan.walls[0].openings = [{ id: 'door', kind: 'door', offset: 2, width: 1, bottom: 0, height: 2 }];
  await openPlan(page, plan);
  await wall(page).focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown');
  await expectEndpoints(page, [1.01,1.1], [7.01,1.1]);
  await page.getByRole('button', { name: '扉1を選択', exact: true }).click();
  await expect(endpoint(page, 'start')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '開口の始点', exact: true })).toBeVisible();
  await save(page); expect((await readDrawing(page)).walls[0].openings).toEqual(plan.walls[0].openings);
});

test('線のドラッグ中は別のポインターによる選択・移動・終了を無視する', async ({ page }) => {
  await openPlan(page);
  await startDrag(page); await expectEndpoints(page, [1.5,2], [7.5,2]);
  await page.getByRole('button', { name: '床1を選択', exact: true }).dispatchEvent('pointerdown', { pointerId: 2, button: 0 });
  await editDrawing(page).dispatchEvent('pointermove', { pointerId: 2, clientX: 0, clientY: 0 });
  await editDrawing(page).dispatchEvent('pointerup', { pointerId: 2 });
  await expectEndpoints(page, [1.5,2], [7.5,2]);
  const next = await screenPoint(page, [4,3]);
  await page.mouse.move(next.x, next.y, { steps: 5 }); await page.mouse.up();
  await expectEndpoints(page, [1,3], [7,3]);
  await undo(page).click(); await expect(undo(page)).toBeDisabled();
});

test('壁の全長に一致する開口も小さな移動で保持し、保存・復元できる', async ({ page }) => {
  const plan = structuredClone(editablePlan);
  plan.walls[0].end = [2,1];
  plan.walls[0].openings = [{ id: 'door', kind: 'door', offset: 0, width: 1, bottom: 0, height: 2 }];
  await openPlan(page, plan);
  await wall(page).focus(); await page.keyboard.press('ArrowRight');
  await expectEndpoints(page, [1.01,1], [2.01,1]);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await save(page); await page.reload();
  await wall(page).focus(); await page.keyboard.press('Enter');
  await expectEndpoints(page, [1.01,1], [2.01,1]);
  expect((await readDrawing(page)).walls[0].openings).toEqual(plan.walls[0].openings);
});

test('最小長の壁も長さを保って移動・保存・復元できる', async ({ page }) => {
  const plan = structuredClone(editablePlan);
  plan.walls[0].start = [1.98,1]; plan.walls[0].end = [2,1];
  await openPlan(page, plan);
  await wall(page).focus(); await page.keyboard.press('ArrowRight');
  await expectEndpoints(page, [1.99,1], [2.01,1]);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await save(page); await page.reload();
  await wall(page).focus(); await page.keyboard.press('Enter');
  await expectEndpoints(page, [1.99,1], [2.01,1]);
});
