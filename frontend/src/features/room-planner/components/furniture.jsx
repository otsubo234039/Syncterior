import React from 'react';
import { useFurnitureDrag } from '../hooks/use-furniture-drag';
export function Furniture({
  item,
  selected,
  onSelect,
  onMove
}) {
  const drag = useFurnitureDrag();
  const shape = item.type;
  const color = item.color;
  const mats = c => <meshStandardMaterial color={c} roughness={.78} />;
  const parts = () => {
    if (shape === 'sofa') return <><mesh position={[0, .2, 0]}><boxGeometry args={[item.w, .4, item.d]} />{mats(color)}</mesh><mesh position={[0, .52, -item.d * .35]}><boxGeometry args={[item.w, .58, item.d * .3]} />{mats(color)}</mesh>{[-.32, .32].map((x, i) => <mesh key={i} position={[x, .48, item.d * .12]}><boxGeometry args={[.12, .5, item.d * .78]} />{mats(color)}</mesh>)}</>;
    if (shape === 'bed') return <><mesh position={[0, .12, 0]}><boxGeometry args={[item.w, .24, item.d]} />{mats('#8b725c')}</mesh><mesh position={[0, .28, 0]}><boxGeometry args={[item.w * .96, .12, item.d * .94]} />{mats('#f0e9dc')}</mesh><mesh position={[-item.w * .24, .39, -item.d * .34]}><boxGeometry args={[item.w * .38, .12, .36]} />{mats('#fffaf0')}</mesh><mesh position={[item.w * .24, .39, -item.d * .34]}><boxGeometry args={[item.w * .38, .12, .36]} />{mats('#fffaf0')}</mesh></>;
    if (shape === 'table' || shape === 'desk') return <><mesh position={[0, item.h - .06, 0]}><boxGeometry args={[item.w, .12, item.d]} />{mats(color)}</mesh>{[-1, 1].flatMap(a => [-1, 1].map(b => <mesh key={a + ',' + b} position={[a * (item.w / 2 - .08), item.h / 2 - .06, b * (item.d / 2 - .08)]}><boxGeometry args={[.07, item.h - .12, .07]} />{mats('#8a6a4d')}</mesh>))}</>;
    if (shape === 'chair') return <><mesh position={[0, .43, 0]}><boxGeometry args={[item.w, .12, item.d]} />{mats(color)}</mesh><mesh position={[0, .68, -item.d * .42]}><boxGeometry args={[item.w, .42, .09]} />{mats(color)}</mesh>{[-1, 1].flatMap(a => [-1, 1].map(b => <mesh key={a + ',' + b} position={[a * item.w * .38, .2, b * item.d * .38]}><boxGeometry args={[.045, .4, .045]} />{mats('#8a6a4d')}</mesh>))}</>;
    if (shape === 'tv') return <><mesh position={[0, .28, 0]}><boxGeometry args={[item.w, .56, item.d]} />{mats(color)}</mesh><mesh position={[0, .78, -.03]}><boxGeometry args={[item.w * .88, .52, .055]} />{mats('#25292d')}</mesh><mesh position={[0, .78, .002]}><boxGeometry args={[item.w * .82, .44, .012]} />{mats('#667b85')}</mesh></>;
    if (shape === 'fridge') return <><mesh position={[0, item.h / 2, 0]}><boxGeometry args={[item.w, item.h, item.d]} />{mats(color)}</mesh><mesh position={[item.w * .32, item.h * .54, item.d / 2 + .008]}><boxGeometry args={[.025, .07, .015]} />{mats('#6f7a80')}</mesh><mesh position={[item.w * .32, item.h * .25, item.d / 2 + .008]}><boxGeometry args={[.025, .07, .015]} />{mats('#6f7a80')}</mesh></>;
    return <><mesh position={[0, .04, 0]}><cylinderGeometry args={[.16, .16, .08, 24]} />{mats(color)}</mesh><mesh position={[0, item.h * .52, 0]}><cylinderGeometry args={[.025, .025, item.h * .92, 12]} />{mats('#77736a')}</mesh><mesh position={[0, item.h * .94, 0]}><coneGeometry args={[.17, .2, 24]} />{mats(color)}</mesh></>;
  };
  return <group position={[item.x, 0, item.z]} rotation={[0, item.rot, 0]} onClick={e => {
    e.stopPropagation();
    onSelect(item.id);
  }} onPointerDown={event => {
    if (drag.begin(event, item)) onSelect(item.id);
  }} onPointerUp={drag.end} onPointerCancel={drag.end} onLostPointerCapture={drag.end} onPointerMove={event => {
    drag.move(event, (x, z) => onMove(item.id, x, z));
  }}>
  {parts()}
  {selected && <mesh position={[0, .015, 0]}><boxGeometry args={[item.w + .12, .018, item.d + .12]} /><meshBasicMaterial color="#5b8f78" wireframe /></mesh>}
 </group>;
}
