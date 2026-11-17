import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { test, expect } from './fixtures/test.js';
import { openImageImport, convertAndPreview } from './fixtures/workspace.js';
import { measurementDrawing, pickMeasurementPoint, findRoomCandidate, selectedPolygonArea as polygonArea } from './fixtures/floor-plan.js';

// 部屋内・隣室の少数の手動参照点。図面全体の正解や認識率ではない。
const references = [
  ['白黒図面', 'monochrome.jpg', [[.4,.7],[.3,.6],[.48,.8]], [.75,.7]],
  ['着色図面', 'colored.jpg', [[.37,.18],[.27,.1],[.47,.27]], [.6,.18]],
  ['黒背景の図面', 'dark-background.jpg', [[.7,.42],[.54,.34],[.9,.53]], [.3,.42]],
  ['木目のある図面', 'textured.jpg', [[.3,.8],[.24,.7],[.39,.9]], [.65,.8]],
  ['色付き透明図面', 'holdout/cottage.png', [[.25,.25],[.1,.1],[.43,.38]], [.7,.25]],
  ['大きい図面', 'holdout/riverside.png', [[.19,.35],[.17,.25],[.22,.45]], [.31,.35]],
];

async function chooseTatami(page, mode = 'room') {
  await page.getByRole('combobox', { name: 'サイズ合わせの方法', exact: true }).selectOption('tatami');
  await page.getByRole('combobox', { name: '帖数の対象', exact: true }).selectOption(mode);
}

for (const [name, file, included, excluded] of references) {
  test(`${name}の部屋を自動認識し、隣室と分けて輪郭の面積から帖数補正できる`, async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        constructor(...args) { super(...args); this.addEventListener('message', ({ data }) => { window.__roomWorkerData = data; }); }
      };
    });
    await page.goto('/'); await openImageImport(page);
    await page.getByLabel('間取り画像', { exact: true }).setInputFiles(fileURLToPath(new URL(`./fixtures/floor-plans/${file}`, import.meta.url)));
    await expect(page.getByRole('status').filter({ hasText: '解析できました。サイズを合わせてください。' })).toBeVisible();
    await chooseTatami(page);
    const sourceImage = await measurementDrawing(page).locator('image').getAttribute('href');
    const sourceArtifact = testInfo.outputPath('source.png');
    await writeFile(sourceArtifact, Buffer.from(sourceImage.split(',')[1], 'base64'));
    await testInfo.attach('解析した元画像', { path: sourceArtifact, contentType: 'image/png' });
    await testInfo.attach(`${name}の自動認識`, { body: await measurementDrawing(page).screenshot(), contentType: 'image/png' });
    const candidates = await measurementDrawing(page).evaluate(svg => {
      const [, , w, d] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      return [...svg.querySelectorAll('.floor-room-candidate')].map(node => node.getAttribute('points').split(' ').map(point => {
        const [x,y] = point.split(',').map(Number); return [x / w, y / d];
      }));
    });
    const artifact = testInfo.outputPath('room-candidates.json');
    const worker = await page.evaluate(() => window.__roomWorkerData);
    await writeFile(artifact, JSON.stringify({ included, excluded, candidates, worker }, null, 2));
    await testInfo.attach('部屋候補の輪郭データ', { path: artifact, contentType: 'application/json' });
    const candidate = await findRoomCandidate(page, included, excluded);
    expect(candidate, `${name}の部屋内の点を含み、隣室の点を含まない候補`).toBeGreaterThanOrEqual(0);
    await page.getByRole('button', { name: `部屋候補${candidate + 1}`, exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'サイズを合わせる', exact: true })).toBeEnabled();
    await page.getByLabel('選択した部屋の帖数', { exact: true }).fill('6.5');
    await page.getByRole('button', { name: 'サイズを合わせる', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await polygonArea(page)).toBeCloseTo(6.5 * 1.62, 6);
    await testInfo.attach(`${name}の部屋候補`, { body: await measurementDrawing(page).screenshot(), contentType: 'image/png' });
    await convertAndPreview(page);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')));
    expect(JSON.stringify(saved)).not.toMatch(/roomCandidates|areaMode|tatami/);
  });
}

test('L字の輪郭を手動で閉じて補正し、頂点の調整と取消・再適用ができる', async ({ page }) => {
  await page.goto('/'); await openImageImport(page);
  await chooseTatami(page, 'polygon');
  for (const point of [[.2,.2],[.8,.2],[.8,.5],[.5,.5],[.5,.8],[.2,.8]]) await pickMeasurementPoint(page, point);
  const apply = page.getByRole('button', { name: 'サイズを合わせる', exact: true });
  await expect(apply).toBeDisabled();
  await page.getByLabel('選択した部屋の帖数', { exact: true }).fill('6.5');
  const unclosedSize = await measurementDrawing(page).getAttribute('viewBox');
  await page.locator('.floor-fields form').dispatchEvent('submit');
  await expect(page.getByRole('alert')).toHaveText('輪郭・帖数・換算値を確認してください。');
  await expect(measurementDrawing(page)).toHaveAttribute('viewBox', unclosedSize);
  await page.getByRole('button', { name: '輪郭を閉じる', exact: true }).click();
  await page.getByLabel('選択した部屋の帖数', { exact: true }).fill('6.5');
  await apply.click();
  expect(await polygonArea(page)).toBeCloseTo(6.5 * 1.62, 6);
  const before = await measurementDrawing(page).getAttribute('viewBox');
  await apply.click(); await expect(measurementDrawing(page)).toHaveAttribute('viewBox', before);
  const vertex = page.getByRole('button', { name: '輪郭の頂点4', exact: true });
  const transform = await vertex.getAttribute('transform');
  await vertex.focus(); await page.keyboard.press('ArrowRight');
  await expect(vertex).not.toHaveAttribute('transform', transform);
  await apply.click(); expect(await polygonArea(page)).toBeCloseTo(6.5 * 1.62, 6);
  await page.getByRole('button', { name: 'サイズ補正を取り消す', exact: true }).click();
  await page.getByRole('button', { name: '輪郭を選び直す', exact: true }).click();
  await expect(apply).toBeDisabled();
  for (const point of [[.2,.2],[.8,.8],[.8,.2],[.2,.8]]) await pickMeasurementPoint(page, point);
  await expect(page.getByRole('button', { name: '輪郭を閉じる', exact: true })).toBeDisabled();
  await expect(apply).toBeDisabled();
});

test('無地を部屋として自動認識せず、手動の輪郭指定でサイズ合わせを続けられる', async ({ page }) => {
  await page.goto('/'); await openImageImport(page);
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 200;
    const context = c.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0,0,200,200);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('間取り画像', { exact: true }).setInputFiles({ name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByRole('status').filter({ hasText: '解析できました。サイズを合わせてください。' })).toBeVisible();
  await chooseTatami(page);
  await expect(page.getByText('部屋候補が見つかりません。', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'サイズを合わせる', exact: true })).toBeDisabled();
  await chooseTatami(page, 'polygon');
  for (const point of [[.2,.2],[.8,.2],[.5,.8]]) await pickMeasurementPoint(page, point);
  await page.getByRole('button', { name: '輪郭を閉じる', exact: true }).click();
  await page.getByLabel('選択した部屋の帖数', { exact: true }).fill('6.5');
  await page.getByRole('button', { name: 'サイズを合わせる', exact: true }).click();
  expect(await polygonArea(page)).toBeCloseTo(6.5 * 1.62, 6);
});
