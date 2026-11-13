import { openDrawingTools } from './fixtures/workspace.js';
import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures/test.js';
import { seedEditablePlan, editablePlan, pickEditPoint } from './fixtures/plan-edit.js';

const stored = page => page.evaluate(() => ({ drawing: JSON.parse(localStorage.getItem('syncterior.drawing')), room: localStorage.getItem('syncterior.personal-room') }));

test('初期表示の図面を3Dなしで作図・保存し、再読込して同じ壁と高さを復元できる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '図面モード', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: '壁を追加', exact: true }).click();
  await pickEditPoint(page, [1,1]); await pickEditPoint(page, [7,1]);
  await page.locator('.drawing-metadata-panel > summary').click();
  await page.getByLabel('図面名', { exact: true }).fill('保存する図面');
  await page.getByLabel('壁の高さ (m)', { exact: true }).fill('3');
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '図面は保存済み' })).toBeVisible();
  const before = await stored(page);
  expect(before.room).toBeNull(); expect(before.drawing.plan.walls).toHaveLength(1);
  expect(before.drawing.plan.h).toBe(3); expect(before.drawing.plan.name).toBe('保存する図面');
  await page.screenshot({ path: test.info().outputPath('drawing-mode.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('button', { name: '壁1を選択', exact: true })).toBeVisible();
  await page.locator('.drawing-metadata-panel > summary').click();
  await expect(page.getByLabel('図面名', { exact: true })).toHaveValue('保存する図面');
  expect(await stored(page)).toEqual(before);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('図面ファイルを往復し、破損ファイルを拒否して現在の図面と保存を維持する', async ({ page }) => {
  await page.goto('/');
  const file = page.getByLabel('図面ファイルを開く', { exact: true });
  await file.setInputFiles({ name: 'plan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, plan: editablePlan })) });
  await expect(page.getByRole('button', { name: '壁1を選択', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  const before = await stored(page);
  const download = page.waitForEvent('download');
  await openDrawingTools(page);
  await page.getByRole('button', { name: '図面ファイルを書き出す', exact: true }).click();
  const artifact = await download;
  expect(JSON.parse(await readFile(await artifact.path(), 'utf8'))).toEqual(before.drawing);
  await file.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toContainText('正しいJSON');
  expect(await stored(page)).toEqual(before);
  await expect(page.getByRole('button', { name: '壁1を選択', exact: true })).toBeVisible();
});

test('未保存の図面はモード切替で維持し、図面の置換を取り消せる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '壁を追加', exact: true }).click();
  await pickEditPoint(page, [1,1]); await pickEditPoint(page, [7,1]);
  const before = await stored(page);
  await page.getByRole('button', { name: '3D・家具配置', exact: true }).click();
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await expect(page.getByRole('button', { name: '壁1を選択', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await openDrawingTools(page);
  await page.getByRole('button', { name: '保存した図面を開く', exact: true }).click();
  await expect(page.getByRole('button', { name: '壁1を選択', exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before);
  page.once('dialog', dialog => dialog.accept());
  await openDrawingTools(page);
  await page.getByRole('button', { name: '保存した図面を開く', exact: true }).click();
  await expect(page.getByRole('button', { name: '壁1を選択', exact: true })).toHaveCount(0);
});

test('図面の保存失敗を案内し、編集とファイル書き出しを続けて再保存できる', async ({ page }) => {
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem;
    window.__denyDrawingSave = true;
    Storage.prototype.setItem = function (key, value) {
      if (window.__denyDrawingSave && key === 'syncterior.drawing') throw new DOMException('Quota', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('図面を保存できません');
  await page.getByRole('button', { name: '壁を追加', exact: true }).click();
  await pickEditPoint(page, [1,1]); await pickEditPoint(page, [7,1]);
  const download = page.waitForEvent('download');
  await openDrawingTools(page);
  await page.getByRole('button', { name: '図面ファイルを書き出す', exact: true }).click();
  await download;
  await page.evaluate(() => { window.__denyDrawingSave = false; });
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await stored(page)).drawing.plan.walls).toHaveLength(1);
});

test('既存の個人配置から図面を開き、保存だけでは家具配置を上書きしない', async ({ page }) => {
  await seedEditablePlan(page); await page.goto('/');
  const before = await stored(page);
  await page.getByRole('button', { name: '壁1を選択', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '壁の終点', exact: true }).focus(); await page.keyboard.press('Shift+ArrowDown');
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  const after = await stored(page);
  expect(after.room).toBe(before.room); expect(after.drawing.plan.walls[0].end).toEqual([7,1.1]);
  await page.reload();
  await expect(page.getByRole('button', { name: '壁1を選択', exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(after);
});

test('画像を使わず寸法を指定して新しい図面を作成できる', async ({ page }) => {
  await page.goto('/');
  await openDrawingTools(page);
  await page.getByText('新しい図面を作成', { exact: true }).click();
  await page.getByLabel('新しい図面名', { exact: true }).fill('手描きの図面');
  await page.getByLabel('図面の幅 (m)', { exact: true }).fill('10');
  await page.getByLabel('図面の奥行き (m)', { exact: true }).fill('5');
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  const value = (await stored(page)).drawing.plan;
  expect([value.name, value.w, value.d]).toEqual(['手描きの図面',10,5]);
  expect(value.walls).toHaveLength(0);
});

test('端点のドラッグ中に図面を読み込んでも古い編集の後始末で図面を上書きしない', async ({ page }) => {
  await seedEditablePlan(page); await page.goto('/');
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '壁1を選択', exact: true }).click();
  const endpoint = page.getByRole('button', { name: '壁の終点', exact: true });
  await endpoint.scrollIntoViewIfNeeded();
  const box = await endpoint.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 30, { steps: 3 });
  await expect(endpoint).not.toHaveAttribute('transform', 'translate(7 1)');
  const plan = { ...editablePlan, name: '差し替えた図面', walls: [] };
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('図面ファイルを開く', { exact: true }).setInputFiles({ name: 'next.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, plan })) });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: '壁1を選択', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  expect((await stored(page)).drawing.plan).toEqual(plan);
});
