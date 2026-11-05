import { test, expect, waitForScene, drawCalls } from './test.js';

const count = page => page.locator('.room-metrics > div').filter({ hasText: 'FURNITURE' }).locator('strong');
async function share(page) {
  await page.getByRole('button', { name: '部屋を共有', exact: true }).click();
  await page.getByRole('button', { name: '共有リンクを作成', exact: true }).click();
  await expect(page.locator('.sharing-summary')).toContainText('共同編集中');
  return page.getByLabel('編集用リンク').inputValue();
}


export async function verifySharedRoom({ page, guestPage: guest, sceneMode }) {
  // Two software-rendered canvases and a full edit/plan/leave flow need a larger budget.
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: /^デスク/ }).click();
  const url = await share(page);
  await page.getByRole('button', { name: '共有ダイアログを閉じる' }).click();
  await guest.goto(url);
  await expect(guest.locator('.sharing-summary')).toContainText('共同編集中');
  await expect(page.locator('.sharing-summary')).toContainText('2人が参加中');
  await expect(count(guest)).toContainText('5');
  await expect(guest.getByRole('heading', { name: '家具を選択してください' })).toBeVisible();
  if (sceneMode === 'full') {
    await waitForScene(page);
    await waitForScene(guest);
  }
  const guestDraws = sceneMode === 'full' ? await drawCalls(guest) : 0;
  await page.getByLabel('左右位置 (X)').fill('99');
  await page.getByLabel('前後位置 (Z)').fill('99');
  await expect(page.locator('.sharing-summary')).toContainText('変更は同期済み');
  await page.getByRole('button', { name: '90° 回転' }).click();
  await expect(page.locator('.sharing-summary')).toContainText('変更は同期済み');
  await expect(page.getByLabel('左右位置 (X)')).toHaveValue('2.1');
  await expect(page.getByLabel('前後位置 (Z)')).toHaveValue('1.5');
  await expect.poll(async () => {
    const response = await guest.request.get(`/api/rooms/${new URL(url).searchParams.get('room')}`);
    expect(response.ok()).toBe(true);
    const stored = await response.json();
    const desk = stored.items.find(item => item.type === 'desk');
    return desk && [desk.x, desk.z, desk.rot].map(value => Number(value.toFixed(6)));
  }).toEqual([2.1, 1.5, 1.570796]);
  if (sceneMode === 'full') await expect.poll(() => drawCalls(guest)).toBeGreaterThan(guestDraws);
  const previousDrawCalls = sceneMode === 'full' ? await drawCalls(page) : 0;
  await guest.getByRole('button', { name: /^ダイニングチェア/ }).click();
  await expect(count(page)).toContainText('6');
  if (sceneMode === 'full') await expect.poll(() => drawCalls(page)).toBeGreaterThan(previousDrawCalls);
  await expect(page.getByRole('heading', { name: 'デスク', exact: true })).toBeVisible();
  await guest.getByRole('button', { name: '選択を削除', exact: true }).click();
  await expect(count(page)).toContainText('5');
  await page.getByRole('button', { name: /^1LDK/ }).click();
  await expect(guest.getByRole('heading', { name: '1LDK / 3Dレイアウト' })).toBeVisible();
  await expect(count(guest)).toContainText('4');
  await expect(page.getByRole('heading', { name: '家具を選択してください' })).toBeVisible();
  // Unload the guest document to verify disconnection before fixture cleanup.
  await guest.goto('about:blank');
  await expect(page.locator('.sharing-summary')).toContainText('1人が参加中');
}
