// 正面では水平・垂直の両画角に部屋全体を収める。寸法・位置はメートル。
export function viewPreset(planKey, plan, name, aspect, fov = 42) {
  const size = Math.max(plan.w, plan.d, plan.h) * 1.25;
  const custom = planKey === 'custom';
  if (name === 'front') {
    const distance = Math.max(plan.w / Math.max(aspect, .01), plan.h)
      / (2 * Math.tan(fov * Math.PI / 360)) * 1.2 + plan.d / 2;
    return { position: [0, plan.h / 2, distance], target: [0, plan.h / 2, 0], maxDistance: Math.max(custom ? size * 4 : 16, distance * 2), maxPolarAngle: Math.PI / 2 };
  }
  return { position: custom ? [size * .8, size * .85, size] : [8, 7, 9], target: [0, custom ? plan.h * .2 : .5, 0], maxDistance: custom ? size * 4 : 16, maxPolarAngle: Math.PI * .49 };
}
