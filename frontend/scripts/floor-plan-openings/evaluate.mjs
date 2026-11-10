import { readFile, writeFile } from 'node:fs/promises';
const directory = new URL('../../docs/floor-plan-opening-experiment-assets/', import.meta.url);
const references = JSON.parse(await readFile(new URL('./references.json', import.meta.url), 'utf8'));
const initial = JSON.parse(await readFile(new URL('./references-initial.json', import.meta.url), 'utf8'));
const rows = JSON.parse(await readFile(new URL('run.json', directory), 'utf8'));
function audit(candidates, reference) {
  const matched = new Set(), falseCenters = [], unreviewed = [];
  const circles = candidates.some(c => c.kind === 'circle');
  for (const [i,c] of candidates.entries()) {
    const [x,y] = c.center;
    if (reference.negative.some(([x1,y1,x2,y2])=>x>=x1&&x<=x2&&y>=y1&&y<=y2)) {falseCenters.push(i);continue;}
    const hit = !circles && reference.positive.findIndex((r,index)=>{
      if(matched.has(index)||(r.kind!=='opening'&&c.kind!==r.kind))return false;
      const [x1,y1,x2,y2] = r.segment,axis=Math.abs(x2-x1)>Math.abs(y2-y1)?0:1;
      if(c.axis!==axis)return false;
      const center=axis?(x1+x2)/2:(y1+y2)/2;
      if(Math.abs(c.center[1-axis]-center)>5)return false;
      const from=axis?Math.min(y1,y2):Math.min(x1,x2),to=axis?Math.max(y1,y2):Math.max(x1,x2);
      const length=to-from,ratio=(c.to[axis]-c.from[axis])/length;
      const overlap=Math.max(0,Math.min(to,c.to[axis])-Math.max(from,c.from[axis]));
      return ratio>=.5&&ratio<=1.8&&overlap/length>=.35;
    });
    if(typeof hit==='number'&&hit>=0)matched.add(hit);else unreviewed.push(i);
  }
  return {matchedPositive:circles?null:matched.size,positiveCount:reference.positive.length,matchedIndices:[...matched],falseCenterCount:falseCenters.length,falseCenters,unreviewedCount:unreviewed.length};
}
const results=[];
for(const row of rows){
  const raw=JSON.parse(await readFile(new URL(`raw/${row.mode}-${row.image}.json`,directory),'utf8'));
  const candidates=raw.openingCandidates??[];
  results.push({...row,partialAudit:audit(candidates,references.images[row.image]),initialAudit:audit(candidates,initial.images[row.image])});
}
await writeFile(new URL('evaluation.json',directory),JSON.stringify({description:'選んだ24記号の部分評価。注釈の事後監査を含む。候補外の扉・窓は分母に含まれず、未監査候補を誤検出扱いしない。全体の適合率・再現率ではない。',rows:results},null,2)+'\n');
console.table(results.filter(r=>['geometry','strict','verified','verified-apply'].includes(r.mode)).map(r=>({image:r.image,mode:r.mode,doors:r.doors,bands:r.windowBands,selectedHits:r.partialAudit.matchedPositive,negativeCenters:r.partialAudit.falseCenterCount,applied:r.applied.length,missingWallPoints:r.metrics.missingWallPoints})));
