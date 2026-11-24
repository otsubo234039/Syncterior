import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Vector3 } from 'three';
import { test, expect, waitForSceneToSettle } from './fixtures/test.js';
import { openLayout, reloadLayout } from './fixtures/workspace.js';

for (const mobile of [false,true]) test.describe(mobile?'モバイル幅の家具モデル':'デスクトップの家具モデル',()=> {
  if (mobile) test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  test('埋め込み画像付きGLBを実WebGLで表示・編集・復元し、欠落時も編集を続けられる',async({page},testInfo)=> {
    await page.addInitScript(()=> {
      if (!localStorage.getItem('syncterior.personal-room')) localStorage.setItem('syncterior.personal-room',JSON.stringify({version:1,room:{planKey:'studio',items:[]}}));
    });
    await openLayout(page);
    await page.locator('.furniture-importer summary').click();
    await page.getByLabel('家具モデル（GLB）').setInputFiles({name:'テクスチャ付き机.glb',mimeType:'model/gltf-binary',buffer:readFileSync(new URL('../public/samples/furniture-desk.glb',import.meta.url))});
    await expect(page.getByRole('img',{name:'取り込む家具のプレビュー'})).toBeVisible();
    await page.getByRole('button',{name:'この家具を配置'}).click();
    const canvas=page.locator('canvas');
    await canvas.scrollIntoViewIfNeeded(); await waitForSceneToSettle(page);
    if (!mobile) {
      await canvas.click({position:{x:10,y:20}});
      await expect(page.getByRole('heading',{name:'家具を選択してください',exact:true})).toBeVisible();
      // 選択解除でプロパティ欄が縮み、スクロール位置が変わるので座標を取り直す。
      await canvas.scrollIntoViewIfNeeded(); await waitForSceneToSettle(page);
      let bounds=await canvas.boundingBox();
      const camera=new PerspectiveCamera(42,bounds.width/bounds.height,.1,1000);
      camera.position.set(8,7,9); camera.lookAt(0,.5,0); camera.updateMatrixWorld();
      const screen=(x,z)=> {const p=new Vector3(x,.8,z).project(camera);return[bounds.x+(p.x+1)*bounds.width/2,bounds.y+(1-p.y)*bounds.height/2];};
      await page.mouse.move(...screen(0,0)); await page.mouse.down();
      try {
        await expect(page.getByRole('heading',{name:'テクスチャ付き机',exact:true})).toBeVisible();
        await waitForSceneToSettle(page);
        bounds=await canvas.boundingBox();
        await page.mouse.move(...screen(.6,.3),{steps:10});
      } finally {await page.mouse.up();}
      await expect(page.getByLabel('左右位置 (X)')).toHaveValue('0.6');
      await expect(page.getByLabel('前後位置 (Z)')).toHaveValue('0.3');
    }
    await canvas.scrollIntoViewIfNeeded(); await waitForSceneToSettle(page);
    const before=await canvas.screenshot();
    await page.getByLabel('家具の色').fill('#224488');
    await canvas.scrollIntoViewIfNeeded(); await waitForSceneToSettle(page);
    const after=await canvas.screenshot();
    expect(await maxImageChannelDelta(page,before,after)).toBeGreaterThan(20);
    await page.getByRole('button',{name:'90° 回転'}).click();
    await reloadLayout(page); await canvas.scrollIntoViewIfNeeded(); await waitForSceneToSettle(page);
    await expect(page.locator('.model-load-error')).toHaveCount(0);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('syncterior.personal-room')));
    expect(saved.room.items[0].rot).toBeCloseTo(Math.PI/2); expect(saved.room.items[0].color).toBe('#224488');
    await testInfo.attach('取り込んだ家具モデルの実3D',{body:await canvas.screenshot(),contentType:'image/png'});
    await page.evaluate(()=>new Promise((resolve,reject)=> {const request=indexedDB.deleteDatabase('syncterior.furniture-models');request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);}));
    await reloadLayout(page);
    await expect(page.getByRole('status').filter({hasText:'保存した家具モデルが見つかりません'})).toBeVisible();
    await page.getByRole('button',{name:'平面図',exact:true}).click();
    await page.getByRole('button',{name:'テクスチャ付き机を選択',exact:true}).click();
    await page.getByRole('button',{name:'選択を削除'}).click();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('syncterior.personal-room')).version)).toBe(1);
  });
});

async function maxImageChannelDelta(page, before, after) {
  return page.evaluate(async ([before, after]) => {
    const pixels = async encoded => {
      const img = new Image(); img.src = `data:image/png;base64,${encoded}`; await img.decode();
      const surface = document.createElement('canvas'); surface.width = img.width; surface.height = img.height;
      const ctx = surface.getContext('2d'); ctx.drawImage(img, 0, 0);
      return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
    };
    const a = await pixels(before), b = await pixels(after);
    if (a.width !== b.width || a.height !== b.height) return Infinity;
    let maximum = 0;
    for (let i = 0; i < a.data.length; i++) maximum = Math.max(maximum, Math.abs(a.data[i] - b.data[i]));
    return maximum;
  }, [before.toString('base64'), after.toString('base64')]);
}
