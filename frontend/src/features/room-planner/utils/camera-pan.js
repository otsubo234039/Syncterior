// 通常3Dの方位に沿って、床面（XZ）だけを平行移動する。
export function cameraPanOffset(azimuth, direction, distance) {
  if (!Number.isFinite(azimuth) || !Number.isFinite(distance) || distance <= 0) return null;
  const axes = { forward: [1, 0], back: [-1, 0], left: [0, -1], right: [0, 1] };
  const axis = Object.hasOwn(axes, direction) ? axes[direction] : null;
  if (!axis) return null;
  const [forward, right] = axis;
  return [(Math.cos(azimuth) * right - Math.sin(azimuth) * forward) * distance, 0,
    (-Math.sin(azimuth) * right - Math.cos(azimuth) * forward) * distance];
}
