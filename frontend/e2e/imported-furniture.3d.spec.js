import { PerspectiveCamera, Vector3 } from 'three';
import { test, expect, waitForSceneToSettle } from './fixtures/test.js';

const layout={version:2,room:{planKey:'custom',items:[],customPlan:{version:1,name:'家具配置テスト',w:8,d:6,h:2.5,wallThickness:.2,
  floors:[{id:'floor',kind:'room',points:[[0,0],[8,0],[8,6],[0,6]]}],
  walls:[{id:'wall',start:[6,0],end:[6,6],openings:[]}]}}};

test('取込間取りの実際の3D家具をドラッグ・回転し、壁沿いに滑らせて反対側へ移動・保存できる',async({page},testInfo)=>{
  await page.addInitScript(value=>{if(!localStorage.getItem('syncterior.personal-room'))localStorage.setItem('syncterior.personal-room',JSON.stringify(value));},layout);
  await page.goto('/');
  await page.getByRole('button',{name:/^デスク/}).click();
  await page.getByRole('button',{name:'90° 回転'}).click();
  const canvas=page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  await waitForSceneToSettle(page);
  let bounds=await canvas.boundingBox();
  const camera=new PerspectiveCamera(42,bounds.width/bounds.height,.1,1000);
  const size=Math.max(8,6,2.5)*1.25;
  camera.position.set(size*.8,size*.85,size);camera.lookAt(0,.5,0);camera.updateMatrixWorld();
  const screen=(x,z)=>{const p=new Vector3(x,.74,z).project(camera);return[bounds.x+(p.x+1)*bounds.width/2,bounds.y+(1-p.y)*bounds.height/2];};
  await page.mouse.move(...screen(0,0));await page.mouse.down();
  try{
    await expect(page.getByRole('heading',{name:'デスク',exact:true})).toBeVisible();
    await page.mouse.move(...screen(.6,.4),{steps:12});
  }finally{await page.mouse.up();}
  const x=page.getByLabel('左右位置 (X)');
  await expect(x).not.toHaveValue('0.0');
  const previous=await x.inputValue();
  await x.fill('2');
  await expect(x).toHaveValue(previous);
  const current = await page.evaluate(() => JSON.parse(localStorage.getItem('syncterior.personal-room')).room.items[0]);
  await canvas.scrollIntoViewIfNeeded();
  await waitForSceneToSettle(page);
  bounds = await canvas.boundingBox();
  await page.mouse.move(...screen(current.x,current.z));
  await page.mouse.down();
  try {
    await page.mouse.move(...screen(1.9,.8),{steps:12});
    await expect(x).toHaveValue('1.6');
    await expect(page.getByLabel('前後位置 (Z)')).toHaveValue('0.8');
    await page.mouse.move(...screen(1.9,1.2),{steps:12});
    await expect(x).toHaveValue('1.6');
    await expect(page.getByLabel('前後位置 (Z)')).toHaveValue('1.2');
    await page.mouse.move(...screen(2.6,1.2),{steps:12});
    await expect(x).toHaveValue('2.6');
  } finally { await page.mouse.up(); }
  const finalX = await x.inputValue();
  await testInfo.attach('取込間取りの家具',{body:await canvas.screenshot(),contentType:'image/png'});
  await page.reload();
  await waitForSceneToSettle(page);
  const items=await page.evaluate(()=>JSON.parse(localStorage.getItem('syncterior.personal-room')).room.items);
  expect(items).toHaveLength(1);expect(items[0].rot).toBeCloseTo(Math.PI/2);
  expect(items[0].x.toFixed(1)).toBe(finalX);
});
