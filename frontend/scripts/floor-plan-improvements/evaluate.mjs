import { readFile, writeFile } from 'node:fs/promises';
import { evaluateLayoutReferences, evaluateWallReferences } from '../../src/features/room-planner/utils/floor-plan-evaluation.js';
const directory = new URL('../../docs/floor-plan-improvement-assets/', import.meta.url);
const old = JSON.parse(await readFile(new URL('../../e2e/fixtures/floor-plans/references.json', import.meta.url), 'utf8'));
const extra = JSON.parse(await readFile(new URL('../../e2e/fixtures/floor-plans/holdout/references-audited.json', import.meta.url), 'utf8'));
Object.assign(old.images, extra.images);
const rows = JSON.parse(await readFile(new URL('run.json', directory), 'utf8'));
const inside = ([x, y], points) => {
  let value = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [a, b] = points[i], [c, d] = points[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) value = !value;
  }
  return value;
};
const floorProbes = {
  colored: { floorInside: [[200, 100], [200, 300], [300, 430], [320, 365]], floorOutside: [[380, 400], [350, 480]] },
  textured: { floorInside: [[175, 45], [150, 350], [300, 350]], floorOutside: [[100, 45], [320, 45]] },
};
const metrics = [];
for (const row of rows) {
  const data = JSON.parse(await readFile(new URL(`models/${row.mode}-${row.image}.json`, directory), 'utf8'));
  const { plan, width, height } = data, reference = old.images[row.image];
  const point = ([x, y]) => [x / plan.w * width, y / plan.d * height];
  const lines = plan.walls.map(wall => [...point(wall.start), ...point(wall.end)]);
  const probe = floorProbes[row.image] ?? reference;
  const hasFloor = p => data.floors.some(floor => inside(p, floor.outer));
  const current = { ...row, metrics: { ...evaluateWallReferences(lines, reference, old.tolerance), ...evaluateLayoutReferences(plan, reference) },
    floorInsideMissing: (probe.floorInside ?? []).filter(p => !hasFloor(p)).length,
    floorOutsideCovered: (probe.floorOutside ?? []).filter(hasFloor).length,
    floorInsideProbeCount: probe.floorInside?.length ?? 0, floorOutsideProbeCount: probe.floorOutside?.length ?? 0 };
  metrics.push(current);
}
await writeFile(new URL('metrics-audited.json', directory), JSON.stringify({ annotationSource: 'references-audited.json',
  note: '追加図面の注釈修正。run.jsonは初回固定版での数値を維持。colored/texturedの床点は出力を見て失敗箇所として追加した探索用の回帰点。', floorProbes, rows: metrics }, null, 2) + '\n');
console.table(metrics.map(r => ({ image: r.image, mode: r.mode, coverage: (r.metrics.coverage * 100).toFixed(2), noise: r.metrics.nonWallLength.toFixed(2), blocked: r.metrics.blockedOpenings, floorMissing: r.floorInsideMissing, floorOutside: r.floorOutsideCovered })));
