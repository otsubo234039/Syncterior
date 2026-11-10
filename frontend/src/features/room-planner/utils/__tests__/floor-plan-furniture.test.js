import assert from 'node:assert/strict';
import { test } from 'node:test';
import { constrainFurnitureToRoom } from '../furniture-bounds.js';
import { findFurniturePosition } from '../floor-plan-furniture.js';
import { applyRoomOperation, isRoomLayout, isRoomSnapshot } from '../room-state.js';
import { createLocalRoomStorage } from '../local-room-storage.js';

const plan = () => ({ version: 1, name: '家具配置用', w: 8, d: 6, h: 2.5, wallThickness: .2,
  floors: [{ id: 'floor', kind: 'room', points: [[0,0],[8,0],[8,6],[0,6]] }],
  walls: [{ id: 'wall', start: [4,0], end: [4,6], openings: [] }] });
const furniture = (patch={}) => ({ id:'desk',type:'desk',name:'デスク',w:1,d:.6,h:.8,color:'#abcdef',x:-2,z:0,rot:0,...patch });
const room = () => ({ planKey:'custom',customPlan:plan(),items:[furniture()] });

test('取込間取りへ床と壁に収まる家具を追加し、移動・回転・色変更・削除できる', () => {
  const value={...room(),items:[]};
  let next=applyRoomOperation(value,{type:'add',item:furniture()});
  assert.equal(next.items.length,1);
  next=applyRoomOperation(next,{type:'update',id:'desk',patch:{x:-1,color:'#123456'}});
  next=applyRoomOperation(next,{type:'rotate',id:'desk'});
  assert.equal(next.items[0].rot,Math.PI/2);
  assert.equal(next.items[0].x,-1);
  assert.equal(next.items[0].color,'#123456');
  assert.equal(applyRoomOperation(next,{type:'remove',id:'desk'}).items.length,0);
  assert.equal(value.items.length,0);
});
test('壁への移動と回転を拒否し、元の位置と向きを維持する', () => {
  const value=room();
  assert.equal(applyRoomOperation(value,{type:'update',id:'desk',patch:{x:0}}).items[0],value.items[0]);
  const near={...value,items:[furniture({x:-.5,w:.6,d:1.2})]};
  assert.equal(applyRoomOperation(near,{type:'rotate',id:'desk'}).items[0],near.items[0]);
  assert.equal(constrainFurnitureToRoom(furniture({rot:Math.PI/4,x:-.2}),plan()),null);
});
test('扉の開口を通れる家具だけ受け入れ、窓の腰壁と垂れ壁を避ける', () => {
  const value=plan();
  value.walls[0].openings=[{id:'door',kind:'door',offset:2,width:2,bottom:0,height:2}];
  assert.ok(constrainFurnitureToRoom(furniture({x:0}),value));
  assert.equal(constrainFurnitureToRoom(furniture({x:0,h:2.1}),value),null);
  value.walls[0].openings=[{id:'window',kind:'window',offset:2,width:2,bottom:1,height:1}];
  assert.equal(constrainFurnitureToRoom(furniture({x:0}),value),null);
});
test('四隅が床にあっても凹んだ部分をまたぐ家具を拒否する', () => {
  const value=plan(); value.walls=[];
  value.floors[0].points=[[0,0],[8,0],[8,6],[5,6],[5,2],[3,2],[3,6],[0,6]];
  assert.equal(constrainFurnitureToRoom(furniture({x:0,z:0,w:6,d:1}),value),null);
});
test('中央が壁なら追加時だけ別の位置を探し、収まらない家具は追加しない', () => {
  const value=plan(), item=findFurniturePosition(furniture({x:0}),value);
  assert.ok(item); assert.notEqual(item.x,0);
  assert.ok(constrainFurnitureToRoom(item,value));
  assert.equal(findFurniturePosition(furniture({w:20}),value),null);
});
test('家具付き取込間取りを第2版で復元し、不正な配置の保存と共有を拒否する', () => {
  const data=new Map();
  const storage=createLocalRoomStorage(()=>({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}));
  const value=room();
  assert.equal(isRoomLayout(value),true);
  assert.equal(storage.save(value).error,'');
  assert.deepEqual(storage.load().room,value);
  assert.equal(isRoomSnapshot({...value,id:'a'.repeat(32),revision:0,planVersion:0,appliedOperationIds:[]}),false);
  const invalid={...value,items:[furniture({x:0})]};
  assert.equal(isRoomLayout(invalid),false);
  assert.notEqual(storage.save(invalid).error,'');
  assert.equal(applyRoomOperation(value,{type:'change-plan',...invalid}),value);
});

