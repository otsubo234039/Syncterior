import { test, expect } from './fixtures/test.js';
import { openLayout, reloadLayout } from './fixtures/workspace.js';
import { furnitureGlb } from '../src/features/room-planner/utils/__tests__/helpers/furniture-glb.js';

const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('syncterior.personal-room')));
const upload=async(page,bytes=furnitureGlb())=> {
  const panel=page.locator('.furniture-importer');
  if (!await panel.evaluate(node=>node.open)) await panel.locator('summary').click();
  await page.getByLabel('家具モデル（GLB）').setInputFiles({name:'自作の机.glb',mimeType:'model/gltf-binary',buffer:Buffer.from(bytes)});
  return panel;
};

for (const custom of [false,true]) test(`${custom?'図面からの間取り':'プリセット'}でGLB家具の寸法と向きを調整し、編集・保存・復元・削除できる`,async({page})=> {
  if (custom) await page.addInitScript(()=> {
    if (!localStorage.getItem('syncterior.personal-room')) localStorage.setItem('syncterior.personal-room',JSON.stringify({version:2,room:{planKey:'custom',items:[],customPlan:{version:1,name:'モデル取込の床',w:6,d:5,h:2.5,wallThickness:.1,floors:[{id:'floor',kind:'room',points:[[0,0],[6,0],[6,5],[0,5]]}],walls:[]}}}));
  });
  await openLayout(page);
  const panel=await upload(page);
  await expect(page.getByRole('img',{name:'取り込む家具のプレビュー'})).toBeVisible();
  await page.getByLabel('家具の名前',{exact:true}).fill('写真から作った机');
  await panel.getByLabel('幅 (m)',{exact:true}).fill('1.4');
  await panel.getByLabel('奥行き (m)',{exact:true}).fill('.7');
  await panel.getByLabel('高さ (m)',{exact:true}).fill('.75');
  await page.getByLabel('モデルの正面').selectOption('1');
  await page.getByRole('button',{name:'この家具を配置'}).click();
  await expect(page.getByRole('heading',{name:'写真から作った机',exact:true})).toBeVisible();
  await expect.poll(async()=> (await saved(page))?.version).toBe(3);
  const before=(await saved(page)).room.items.find(item=>item.type==='model');
  expect(before).toMatchObject({w:1.4,d:.7,h:.75,modelUp:'y',modelFront:1});
  await page.getByLabel('家具の色').fill('#123456');
  await page.getByLabel('左右位置 (X)').fill('1');
  await page.getByRole('button',{name:'90° 回転'}).click();
  await expect.poll(async()=> (await saved(page)).room.items.find(item=>item.type==='model').rot).toBeCloseTo(Math.PI/2);
  await page.getByRole('button',{name:'部屋を共有',exact:true}).click();
  await expect(page.getByRole('button',{name:'共有リンクを作成',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'共有ダイアログを閉じる'}).click();
  if (!custom) {
    await upload(page);
    await page.getByLabel('家具の名前',{exact:true}).fill('同じモデルの別の机');
    await page.getByRole('button',{name:'この家具を配置'}).click();
    await expect.poll(async()=> (await saved(page)).room.items.filter(item=>item.type==='model').length).toBe(2);
    const models=(await saved(page)).room.items.filter(item=>item.type==='model');
    expect(models[0].assetId).toBe(models[1].assetId); expect(models[0].id).not.toBe(models[1].id);
  }
  await reloadLayout(page);
  await page.getByRole('button',{name:'平面図',exact:true}).click();
  await page.getByRole('button',{name:'写真から作った机を選択',exact:true}).click();
  await expect(page.getByLabel('左右位置 (X)')).toHaveValue('1.0');
  await expect(page.getByLabel('家具の色')).toHaveValue('#123456');
  const bytes=await page.evaluate(assetId=>new Promise((resolve,reject)=> {
    const open=indexedDB.open('syncterior.furniture-models',1);
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=> {const db=open.result,tx=db.transaction('models'),request=tx.objectStore('models').get(assetId);tx.oncomplete=()=>{db.close();resolve(request.result?.byteLength);};};
  }),before.assetId);
  expect(bytes).toBeGreaterThan(0);
  await page.getByRole('button',{name:'選択を削除'}).click();
  if (!custom) {
    await expect.poll(async()=> (await saved(page)).version).toBe(3);
    await page.getByRole('button',{name:'同じモデルの別の机を選択',exact:true}).click();
    await page.getByRole('button',{name:'選択を削除'}).click();
  }
  await expect.poll(async()=> (await saved(page)).version).toBe(custom?2:1);
});

test('外部参照を拒否し、収まらない寸法や取消・モード切替では配置を変えない',async({page})=> {
  await openLayout(page);
  const previous=await saved(page);
  const panel=await upload(page,furnitureGlb(json=>{json.buffers[0].uri='https://example.com/a.bin';}));
  await expect(panel.getByRole('alert')).toContainText('外部参照');
  expect(await saved(page)).toEqual(previous);
  await upload(page);
  await expect(page.getByRole('img',{name:'取り込む家具のプレビュー'})).toBeVisible();
  await panel.getByLabel('幅 (m)',{exact:true}).fill('20');
  await page.getByRole('button',{name:'この家具を配置'}).click();
  await expect(panel.getByRole('alert')).toContainText('収まる位置が見つかりません');
  await page.getByRole('button',{name:'取り込みを中止'}).click();
  await expect(page.getByRole('button',{name:'この家具を配置'})).toHaveCount(0);
  await upload(page);
  await expect(page.getByLabel('家具の名前',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'図面モード',exact:true}).click();
  await page.getByRole('button',{name:'3D・家具配置',exact:true}).click();
  expect(await saved(page)).toEqual(previous);
  await expect(page.getByRole('button',{name:'この家具を配置'})).toHaveCount(0);
});

test('モデル保存領域が拒否されても取込家具を編集し、再取込の案内を表示できる',async({page})=> {
  await page.addInitScript(()=>Object.defineProperty(globalThis,'indexedDB',{get(){throw new Error('保存領域の拒否');}}));
  await openLayout(page); const panel=await upload(page);
  await expect(page.getByRole('button',{name:'この家具を配置'})).toBeVisible();
  await page.getByRole('button',{name:'この家具を配置'}).click();
  await expect(panel.getByRole('alert')).toContainText('再取り込みが必要');
  await page.getByLabel('左右位置 (X)').fill('1');
  await expect.poll(async()=> (await saved(page)).room.items.find(item=>item.type==='model').x).toBe(1);
});

test('読み込み途中に別ファイルへ差し替えると、遅れて完了した古いモデルを表示・配置しない',async({page})=> {
  await page.addInitScript(()=> {
    const original=File.prototype.arrayBuffer;
    File.prototype.arrayBuffer=function() {
      if (this.name==='遅い家具.glb') return original.call(this).then(bytes=>new Promise(resolve=> {window.completeOldModelRead=()=>resolve(bytes);}));
      return original.call(this);
    };
  });
  await openLayout(page); await page.locator('.furniture-importer summary').click();
  await page.getByLabel('家具モデル（GLB）').setInputFiles({name:'遅い家具.glb',mimeType:'model/gltf-binary',buffer:Buffer.from(furnitureGlb())});
  await expect(page.getByRole('status').filter({hasText:'家具モデルを読み込んでいます'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>typeof window.completeOldModelRead)).toBe('function');
  await upload(page);
  await expect(page.getByLabel('家具の名前',{exact:true})).toHaveValue('自作の机');
  await page.evaluate(()=>window.completeOldModelRead());
  await expect(page.getByLabel('家具の名前',{exact:true})).toHaveValue('自作の机');
  await page.getByRole('button',{name:'この家具を配置'}).click();
  await expect.poll(async()=> ((await saved(page))?.room.items ?? []).filter(item=>item.type==='model').map(item=>item.name)).toEqual(['自作の机']);
});
