import { fitsFloorPlan } from './floor-plan-furniture.js';
import { wallPieces } from './floor-plan.js';

export function walkingWorld(planKey, plan, items = []) {
  const shape = planKey === 'custom' ? plan : {
    ...plan, floors: [{ points: [[0,0],[plan.w,0],[plan.w,plan.d],[0,plan.d]] }], walls: [],
  };
  const eye = Math.max(.2, Math.min(1.6, plan.h - .15));
  const pieces = planKey === 'custom' ? plan.walls.flatMap(w => wallPieces(w, plan)) : [
    { position: [0,plan.h/2,-plan.d/2], size: [plan.w,plan.h,.09], rotation: 0 },
    { position: [0,plan.h/2,plan.d/2], size: [plan.w,plan.h,.09], rotation: 0 },
    { position: [-plan.w/2,plan.h/2,0], size: [.09,plan.h,plan.d], rotation: 0 },
    { position: [plan.w/2,plan.h/2,0], size: [.09,plan.h,plan.d], rotation: 0 },
  ];
  pieces.push(...items.map(item => ({ position: [item.x,item.h/2,item.z], size: [item.w,item.h,item.d], rotation: item.rot })));
  return { plan: shape, pieces, eye };
}
export function canWalk(world, x, z) {
  return fitsFloorPlan({ x, z, w: .3, d: .3, h: world.eye + .1, rot: 0 }, world.plan, world.pieces);
}
export function walkingStart(world) {
  if (canWalk(world, 0, 0)) return [0, world.eye, 0];
  const { w, d } = world.plan, step = Math.max(.25, Math.max(w,d) / 100);
  for (let radius = step; radius <= Math.max(w,d); radius += step) {
    for (let x = -radius; x <= radius; x += step) for (const z of [-radius, radius]) {
      if (canWalk(world,x,z)) return [x,world.eye,z];
    }
    for (let z = -radius + step; z < radius; z += step) for (const x of [-radius,radius]) {
      if (canWalk(world,x,z)) return [x,world.eye,z];
    }
  }
  return null;
}
// 時間差を制限し、細かい歩幅で検査して薄い壁のすり抜けを防ぐ。
export function walkingStep(world, position, yaw, forward, right, elapsed) {
  if (![...position,yaw,forward,right,elapsed].every(Number.isFinite) || elapsed <= 0) return position;
  const length = Math.hypot(forward,right); if (!length) return position;
  const distance = Math.min(elapsed,.05) * 1.8;
  const dx = (-Math.sin(yaw)*forward + Math.cos(yaw)*right) / length * distance;
  const dz = (-Math.cos(yaw)*forward - Math.sin(yaw)*right) / length * distance;
  const steps = Math.max(1,Math.ceil(distance/.03)); let [x,y,z] = position;
  for (let i=0;i<steps;i++) {
    if (canWalk(world,x+dx/steps,z+dz/steps)) { x+=dx/steps; z+=dz/steps; }
    else {
      if (canWalk(world,x+dx/steps,z)) x+=dx/steps;
      if (canWalk(world,x,z+dz/steps)) z+=dz/steps;
    }
  }
  return [x,y,z];
}