test('家具を含む図面の補正は実寸を維持し、補正先の壁に重なる場合は適用しない',()=>{
  const value=room(), nextPlan=plan();
  nextPlan.w=10;nextPlan.floors[0].points=[[0,0],[10,0],[10,6],[0,6]];
  const next=applyRoomOperation(value,{type:'change-plan',planKey:'custom',customPlan:nextPlan,items:value.items});
  assert.deepEqual(next.items,value.items);
  nextPlan.walls[0].start=[3,0];nextPlan.walls[0].end=[3,6];
  assert.equal(applyRoomOperation(value,{type:'change-plan',planKey:'custom',customPlan:nextPlan,items:value.items}),value);
});

test('斜めの壁と壁固有の厚さにも実描画と同じ外形で衝突を判定する',()=>{
  const value=plan();value.walls=[{id:'diagonal',start:[0,0],end:[8,6],openings:[],thicknessRatio:3}];
  assert.equal(constrainFurnitureToRoom(furniture({x:0,z:0,rot:Math.PI/4}),value),null);
  assert.ok(constrainFurnitureToRoom(furniture({x:-2,z:2}),value));
  const straight=plan();straight.walls[0].thicknessRatio=3;
  assert.equal(constrainFurnitureToRoom(furniture({x:-.7}),straight),null);
  straight.walls[0].thicknessRatio=1;
  assert.ok(constrainFurnitureToRoom(furniture({x:-.7}),straight));
});

const drag = (value, patch) => applyRoomOperation(value, { type:'update', id:'desk', patch, slideAlongWalls:true });
test('壁へ斜めにドラッグすると接触位置まで進み、壁沿いの移動を失わない',()=>{
  let value=room();
  value=drag(value,{x:-.4,z:.4});
  assert.ok(Math.abs(value.items[0].x+.6)<1e-6);
  assert.equal(value.items[0].z,.4);
  for (const z of [.6,.8,1]) {
    value=drag(value,{x:-.3,z});
    assert.ok(Math.abs(value.items[0].x+.6)<1e-6);
    assert.equal(value.items[0].z,z);
    assert.ok(constrainFurnitureToRoom(value.items[0],value.customPlan));
  }
  assert.equal(drag(value,{x:-1,z:1.2}).items[0].x,-1);
});
test('壁を反対側まで越えた要求位置は採用し、数値入力では接触補正しない',()=>{
  const value=room();
  assert.equal(drag(value,{x:1,z:.5}).items[0].x,1);
  assert.equal(applyRoomOperation(value,{type:'update',id:'desk',patch:{x:-.4,z:.5}}).items[0],value.items[0]);
  assert.equal(drag(value,{x:NaN,z:1}).items[0],value.items[0]);
});
test('斜めの壁でも回転した家具の接線方向の移動量を維持する',()=>{
  const value=room();
  value.customPlan.walls=[{id:'diagonal',start:[1,0],end:[7,6],openings:[]}];
  value.items=[furniture({x:-1,z:0,rot:Math.PI/4})];
  const next=drag(value,{x:-.2,z:.4}).items[0];
  assert.notEqual(next,value.items[0]);
  assert.ok(Math.abs((next.x+next.z)-.2)<1e-6);
  assert.ok(constrainFurnitureToRoom(next,value.customPlan));
});
test('壁の角で接触を続けても中央へ移さず、両方の壁と床に収める',()=>{
  const value=room();
  value.customPlan.walls.push({id:'horizontal',start:[0,4],end:[4,4],openings:[]});
  const next=drag(value,{x:-.4,z:.8}).items[0];
  assert.ok(next.x<-.59);assert.ok(next.z<.71);
  assert.ok(constrainFurnitureToRoom(next,value.customPlan));
  assert.equal(next.id,value.items[0].id);
});
