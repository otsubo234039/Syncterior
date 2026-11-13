import { openLayout, reloadLayout, openImageImport, convertAndPreview, previewDrawing } from './fixtures/workspace.js';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures/test.js';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')));

test('画像から作成した間取りで家具を追加・編集・保存・復元・削除できる', async ({ page }) => {
  await page.goto('/');
  await openImageImport(page);
  await page.getByLabel('間取り画像', { exact:true }).setInputFiles(fileURLToPath(new URL('./fixtures/floor-plans/monochrome.jpg',import.meta.url)));
  await expect(page.getByRole('status').filter({hasText:/OpenCV .*壁候補を\d+本抽出/})).toBeVisible();
  await convertAndPreview(page);
  await page.getByRole('button',{name:/^デスク/}).click();
  await expect(page.getByRole('heading',{name:'デスク',exact:true})).toBeVisible();
  await expect.poll(async()=> (await saved(page)).room.items.length).toBe(1);
  const before=(await saved(page)).room.items[0];
  await page.getByLabel('家具の色').fill('#123456');
  await expect.poll(async()=> (await saved(page)).room.items[0].color).toBe('#123456');
  await page.getByRole('button', { name: '図面モード', exact: true }).click();
  await previewDrawing(page);
  expect((await saved(page)).room.items).toEqual([{...before,color:'#123456'}]);
  await reloadLayout(page);
  await expect(page.getByRole('heading',{name:'取込間取り / 3Dレイアウト'})).toBeVisible();
  expect((await saved(page)).room.items[0]).toEqual({...before,color:'#123456'});
  await page.getByRole('button',{name:/^デスク/}).click();
  await expect.poll(async()=> (await saved(page)).room.items.length).toBe(2);
  await page.getByRole('button',{name:'選択を削除'}).click();
  await expect.poll(async()=> (await saved(page)).room.items.length).toBe(1);
});

test('取込間取りに収まらない家具は追加せず理由を表示する',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('syncterior.personal-room',JSON.stringify({version:2,room:{planKey:'custom',items:[],customPlan:{version:1,name:'狭い間取り',w:1,d:1,h:2.5,wallThickness:.1,floors:[{id:'floor',kind:'room',points:[[0,0],[1,0],[1,1],[0,1]]}],walls:[]}}})));
  await openLayout(page);
  await page.getByRole('button',{name:/^デスク/}).click();
  await expect(page.getByRole('alert')).toContainText('収まる位置が見つかりません');
  expect((await saved(page)).room.items).toHaveLength(0);
  await page.getByRole('button',{name:/^ダイニングチェア/}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect.poll(async()=>(await saved(page)).room.items.length).toBe(1);
});
