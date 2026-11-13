// 全体表示でも線が密集しすぎないよう、実寸の目盛間隔を選ぶ。形状や座標は変更しない。
export function planGridStep(plan) {
  const span = Math.max(plan.w, plan.d);
  return [.25, .5, 1, 2, 5, 10].find(step => span / step <= 40) ?? 10;
}
