import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkingWorld, walkingStart, walkingStep, canWalk } from '../first-person.js';
const plan = { w:5, d:5, h:2.5 };
test('視線方向へ進み、左右移動と斜め移動の速さを揃える', () => {
  const world=walkingWorld('studio',plan), start=walkingStart(world);
  const ahead=walkingStep(world,start,0,1,0,.05), diagonal=walkingStep(world,start,0,1,1,.05);
  assert.equal(ahead[1],1.6); assert.ok(ahead[2]<0);
  assert.ok(Math.abs(Math.hypot(diagonal[0],diagonal[2])-Math.abs(ahead[2]))<1e-8);
  assert.ok(walkingStep(world,start,Math.PI/2,1,0,.05)[0]<0);
  assert.ok(walkingStep(world,start,0,0,1,.05)[0]>0);
  assert.deepEqual(walkingStep(world,start,0,0,0,.05),start);
  assert.deepEqual(walkingStep(world,start,0,1,0,NaN),start);
  assert.deepEqual(walkingStep(world,start,0,1,0,10),ahead);
});
test('外壁・回転した家具を避けて開始し、壁際では停止する', () => {
  const world=walkingWorld('studio',plan,[{x:0,z:0,w:1,d:1,h:1,rot:Math.PI/4}]);
  const start=walkingStart(world); assert.ok(start); assert.notDeepEqual(start,[0,1.6,0]);
  let position=start;
  for(let i=0;i<200;i++) position=walkingStep(world,position,0,0,1,.05);
  assert.ok(position[0]<plan.w/2-.15); assert.ok(canWalk(world,...[position[0],position[2]]));
  assert.equal(canWalk(world,0,0),false);
});
const custom = {w:5,d:5,h:2.5,wallThickness:.1,floors:[{points:[[0,0],[5,0],[5,5],[0,5]]}],walls:[{start:[0,2.5],end:[5,2.5],openings:[]}]};
test('薄い内壁をすり抜けず、扉の開口は通れる', () => {
  const world=walkingWorld('custom',custom); let position=[0,1.6,1];
  for(let i=0;i<60;i++) position=walkingStep(world,position,0,1,0,.05);
  assert.ok(position[2]>.19);
  const door=walkingWorld('custom',{...custom,walls:[{...custom.walls[0],openings:[{kind:'door',offset:2,width:1,height:2.1,bottom:0}]}]});
  position=[0,1.6,1]; for(let i=0;i<30;i++) position=walkingStep(door,position,0,1,0,.05);
  assert.ok(position[2]<-.5);
});
test('凹形の床の外へ出ず、立てる場所がない場合は開始しない', () => {
  const world=walkingWorld('custom',{...custom,walls:[],floors:[{points:[[0,0],[5,0],[5,2],[2,2],[2,5],[0,5]]}]});
  assert.equal(canWalk(world,0,0),false); assert.ok(walkingStart(world));
  const blocked=walkingWorld('studio',plan,[{x:0,z:0,w:5,d:5,h:2,rot:0}]);
  assert.equal(walkingStart(blocked),null);
});
