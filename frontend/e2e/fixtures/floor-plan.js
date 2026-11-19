export const measurementDrawing = page => page.getByRole('group', { name: '壁候補と計測区間の図', exact: true });
export async function pickMeasurementPoint(page, point) {
  const drawing = measurementDrawing(page);
  await drawing.scrollIntoViewIfNeeded();
  const position = await drawing.evaluate((svg, [x, y]) => {
    const [, , width, height] = svg.getAttribute('viewBox').split(/\s+/).map(Number), box = svg.getBoundingClientRect();
    const p = new DOMPoint(x * width, y * height).matrixTransform(svg.getScreenCTM());
    return { x: p.x - box.left, y: p.y - box.top };
  }, point);
  await drawing.click({ position });
}
export async function calibrateDrawing(page, factor = 1.2) {
  const drawing = measurementDrawing(page);
  const before = await drawing.evaluate(svg => { const [, , w, d] = svg.getAttribute('viewBox').split(/\s+/).map(Number); return { w, d }; });
  await page.getByRole('button', { name: '2点を選び直す', exact: true }).click();
  await pickMeasurementPoint(page, [.22, .42]);
  await pickMeasurementPoint(page, [.47, .42]);
  // 実際のクリック座標にはブラウザの丸めがあるため、画面上に置かれた区間を測る。
  const measured = await page.locator('.floor-measurement').evaluate(line => Math.hypot(
    Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
    Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
  ));
  await page.getByLabel('測った一辺の長さ (m)', { exact: true }).fill(String(Number((measured * factor).toFixed(8))));
  await page.getByRole('button', { name: 'サイズを合わせる', exact: true }).click();
  return before;
}

export async function calibrateDrawingByTatami(page, tatami = 6.5, areaPerTatami = 1.62) {
  await page.getByRole('combobox', { name: 'サイズ合わせの方法', exact: true }).selectOption('tatami');
  await page.getByRole('combobox', { name: '帖数の対象', exact: true }).selectOption('rectangle');
  await pickMeasurementPoint(page, [.2, .25]);
  await pickMeasurementPoint(page, [.7, .75]);
  const before = await measurementDrawing(page).evaluate(svg => {
    const [, , w, d] = svg.getAttribute('viewBox').split(/\s+/).map(Number), rect = svg.querySelector('.floor-measure-area');
    return { w, d, area: Number(rect.getAttribute('width')) * Number(rect.getAttribute('height')) };
  });
  await page.getByLabel('選択した部屋の帖数', { exact: true }).fill(String(tatami));
  await page.getByLabel('1帖の面積 (m²)', { exact: true }).fill(String(areaPerTatami));
  await page.getByRole('button', { name: 'サイズを合わせる', exact: true }).click();
  return { ...before, factor: Math.sqrt(tatami * areaPerTatami / before.area) };
}

export async function findRoomCandidate(page, included, excluded) {
  return measurementDrawing(page).evaluate((svg, { included, excluded }) => {
    const [, , w, d] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const contains = (points, [x, y]) => points.reduce((inside, p, i) => {
      const q = points[(i + 1) % points.length];
      return (p[1] > y) !== (q[1] > y) && x < (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]) + p[0] ? !inside : inside;
    }, false);
    return [...svg.querySelectorAll('.floor-room-candidate')].findIndex(node => {
      const points = node.getAttribute('points').split(' ').map(p => { const [x,y] = p.split(',').map(Number); return [x / w, y / d]; });
      return included.every(point => contains(points, point)) && !contains(points, excluded);
    });
  }, { included, excluded });
}

export async function selectedPolygonArea(page) {
  return page.locator('.floor-measure-polygon').evaluate(node => {
    const points = node.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
    return Math.abs(points.reduce((sum, p, i) => { const next = points[(i + 1) % points.length]; return sum + p[0] * next[1] - next[0] * p[1]; }, 0)) / 2;
  });
}

export async function calibrateDrawingByRoom(page, tatami = 6.5, areaPerTatami = 1.62) {
  await page.getByRole('combobox', { name: 'サイズ合わせの方法', exact: true }).selectOption('tatami');
  await page.getByRole('combobox', { name: '帖数の対象', exact: true }).selectOption('room');
  const index = await findRoomCandidate(page, [[.37,.18],[.27,.1],[.47,.27]], [.6,.18]);
  if (index < 0) throw new Error('洋室の部屋候補が見つかりません。');
  await page.getByRole('button', { name: `部屋候補${index + 1}`, exact: true }).focus(); await page.keyboard.press('Enter');
  const before = await measurementDrawing(page).evaluate(svg => { const [, , w, d] = svg.getAttribute('viewBox').split(/\s+/).map(Number); return { w, d }; });
  const area = await selectedPolygonArea(page);
  await page.getByLabel('選択した部屋の帖数', { exact: true }).fill(String(tatami));
  await page.getByLabel('1帖の面積 (m²)', { exact: true }).fill(String(areaPerTatami));
  await page.getByRole('button', { name: 'サイズを合わせる', exact: true }).click();
  return { ...before, factor: Math.sqrt(tatami * areaPerTatami / area) };
}
