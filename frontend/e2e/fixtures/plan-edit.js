export const editablePlan = {
  version: 1, name: '手直し用の間取り', w: 8, d: 6, h: 2.5, wallThickness: .12,
  floors: [{ id: 'floor', kind: 'room', points: [[0,0],[8,0],[8,6],[0,6]] }],
  walls: [{ id: 'wall', start: [1,1], end: [7,1], thicknessRatio: 2, openings: [] }],
};
export async function seedEditablePlan(page, items = []) {
  await page.addInitScript(({ plan, items }) => { if (!localStorage.getItem('syncterior.personal-room')) localStorage.setItem('syncterior.personal-room', JSON.stringify({ version: 2, room: { planKey: 'custom', customPlan: plan, items } })); }, { plan: editablePlan, items });
}
export const savedPlan = page => page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')));
export const editDrawing = page => page.getByRole('group', { name: '下絵と間取りの編集図', exact: true });
export async function pickEditPoint(page, point) {
  const drawing = editDrawing(page);
  await drawing.scrollIntoViewIfNeeded();
  const position = await drawing.evaluate((svg, [x, y]) => {
    const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()), box = svg.getBoundingClientRect();
    return { x: p.x - box.left, y: p.y - box.top };
  }, point);
  await drawing.click({ position });
}
export async function attachUnderlay(page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 150;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,200,150);
    ctx.strokeRect(25,25,150,100); return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('手直し用の下絵', { exact: true }).setInputFiles({ name: 'drawing.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('heading', { name: '2D図面を編集', exact: true }).waitFor();
}
