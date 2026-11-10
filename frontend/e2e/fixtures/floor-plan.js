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
  await page.getByRole('button', { name: 'この長さで全体を補正', exact: true }).click();
  return before;
}
