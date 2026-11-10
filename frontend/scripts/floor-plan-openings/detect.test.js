import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { detectOpeningCandidates } from './detect.js';
import { applyOpeningCandidates } from './apply.js';
import { floorPlanFromLines } from '../../src/features/room-planner/utils/floor-plan-detection.js';
import { isFloorPlan, wallPieces } from '../../src/features/room-planner/utils/floor-plan.js';
const cv = createRequire(import.meta.url)('@techstark/opencv-js');
if (!cv.Mat) await new Promise(resolve => cv.then(() => resolve()));
function fixture(kind='door') {
  const width=240,height=200,pixels=new Uint8ClampedArray(width*height*4);pixels.fill(255);
  const dot=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<width&&y<height)pixels.set([25,25,25,255],(y*width+x)*4);};
  const line=(a,b,thickness=1)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2);for(let i=0;i<=n;i++)for(let d=0;d<thickness;d++)dot(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n+d);};
  line([20,60],[80,60],5);line([110,60],[210,60],5);
  if(kind==='door'||kind==='dashed'){
    line([80,60],[80,90]);
    for(let i=0;i<=180;i++)if(kind!=='dashed'||Math.floor(i/7)%2===0){const a=i/180*Math.PI/2;dot(80+30*Math.cos(a),60+30*Math.sin(a));}
  }
  if(kind==='window'){line([80,60],[110,60]);line([80,64],[110,64]);}
  if(kind==='solid')line([80,60],[110,60],5);
  return {width,height,pixels:pixels.buffer,lines:[20,62,80,62,110,62,210,62],lineWidths:[5,5],strokeWidth:5};
}
for(const [name,kind] of [['連続した円弧','door'],['破線の円弧','dashed']])test(`${name}と扉板を壁の隙間へ対応付ける`,()=>{
  const found=detectOpeningCandidates(fixture(kind),'geometry',cv,()=>assert.fail('幾何照合ではMatを作らない'));
  assert.ok(found.some(c=>c.kind==='door'&&Math.abs(c.center[0]-95)<3),JSON.stringify(found));
});
test('平行な細線の帯を窓らしい候補にし、扉とは断定しない',()=>{
  const found=detectOpeningCandidates(fixture('window'),'geometry',cv,()=>{});
  assert.ok(found.some(c=>c.kind==='window-band'));
  assert.equal(found.some(c=>c.kind==='door'),false);
});
for(const kind of ['blank','solid'])test(`${kind==='blank'?'白い隙間だけ':'太い実壁'}では建具を確定しない`,()=>{
  assert.deepEqual(detectOpeningCandidates(fixture(kind),'geometry',cv,()=>{}),[]);
});
test('開口変換が入力を変更せず、壁を接続して戸口と上部の壁を表現する',()=>{
  const input=fixture(),plan=floorPlanFromLines(input),before=structuredClone(plan);
  const found=detectOpeningCandidates(input,'geometry',cv,()=>{});
  const result=applyOpeningCandidates(plan,found,input.width,input.height);
  assert.deepEqual(plan,before);assert.ok(isFloorPlan(result.plan));assert.ok(result.applied.length>0);
  const host=result.plan.walls.find(w=>w.openings.length);
  assert.equal(host.openings[0].kind,'door');
  assert.ok(wallPieces(host,result.plan).some(p=>Math.abs(p.position[1]+p.size[1]/2-result.plan.h)<1e-7));
});
test('手動の開口・不正な候補・重複候補を保護する',()=>{
  const input=fixture(),plan=floorPlanFromLines(input),found=detectOpeningCandidates(input,'geometry',cv,()=>{});
  const first=applyOpeningCandidates(plan,found,input.width,input.height);
  const second=applyOpeningCandidates(first.plan,[...found,{kind:'door',from:[NaN,0],to:[0,1]}],input.width,input.height);
  assert.deepEqual(second.plan,first.plan);assert.equal(second.applied.length,0);
  assert.ok(second.rejected.some(r=>r.reason==='既存の開口を保護'));
  assert.throws(()=>applyOpeningCandidates({},[],240,200),/不正/);
});

test('厳格な照合でも合成扉を残し、種類未確定の窓帯を自動で開口にしない',()=>{
  const door=fixture(),found=detectOpeningCandidates(door,'strict',cv,()=>{});
  assert.ok(found.some(c=>c.kind==='door'));
  assert.ok(applyOpeningCandidates(floorPlanFromLines(door),found,door.width,door.height,true).applied.length);
  const window=fixture('window'),candidates=detectOpeningCandidates(window,'strict',cv,()=>{});
  const result=applyOpeningCandidates(floorPlanFromLines(window),candidates,window.width,window.height,true);
  assert.equal(result.applied.length,0);assert.ok(result.rejected.some(r=>r.reason.includes('高さ')));
});

test('窓の試験変換では腰壁を残して上側を開ける',()=>{
  const input=fixture('window'),found=detectOpeningCandidates(input,'geometry',cv,()=>{});
  const result=applyOpeningCandidates(floorPlanFromLines(input),found,input.width,input.height);
  const host=result.plan.walls.find(w=>w.openings.length);assert.ok(host);
  const o=host.openings[0],at=host.start[0]+o.offset+o.width/2-result.plan.w/2;
  const solid=y=>wallPieces(host,result.plan).some(p=>Math.abs(at-p.position[0])<p.size[0]/2-1e-7&&Math.abs(y-p.position[1])<p.size[1]/2-1e-7);
  assert.equal(solid(.5),true);assert.equal(solid(1.2),false);
});

test('厳格な変換は開口途中に直交する短い壁を保護する',()=>{
  const input=fixture(),plan=floorPlanFromLines(input),found=detectOpeningCandidates(input,'strict',cv,()=>{});
  plan.walls.push({id:'cross',start:[95*plan.w/240,62*plan.d/200],end:[95*plan.w/240,100*plan.d/200],openings:[]});
  assert.ok(isFloorPlan(plan));
  const result=applyOpeningCandidates(plan,found,input.width,input.height,true);
  assert.deepEqual(result.plan,plan);assert.ok(result.rejected.some(r=>r.reason.includes('直交')));
});

test('円弧らしい画素があっても実壁を扉板に使わない',()=>{
  const input=fixture(),pixels=new Uint8ClampedArray(input.pixels);
  for(let y=60;y<=90;y++)for(let x=78;x<=82;x++)pixels.set([25,25,25,255],(y*240+x)*4);
  input.lines.push(80,60,80,90);input.lineWidths.push(5);
  assert.ok(detectOpeningCandidates(input,'geometry',cv,()=>{}).some(c=>c.kind==='door'));
  assert.equal(detectOpeningCandidates(input,'verified',cv,()=>{}).some(c=>c.kind==='door'),false);
});

test('壁保護付きの照合でも薄い扉板と孤立した円弧を認識する',()=>{
  const input=fixture();
  assert.ok(detectOpeningCandidates(input,'verified',cv,()=>{}).some(c=>c.kind==='door'));
});
