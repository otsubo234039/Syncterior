import React, { useId } from 'react';
import { planGridStep } from '../utils/plan-grid';

export function PlanGrid({ plan, x = 0, y = 0 }) {
  const id = useId(), step = planGridStep(plan), major = step * 4;
  return <g role="img" aria-label={`グリッド：1目盛${step}m、太線${major}m`} pointerEvents="none" transform={`translate(${x} ${y})`}>
    <defs>
      <pattern id={`${id}-minor`} width={step} height={step} patternUnits="userSpaceOnUse">
        <path d={`M${step} 0 H0 V${step}`} fill="none" stroke="#d5dcd7" strokeWidth=".6" vectorEffect="non-scaling-stroke" />
      </pattern>
      <pattern id={`${id}-major`} width={major} height={major} patternUnits="userSpaceOnUse">
        <path d={`M${major} 0 H0 V${major}`} fill="none" stroke="#b4bfb7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </pattern>
    </defs>
    <rect width={plan.w} height={plan.d} fill={`url(#${id}-minor)`} />
    <rect width={plan.w} height={plan.d} fill={`url(#${id}-major)`} />
  </g>;
}
