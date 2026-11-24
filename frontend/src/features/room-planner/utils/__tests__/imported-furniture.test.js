import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalRoomStorage, LOCAL_ROOM_KEY } from '../local-room-storage.js';
import { applyRoomOperation, isRoomLayout, isRoomSnapshot } from '../room-state.js';
import { createRoomSession } from '../room-session.js';
import { loadFurnitureAsset, saveFurnitureAsset } from '../furniture-asset-storage.js';
import { newDrawing } from '../drawing-document.js';
import { furnitureGlb } from './helpers/furniture-glb.js';

const model = () => ({ id:'model-1',type:'model',name:'自作の机',w:1.2,d:.6,h:.8,x:0,z:0,rot:0,color:'#ffffff',
  assetId:'a'.repeat(64),modelUp:'y',modelFront:0 });
const room = () => ({planKey:'studio',items:[model()]});
function localStorage() {
  const data=new Map();
  return {data,local:createLocalRoomStorage(()=>({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}))};
}

test('取込家具を含むプリセットとcustom配置を第3版で保存し、形状・モデル参照・向きを復元する',()=> {
  const {local,data}=localStorage();
  for (const layout of [room(),{planKey:'custom',customPlan:newDrawing(),items:[model()]}]) {
    assert.ok(isRoomLayout(layout));
    assert.equal(local.save(layout).error,'');
    assert.equal(JSON.parse(data.get(LOCAL_ROOM_KEY)).version,3);
    assert.deepEqual(local.load().room,layout);
    const changed=applyRoomOperation(layout,{type:'rotate',id:'model-1'});
    assert.equal(changed.items[0].rot,Math.PI/2);
    assert.equal(local.save(changed).error,'');
    assert.equal(local.load().room.items[0].assetId,model().assetId);
  }
});

test('不正なモデル参照・向き・寸法や旧版への混入を拒否し、直前の保存を維持する',()=> {
  const {local,data}=localStorage(); local.save(room());
  const before=data.get(LOCAL_ROOM_KEY);
  for (const patch of [{assetId:'blob:old'},{assetId:'../a'},{modelUp:'q'},{modelFront:4},{modelFront:.5},{w:.019},{h:20.01}]) {
    const layout={...room(),items:[{...model(),...patch}]};
    assert.equal(isRoomLayout(layout),false);
    assert.ok(local.save(layout).error); assert.equal(data.get(LOCAL_ROOM_KEY),before);
  }
  for (const version of [1,2]) {
    data.set(LOCAL_ROOM_KEY,JSON.stringify({version,room:room()})); assert.ok(local.load().error);
  }
  data.set(LOCAL_ROOM_KEY,JSON.stringify({version:3,room:{...room(),items:[]}})); assert.ok(local.load().error);
});

test('最後の取込家具を削除すると従来の保存版へ戻り、モデル本体を配置JSONへ混ぜない',()=> {
  const {local,data}=localStorage(); local.save(room());
  assert.equal(data.get(LOCAL_ROOM_KEY).includes('bytes'),false);
  assert.equal(local.save(applyRoomOperation(room(),{type:'remove',id:'model-1'})).error,'');
  assert.equal(JSON.parse(data.get(LOCAL_ROOM_KEY)).version,1);
});

test('取込家具を共有snapshotで受け入れず、部屋作成APIも呼び出さない',async()=> {
  const snapshot={...room(),id:'a'.repeat(32),revision:0,planVersion:0,appliedOperationIds:[]};
  assert.equal(isRoomSnapshot(snapshot),false);
  const session=createRoomSession({api:{configured:true,create:()=>assert.fail('取込家具を外部へ送信した')},initialRoom:room()});
  session.start(); assert.equal(await session.share(),null);
  assert.match(session.getSnapshot().error,/取り込んだ家具/); assert.equal(session.getSnapshot().status,'local');
  session.stop();
});

test('共同編集中のモデル追加とモデル参照の更新を送信待ちへ入れない',async()=> {
  const snapshot={planKey:'studio',items:[],id:'a'.repeat(32),revision:0,planVersion:0,appliedOperationIds:[]};
  let handlers;
  const session=createRoomSession({api:{configured:true,get:async()=>snapshot,subscribe:(_,value)=>{handlers=value;return()=>{};},send:()=>assert.fail('モデル操作を送信した')},initialRoom:room(),roomId:snapshot.id});
  session.start(); await new Promise(setImmediate); handlers.state(snapshot);
  for (const operation of [{type:'add',item:model()},{type:'change-plan',planKey:'studio',items:[model()]},
    {type:'update',id:'model-1',patch:{assetId:model().assetId}}]) assert.equal(session.dispatch(operation),false);
  assert.equal(session.getSnapshot().pending,0); session.stop();
});

test('モデル保存領域が使えなくても原本をこの画面で利用でき、同じ内容は同じIDになる',async()=> {
  const bytes=furnitureGlb();
  const first=await saveFurnitureAsset(bytes),second=await saveFurnitureAsset(bytes.slice(0));
  assert.ok(first.error); assert.equal(first.assetId,second.assetId);
  assert.deepEqual(await loadFurnitureAsset(first.assetId),bytes);
  await assert.rejects(loadFurnitureAsset('b'.repeat(64)));
});
