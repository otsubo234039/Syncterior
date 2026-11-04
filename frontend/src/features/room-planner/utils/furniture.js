import { plans } from '../data/plans';
import { catalog } from '../data/catalog';
export const uid = () => Math.random().toString(36).slice(2, 9);
export function initialFurniture(planKey) {
  const p = plans[planKey],
    x = p.w / 2,
    z = p.d / 2;
  return [{
    ...catalog[0],
    id: uid(),
    x: -.7,
    z: -.5,
    rot: 0
  }, {
    ...catalog[2],
    id: uid(),
    x: -.65,
    z: .55,
    rot: 0
  }, {
    ...catalog[1],
    id: uid(),
    x: x * .48,
    z: -z * .52,
    rot: 0
  }, {
    ...catalog[5],
    id: uid(),
    x: -.75,
    z: -z + 0.28,
    rot: 0
  }];
}
