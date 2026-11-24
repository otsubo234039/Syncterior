import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Box3, Vector3 } from 'three';
import { inspectFurnitureGlb } from '../furniture-glb.js';
import { disposeFurnitureInstance, disposeFurnitureModel, fitFurnitureModel, furnitureModelSize, loadFurnitureModel } from '../furniture-model.js';
import { MODEL_UP_AXES } from '../imported-furniture.js';
import { furnitureGlb } from './helpers/furniture-glb.js';

test('自己完結した机のGLBを読み込み、元の座標から独立して実寸と接地位置を合わせる', async () => {
  const bytes = furnitureGlb();
  assert.deepEqual(inspectFurnitureGlb(bytes), { triangles: 60 });
  const model = await loadFurnitureModel(bytes);
  assert.ok(Math.abs(model.size.w - 1.2) < 1e-7);
  for (const modelUp of MODEL_UP_AXES) for (const modelFront of [0,1,2,3]) {
    const object = fitFurnitureModel(model.scene, { w: 2, d: 1, h: .7, modelUp, modelFront, color: '#ffffff' });
    const box = new Box3().setFromObject(object, true), size = box.getSize(new Vector3());
    assert.ok(Math.abs(size.x-2)<1e-7 && Math.abs(size.z-1)<1e-7 && Math.abs(size.y-.7)<1e-7);
    assert.ok(Math.abs(box.min.y)<1e-7 && Math.abs(box.min.x+1)<1e-7 && Math.abs(box.min.z+.5)<1e-7);
    disposeFurnitureInstance(object);
  }
  assert.ok(Math.abs(furnitureModelSize(model.scene, 'y', 0).w - 1.2) < 1e-7);
  disposeFurnitureModel(model.scene);
});

test('同じモデルの複数配置で位置と色味を独立させ、元の材質を保持する', async () => {
  const model = await loadFurnitureModel(furnitureGlb());
  const options = { w:1.2,d:.6,h:.8,modelUp:'y',modelFront:0,color:'#ffffff' };
  const a = fitFurnitureModel(model.scene,options), b = fitFurnitureModel(model.scene,{ ...options,color:'#123456' });
  const mesh = root => { let first; root.traverse(child=> { if (child.isMesh && !first) first=child; }); return first; };
  assert.notEqual(mesh(a).material,mesh(b).material);
  assert.notEqual(mesh(a).material.color.getHexString(),mesh(b).material.color.getHexString());
  assert.equal(mesh(a).material.color.getHexString(),mesh(model.scene).material.color.getHexString());
  a.position.x = 1; assert.equal(b.position.x,0);
  disposeFurnitureInstance(a); disposeFurnitureInstance(b); disposeFurnitureModel(model.scene);
});

const invalid = [
  ['外部バッファ', json=> { json.buffers[0].uri='https://example.com/model.bin'; }],
  ['外部画像', json=> { json.images=[{uri:'https://example.com/a.png'}]; }],
  ['埋め込みURL画像', json=> { json.images=[{uri:'data:image/png;base64,AA=='}]; }],
  ['圧縮拡張', json=> { json.extensionsUsed=['KHR_draco_mesh_compression']; }],
  ['アニメーション', json=> { json.animations=[{}]; }],
  ['骨格', json=> { json.skins=[{}]; }],
  ['循環ノード', json=> { json.nodes[1].children=[0]; }],
  ['ノードの重複', json=> { json.nodes[0].children.push(1); }],
  ['参照先の欠落', json=> { json.nodes[1].mesh=99; }],
  ['過大な三角形数', json=> { json.accessors[1].count=300_000; }],
  ['過大な頂点数', json=> { json.accessors[0].count=300_001; }],
  ['空の形状', json=> { json.meshes=[]; }],
  ['範囲外のバッファ', json=> { json.bufferViews[0].byteOffset=999999; }],
  ['不正な変換', json=> { json.nodes[0].translation=[null,0,0]; }],
  ['複数シーン', json=> { json.scenes.push({nodes:[]}); }],
  ['未接続のノード', json=> { json.nodes.push({mesh:0}); }],
  ['不正な配列構造', json=> { json.nodes[0].children={}; }],
  ['過大な埋め込み画像', (json,binary)=> {
    const view=new DataView(binary.buffer);
    view.setUint32(0,0x89504e47); view.setUint32(4,0x0d0a1a0a); view.setUint32(12,0x49484452);
    view.setUint32(16,2049); view.setUint32(20,1);
    json.images=[{bufferView:0,mimeType:'image/png'}];
  }],
];
for (const [name, edit] of invalid) test(`${name}をGLTFLoaderの実行前に拒否する`,()=> {
  assert.throws(()=>inspectFurnitureGlb(furnitureGlb(edit)));
});

test('壊れたヘッダー・切れたチャンク・上限超過のファイルを拒否する',()=> {
  const original = furnitureGlb();
  for (const length of [0,12,27,original.byteLength-1]) assert.throws(()=>inspectFurnitureGlb(original.slice(0,length)));
  const bytes=original.slice(0); new DataView(bytes).setUint32(4,1,true);
  assert.throws(()=>inspectFurnitureGlb(bytes));
  assert.throws(()=>inspectFurnitureGlb(new ArrayBuffer(20*1024*1024+1)));
});

test('不正な実頂点とゼロ寸法を拒否し、中止済みの読み込みを開始しない',async()=> {
  await assert.rejects(loadFurnitureModel(furnitureGlb((_,binary)=>new DataView(binary.buffer).setFloat32(0,NaN,true))));
  await assert.rejects(loadFurnitureModel(furnitureGlb((_,binary)=>new DataView(binary.buffer).setUint16(96,99,true))));
  await assert.rejects(loadFurnitureModel(furnitureGlb(json=> { json.nodes[0].scale=[0,1,1]; })));
  const controller=new AbortController(); controller.abort();
  await assert.rejects(loadFurnitureModel(furnitureGlb(),controller.signal),{name:'AbortError'});
  const pendingController=new AbortController();
  const pending=loadFurnitureModel(furnitureGlb(),pendingController.signal); pendingController.abort();
  await assert.rejects(pending,{name:'AbortError'});
  const model=await loadFurnitureModel(furnitureGlb());
  for (const w of [0,-1,NaN,Infinity,20.001]) assert.throws(()=>fitFurnitureModel(model.scene,{w,d:1,h:1,modelUp:'y',modelFront:0}));
  disposeFurnitureModel(model.scene);
});
