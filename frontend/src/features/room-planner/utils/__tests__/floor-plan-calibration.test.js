import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calibrateFloorPlan, measurementLength } from '../floor-plan-calibration.js';
import { isFloorPlan } from '../floor-plan.js';
import { createLocalRoomStorage } from '../local-room-storage.js';
const plan = () => ({ version:1,name:'計測用',w:8,d:6,h:2.4,wallThickness:.12,
  floors:[{id:'floor',kind:'room',points:[[0,0],[8,0],[8,6],[0,6]]}],
  walls:[{id:'wall',start:[0,0],end:[8,0],thicknessRatio:2,openings:[{id:'window',kind:'window',offset:2,width:1,bottom:.8,height:1}]}] });

test('部屋をまたぐ一本の壁の一部分から、平面の比率と壁厚だけを補正する',()=>{
  const value=plan(),before=structuredClone(value),points=[[.25,0],[.5,0]];
  assert.equal(measurementLength(value,points),2);
  const next=calibrateFloorPlan(value,points,3);
  assert.ok(isFloorPlan(next));assert.equal(next.w,12);assert.equal(next.d,9);
  assert.deepEqual(next.walls[0].end,[12,0]);assert.equal(next.wallThickness,.18);
  assert.equal(next.walls[0].thicknessRatio,2);
  assert.deepEqual(next.walls[0].openings[0],{id:'window',kind:'window',offset:3,width:1.5,bottom:.8,height:1});
  assert.equal(next.h,2.4);assert.deepEqual(value,before);
});
test('壁や交点のない任意の2点、縦の区間、斜めの区間でも距離を求める',()=>{
  const value=plan();assert.ok(Math.abs(measurementLength(value,[[.1,.2],[.1,.7]])-3)<1e-12);
  assert.equal(measurementLength(value,[[0,0],[.5,.5]]),5);
  assert.equal(measurementLength(value,[[.5,.5],[0,0]]),5);
  const next=calibrateFloorPlan(value,[[.1,.2],[.6,.7]],5);
  assert.ok(Math.abs(measurementLength(next,[[.1,.2],[.6,.7]])-5)<1e-10);
});
test('同じ実測値を再適用しても二重に拡大しない',()=>{
  const points=[[.2,.3],[.7,.3]],first=calibrateFloorPlan(plan(),points,6);
  assert.deepEqual(calibrateFloorPlan(first,points,6),first);
});
test('不正な点・ゼロ距離・不正な実測値・範囲外の補正は適用しない',()=>{
  for(const points of [null,[],new Array(2),[[0,0]],[[0,0],[0,0]],[[0,0],[.00001,0]],[[NaN,0],[1,0]],[[0,0],[Infinity,1]],[[-.1,0],[1,0]],[[0,0],[1.1,0]]]) {
    assert.equal(measurementLength(plan(),points),null);assert.equal(calibrateFloorPlan(plan(),points,3),null);
  }
  for(const length of [0,-1,NaN,Infinity,'3',.01,1000,.02])assert.equal(calibrateFloorPlan(plan(),[[0,0],[1,0]],length),null);
  assert.equal(calibrateFloorPlan({},[[0,0],[1,0]],2),null);
  assert.equal(measurementLength(null,[[0,0],[1,0]]),null);
});
test('壁厚を黙って切り詰めず拒否し、補正した配置を第2版で保存・復元する',()=>{
  const value=plan();value.wallThickness=.8;
  assert.equal(calibrateFloorPlan(value,[[0,0],[.5,0]],8),null);
  const calibrated=calibrateFloorPlan(plan(),[[0,0],[.5,0]],6);let raw;
  const storage=createLocalRoomStorage(()=>({getItem:()=>raw,setItem:(_,v)=>{raw=v;}}));
  assert.equal(storage.save({planKey:'custom',items:[],customPlan:calibrated}).error,'');
  assert.deepEqual(storage.load().room.customPlan,calibrated);assert.equal(JSON.parse(raw).version,2);
});
