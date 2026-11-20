// 通常3Dの表示開始時に使う視点。寸法・位置はメートル。
export function initialCameraView(planKey, plan) {
  const size = Math.max(plan.w, plan.d, plan.h) * 1.25;
  const custom = planKey === 'custom';
  return { position: custom ? [size * .8, size * .85, size] : [8, 7, 9], target: [0, custom ? plan.h * .2 : .5, 0], maxDistance: custom ? size * 4 : 16, maxPolarAngle: Math.PI * .49 };
}
