import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calibrateFloorPlan, calibrateFloorPlanByTatami, calibrateFloorPlanByPolygon, measurementArea, measurementLength, measurementPolygonArea } from '../floor-plan-calibration.js';
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

test('選んだ部屋の帖数から縦横比を保って全体を補正し、壁・開口の高さは維持する', () => {
  const value = plan(), before = structuredClone(value), points = [[.25, .25], [.75, .75]];
  assert.equal(measurementArea(value, points), 12);
  // 12m²の部屋を24m²とする。長さの倍率は面積倍率の平方根。
  const next = calibrateFloorPlanByTatami(value, points, 15, 1.6), factor = Math.sqrt(2);
  assert.ok(isFloorPlan(next));
  assert.ok(Math.abs(next.w - 8 * factor) < 1e-12);
  assert.equal(next.w / next.d, value.w / value.d);
  assert.ok(Math.abs(measurementArea(next, points) - 24) < 1e-12);
  assert.deepEqual(next.floors[0].points, value.floors[0].points.map(p => p.map(n => n * factor)));
  assert.deepEqual(next.walls[0].end, [8 * factor, 0]);
  assert.equal(next.wallThickness, .12 * factor);
  assert.equal(next.walls[0].thicknessRatio, 2);
  assert.deepEqual(next.walls[0].openings[0], { id: 'window', kind: 'window', offset: 2 * factor, width: factor, bottom: .8, height: 1 });
  assert.equal(next.h, value.h);
  assert.deepEqual(value, before);
  assert.equal(calibrateFloorPlanByTatami(next, points, 15, 1.6), next);
});

test('対角点の指定順を問わず、小数の帖数と任意の換算値を使い、一辺の実測補正とも切り替えられる', () => {
  const value = plan(), points = [[.75, .25], [.25, .75]];
  assert.equal(measurementArea(value, points), 12);
  assert.equal(measurementArea(value, [...points].reverse()), 12);
  const next = calibrateFloorPlanByTatami(value, points, 6.5, 1.62);
  assert.ok(Math.abs(measurementArea(next, points) - 10.53) < 1e-12);
  const regional = calibrateFloorPlanByTatami(next, points, 6.5, 1.824);
  assert.ok(Math.abs(measurementArea(regional, points) - 11.856) < 1e-12);
  const measured = calibrateFloorPlan(regional, [[0, 0], [1, 0]], 8);
  assert.ok(Math.abs(measured.w - 8) < 1e-12);
});

test('不正な対象領域や帖数・換算値、積の桁あふれと補正後の範囲外を拒否する', () => {
  const value = plan(), points = [[.25, .25], [.75, .75]];
  for (const invalid of [null, [], new Array(2), [[0, 0]], [[0, 0], [0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]],
    [[0, 0], [.001, .5]], [[0, 0], [.5, .001]], [[NaN, 0], [1, 1]], [[0, 0], [Infinity, 1]], [[-.1, 0], [1, 1]], [[0, 0], [1, 1.1]], [new Array(2), [1, 1]]]) {
    assert.equal(measurementArea(value, invalid), null);
    assert.equal(calibrateFloorPlanByTatami(value, invalid, 6, 1.62), null);
  }
  for (const invalid of [0, -1, NaN, Infinity, '6', null, undefined]) {
    assert.equal(calibrateFloorPlanByTatami(value, points, invalid, 1.62), null);
    assert.equal(calibrateFloorPlanByTatami(value, points, 6, invalid), null);
  }
  for (const tatami of [Number.MIN_VALUE, .001, 1e5, Number.MAX_VALUE]) {
    assert.equal(calibrateFloorPlanByTatami(value, points, tatami, 1.62), null);
  }
  assert.equal(calibrateFloorPlanByTatami({}, points, 6, 1.62), null);
  assert.equal(measurementArea(null, points), null);
  assert.equal(measurementArea(value, [[0, 0], [.0025, 1]]), .12);
  // 壁厚の上下限も一辺の補正と同じ検証を通す。
  const thick = { ...value, wallThickness: 1 };
  assert.equal(calibrateFloorPlanByTatami(thick, points, 24, 1), null);
  const thin = { ...value, wallThickness: .05 };
  assert.equal(calibrateFloorPlanByTatami(thin, points, 6, 1), null);
  assert.equal(calibrateFloorPlanByTatami(thick, points, 12, 1), thick);
});

test('L字の部屋は包囲矩形ではなく輪郭の面積から補正し、再適用でも形と高さを保つ', () => {
  const value = plan(), before = structuredClone(value);
  const points = [[0,0],[1,0],[1,.5],[.5,.5],[.5,1],[0,1]];
  assert.equal(measurementPolygonArea(value, points), 36);
  assert.equal(measurementPolygonArea(value, [...points].reverse()), 36);
  const next = calibrateFloorPlanByPolygon(value, points, 6.5, 1.62);
  const factor = Math.sqrt((6.5 * 1.62) / 36);
  assert.ok(isFloorPlan(next)); assert.equal(next.w, value.w * factor);
  assert.ok(Math.abs(measurementPolygonArea(next, points) - 10.53) < 1e-12);
  assert.equal(next.wallThickness, value.wallThickness * factor);
  assert.equal(next.walls[0].thicknessRatio, 2); assert.equal(next.h, value.h);
  assert.equal(next.walls[0].openings[0].height, 1);
  assert.equal(calibrateFloorPlanByPolygon(next, points, 6.5, 1.62), next);
  assert.deepEqual(value, before);
});

test('斜めの辺がある部屋も面積を求め、交差・重複・点不足・不正座標は補正しない', () => {
  const value = plan();
  assert.equal(measurementPolygonArea(value, [[0,0],[1,0],[.5,1]]), 24);
  for (const points of [null, [], [[0,0],[1,1]], new Array(3), [[0,0],[1,1],[1,0],[0,1]],
    [[0,0],[1,0],[1,0],[0,1]], [[0,0],[.5,0],[1,0]], [[0,0],[1,0],[0,1],[0,0]],
    [[0,0],[Infinity,0],[0,1]], [[0,0],[1,0],[0,1.1]], Array.from({length:65}, () => [0,0])]) {
    assert.equal(measurementPolygonArea(value, points), null);
    assert.equal(calibrateFloorPlanByPolygon(value, points, 6, 1.62), null);
  }
  assert.equal(measurementPolygonArea(null, [[0,0],[1,0],[0,1]]), null);
  for (const number of [0, -1, Infinity, NaN, '6', 1e100]) {
    assert.equal(calibrateFloorPlanByPolygon(value, [[0,0],[1,0],[0,1]], number, 1.62), null);
  }
});
