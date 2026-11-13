import { expect } from './test.js';

export async function enterLayout(page) {
  await page.getByRole('button', { name: '3D・家具配置', exact: true }).click();
}
export async function openLayout(page, url = '/') {
  await page.goto(url); await enterLayout(page);
}
export async function reloadLayout(page) {
  await page.reload(); await enterLayout(page);
}
export async function openDrawingTools(page) {
  const tools = page.locator('.drawing-source-tools');
  if (!await tools.evaluate(node => node.open)) await tools.locator(':scope > summary').click();
}
export async function openImageImport(page) {
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await openDrawingTools(page);
  const panel = page.locator('.floor-import');
  if (!await panel.evaluate(node => node.open)) await panel.locator('summary').click();
}
export async function previewDrawing(page) {
  await page.getByRole('button', { name: '図面を保存', exact: true }).click();
  await page.getByRole('button', { name: '図面から3Dを表示', exact: true }).click();
}
export async function convertAndPreview(page) {
  await page.getByRole('button', { name: '図面へ変換', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2D図面を編集', exact: true })).toBeVisible();
  await previewDrawing(page);
}
