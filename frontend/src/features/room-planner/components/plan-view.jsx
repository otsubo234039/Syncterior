import React, { useEffect, useRef } from 'react';
import { PlanGrid } from './plan-grid';

// SVGのY軸をワールドのZ軸に合わせる。Three.jsのY回転は図面では逆向き。
export function PlanView({ planKey, plan, items, selected, setSelected, moveItem, editable }) {
  const svg = useRef(null);
  const drag = useRef(null);
  const stop = () => {
    const active = drag.current;
    drag.current = null;
    if (active?.element.hasPointerCapture(active.pointerId)) active.element.releasePointerCapture(active.pointerId);
  };
  useEffect(() => {
    window.addEventListener('blur', stop);
    return () => { window.removeEventListener('blur', stop); stop(); };
  }, []);
  useEffect(() => { stop(); }, [planKey, plan.w, plan.d, editable]);
  useEffect(() => { if (drag.current && !items.some(item => item.id === drag.current.id)) stop(); }, [items]);
  const point = event => {
    const matrix = svg.current?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  };
  const margin = Math.max(plan.w, plan.d) * .12;
  return <svg ref={svg} className="plan-view" aria-label="部屋の平面図" viewBox={`${-plan.w / 2 - margin} ${-plan.d / 2 - margin} ${plan.w + margin * 2} ${plan.d + margin * 2}`}
    onPointerDown={() => setSelected(null)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
    onPointerMove={event => {
      const active = drag.current;
      if (!active || active.pointerId !== event.pointerId || !editable) return;
      const p = point(event);
      if (p) moveItem(active.id, p.x + active.dx, p.y + active.dz);
    }}>
    <PlanGrid plan={plan} x={-plan.w / 2} y={-plan.d / 2} />
    {planKey === 'custom' ? <>
      {plan.floors.map(floor => <polygon key={floor.id} points={floor.points.map(([x, z]) => `${x - plan.w / 2},${z - plan.d / 2}`).join(' ')} fill={floor.kind === 'balcony' ? '#f1efe7' : '#fff'} fillOpacity=".2" stroke="#bbc2bc" strokeWidth=".02" />)}
      {plan.walls.map(wall => {
        const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
        return <g key={wall.id} transform={`translate(${wall.start[0] - plan.w / 2} ${wall.start[1] - plan.d / 2}) rotate(${Math.atan2(wall.end[1] - wall.start[1], wall.end[0] - wall.start[0]) * 180 / Math.PI})`}>
          <path d={`M0 0 H${length}`} stroke="#46554c" strokeWidth={plan.wallThickness * (wall.thicknessRatio ?? 1)} />
          {wall.openings.map(opening => <path key={opening.id} d={`M${opening.offset} 0 h${opening.width}`} stroke={opening.kind === 'window' ? '#83aebe' : '#fff'} strokeWidth={plan.wallThickness * (wall.thicknessRatio ?? 1) + .01} />)}
        </g>;
      })}
    </> : <rect x={-plan.w / 2} y={-plan.d / 2} width={plan.w} height={plan.d} fill="#fff" fillOpacity=".2" stroke="#46554c" strokeWidth=".09" />}
    {items.map(item => <g key={item.id} role="button" tabIndex={0} aria-label={`${item.name}を選択`} aria-pressed={selected === item.id}
      className="plan-furniture" transform={`translate(${item.x} ${item.z})`}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(item.id); } }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.stopPropagation(); setSelected(item.id);
        const p = point(event);
        if (!editable || !p) return;
        stop(); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: item.id, pointerId: event.pointerId, element: event.currentTarget, dx: item.x - p.x, dz: item.z - p.y };
      }}>
      <g transform={`rotate(${-item.rot * 180 / Math.PI})`}>
        <rect x={-item.w / 2} y={-item.d / 2} width={item.w} height={item.d} rx=".025" fill={item.color} fillOpacity=".35" stroke={selected === item.id ? '#26795b' : '#68776d'} strokeWidth={selected === item.id ? '.055' : '.025'} />
        <path d={`M${-item.w * .3} ${-item.d * .35} H${item.w * .3}`} stroke="#68776d" strokeWidth=".025" />
      </g>
      <text textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(.14, item.w / item.name.length * 1.5)} fill="#283e32" pointerEvents="none">{item.name}</text>
    </g>)}
  </svg>;
}
