import { wallPieces } from './floor-plan.js';

const EPS = 1e-8;
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
function corners(x, z, w, d, rotation) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]]
    .map(([a,b]) => [x+a*c+b*s,z-a*s+b*c]);
}
function contains(point, polygon) {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[j], b=polygon[i], edge=sub(b,a), delta=sub(point,a);
    if (Math.abs(cross(edge,delta)) < EPS && delta[0]*edge[0]+delta[1]*edge[1] >= -EPS
      && delta[0]*edge[0]+delta[1]*edge[1] <= edge[0]**2+edge[1]**2+EPS) return true;
    if ((a[1]>point[1]) !== (b[1]>point[1])
      && point[0] < (b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
// 辺を床の境界との交点で分ける。四隅だけの判定では凹部をまたいでしまう。
function contained(rect, polygon) {
  if (!rect.every(point => contains(point,polygon))) return false;
  return rect.every((a,i) => {
    const edge=sub(rect[(i+1)%4],a), cuts=[0,1];
    polygon.forEach((b,j) => {
      const other=sub(polygon[(j+1)%polygon.length],b), denominator=cross(edge,other);
      if (Math.abs(denominator)<EPS) return;
      const delta=sub(b,a), t=cross(delta,other)/denominator, u=cross(delta,edge)/denominator;
      if (t>0 && t<1 && u>=0 && u<=1) cuts.push(t);
    });
    cuts.sort((a,b)=>a-b);
    return cuts.slice(1).every((t,j) => {
      const middle=(t+cuts[j])/2;
      return contains([a[0]+edge[0]*middle,a[1]+edge[1]*middle],polygon);
    });
  });
}
function overlaps(a,b) {
  return [...a,...b].every((point,i) => {
    const polygon=i<4?a:b, index=i%4, edge=sub(polygon[(index+1)%4],point);
    const axis=[-edge[1],edge[0]];
    const project=poly=>poly.map(p=>p[0]*axis[0]+p[1]*axis[1]);
    const pa=project(a),pb=project(b);
    return Math.min(...pa)<Math.max(...pb)-EPS && Math.min(...pb)<Math.max(...pa)-EPS;
  });
}
export function fitsFloorPlan(item,plan, pieces) {
  if (!['x','z','w','d','h','rot'].every(key=>Number.isFinite(item[key]))
    || item.w<=0 || item.d<=0 || item.h<=0) return false;
  const rect=corners(item.x,item.z,item.w,item.d,item.rot);
  const drawing=rect.map(([x,z])=>[x+plan.w/2,z+plan.d/2]);
  // 複数の床をまたぐ配置は、各床の境界が確定するまでは受け入れない。
  if (!plan.floors.some(floor=>contained(drawing,floor.points))) return false;
  return !(pieces ?? plan.walls.flatMap(wall=>wallPieces(wall,plan))).some(piece=>
    piece.position[1]-piece.size[1]/2 < item.h-EPS
    && overlaps(rect,corners(piece.position[0],piece.position[2],piece.size[0],piece.size[2],piece.rotation)));
}

// 追加時だけ空き位置を探す。移動・回転時に別の部屋へ飛ばす補正には使わない。
export function findFurniturePosition(item,plan) {
  const pieces=plan.walls.flatMap(wall=>wallPieces(wall,plan));
  if (fitsFloorPlan(item,plan,pieces)) return item;
  const step=Math.max(.1,Math.max(plan.w,plan.d)/100);
  for (let z=-plan.d/2+item.d/2;z<=plan.d/2-item.d/2;z+=step) {
    for (let x=-plan.w/2+item.w/2;x<=plan.w/2-item.w/2;x+=step) {
      const candidate={...item,x,z};
      if (fitsFloorPlan(candidate,plan,pieces)) return candidate;
    }
  }
  return null;
}

// ドラッグだけで使う接触補正。壁に向かう成分を除き、壁沿いの移動を残す。
// 要求位置が壁の向こうで有効なら、呼び出し側でその位置をそのまま採用する。
export function slideFurnitureAlongWalls(item, previous, plan) {
  const pieces = plan.walls.flatMap(wall => wallPieces(wall, plan));
  const maxCorrection = Math.hypot(item.x - previous.x, item.z - previous.z);
  let candidate = item;
  for (let iteration = 0; iteration < 4; iteration++) {
    const rect = corners(candidate.x, candidate.z, candidate.w, candidate.d, candidate.rot);
    const piece = pieces.find(value => value.position[1] - value.size[1] / 2 < item.h - EPS
      && overlaps(rect, corners(value.position[0], value.position[2], value.size[0], value.size[2], value.rotation)));
    if (!piece) return fitsFloorPlan(candidate, plan, pieces) ? candidate : null;
    const c = Math.cos(piece.rotation), s = Math.sin(piece.rotation);
    const corrections = [[c, -s, piece.size[0] / 2], [s, c, piece.size[2] / 2]].map(([nx, nz, half]) => {
      const before = (previous.x - piece.position[0]) * nx + (previous.z - piece.position[2]) * nz;
      const extent = item.w / 2 * Math.abs(Math.cos(item.rot) * nx - Math.sin(item.rot) * nz)
        + item.d / 2 * Math.abs(Math.sin(item.rot) * nx + Math.cos(item.rot) * nz);
      const distance = (candidate.x - piece.position[0]) * nx + (candidate.z - piece.position[2]) * nz;
      const offset = (before < 0 ? -1 : 1) * (half + extent + EPS) - distance;
      return { x: candidate.x + nx * offset, z: candidate.z + nz * offset, distance: Math.abs(offset) };
    }).sort((a, b) => a.distance - b.distance);
    const correction = corrections[0];
    candidate = { ...candidate, x: correction.x, z: correction.z };
    if (Math.hypot(candidate.x - item.x, candidate.z - item.z) > maxCorrection + EPS * 4) return null;
  }
  return fitsFloorPlan(candidate, plan, pieces) ? candidate : null;
}
