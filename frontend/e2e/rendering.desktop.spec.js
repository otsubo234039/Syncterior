import { openLayout } from './fixtures/workspace.js';
import { test, expect, waitForSceneToSettle } from './fixtures/test.js';

test.use({ sceneMode: 'full' });

test('マス目表示を切り替えると実WebGLの床グリッドが消える', async ({ page }) => {
  await openLayout(page, '/');
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  await waitForSceneToSettle(page);
  const before = await canvas.screenshot();
  await page.getByRole('button', { name: 'マス目表示', exact: true }).click();
  await waitForSceneToSettle(page);
  const after = await canvas.screenshot();
  expect(before.equals(after), 'マス目を消すとキャンバスの画像が変化する').toBe(false);
});

test('床と壁の画像テクスチャを選択すると対応する実画像へ切り替わる', async ({ page }) => {
  await openLayout(page, '/');
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  await waitForSceneToSettle(page);
  const before = await canvas.screenshot();
  await page.getByRole('combobox', { name: '床', exact: true }).selectOption('oak');
  await waitForSceneToSettle(page);
  const after = await canvas.screenshot();
  expect(before.equals(after), '床テクスチャ選択後にキャンバスの画像が変化する').toBe(false);
  await page.getByRole('combobox', { name: '床', exact: true }).selectOption('natural');
  await waitForSceneToSettle(page);
  const natural = await canvas.screenshot();
  expect(after.equals(natural), 'ナチュラルウッド選択後にキャンバスの画像が変化する').toBe(false);
  await page.getByRole('combobox', { name: '床', exact: true }).selectOption('dark');
  await waitForSceneToSettle(page);
  const dark = await canvas.screenshot();
  expect(natural.equals(dark), 'ダークウッド選択後にキャンバスの画像が変化する').toBe(false);
  await page.getByRole('combobox', { name: '床', exact: true }).selectOption('tatami');
  await waitForSceneToSettle(page);
  const tatami = await canvas.screenshot();
  expect(dark.equals(tatami), '畳選択後にキャンバスの画像が変化する').toBe(false);
  await page.getByRole('combobox', { name: '床', exact: true }).selectOption('whiteTile');
  await waitForSceneToSettle(page);
  const whiteTile = await canvas.screenshot();
  expect(tatami.equals(whiteTile), '白タイル選択後にキャンバスの画像が変化する').toBe(false);
  await page.getByRole('combobox', { name: '床', exact: true }).selectOption('concrete');
  await waitForSceneToSettle(page);
  const concreteFloor = await canvas.screenshot();
  expect(whiteTile.equals(concreteFloor), 'コンクリート床選択後にキャンバスの画像が変化する').toBe(false);
  await page.getByRole('combobox', { name: '壁', exact: true }).selectOption('darkWood');
  await waitForSceneToSettle(page);
  const darkWoodWall = await canvas.screenshot();
  expect(concreteFloor.equals(darkWoodWall), 'ダークウッド壁紙選択後にキャンバスの画像が変化する').toBe(false);
  await page.getByRole('combobox', { name: '壁', exact: true }).selectOption('concrete');
  await waitForSceneToSettle(page);
  const concreteWall = await canvas.screenshot();
  expect(darkWoodWall.equals(concreteWall), 'コンクリート壁紙選択後にキャンバスの画像が変化する').toBe(false);
  await page.getByRole('combobox', { name: '床', exact: true }).selectOption('carpet');
  await waitForSceneToSettle(page);
  const carpetFloor = await canvas.screenshot();
  expect(concreteWall.equals(carpetFloor), 'カーペット選択後にキャンバスの画像が変化する').toBe(false);
});

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
  // 回転も慣性を残さず停止する。視点の変更と停止を実際の描画で確認する。
  await idle();
});
