import React from 'react';
import { Grid, ContactShadows } from '@react-three/drei';
import { plans } from '../data/plans';
import { Furniture } from './furniture';
import { FloorPlanShell } from './floor-plan-shell';
import { SurfaceMaterial } from './surface-material';
import { defaultSurfaces } from '../data/surfaces';
export function Room({
  planKey,
  plan,
  items,
  selected,
  setSelected,
  moveItem,
  editable = true,
  surfaces = defaultSurfaces,
  showGrid = true
}) {
  if (planKey === 'custom') return <group>{showGrid && <Grid position={[0, -.025, 0]} args={[plan.w, plan.d]} cellSize={.25} cellThickness={.45} sectionSize={1} sectionThickness={.8} fadeDistance={18} fadeStrength={1} cellColor="#c9c6bf" sectionColor="#aaa69e" infiniteGrid={false} />}<FloorPlanShell plan={plan} surfaces={surfaces} />
    {items.map(item => <Furniture key={item.id} item={item} selected={selected === item.id} onSelect={setSelected} onMove={moveItem} editable={editable} />)}
  </group>;
  const p = plans[planKey],
    wall = .09;
  return <group>
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.04, 0]} receiveShadow><planeGeometry args={[p.w, p.d]} /><SurfaceMaterial kind="floor" preset={surfaces.floor} repeat={[p.w / 1.5, p.d / 1.5]} /></mesh>
  {showGrid && <Grid position={[0, -.025, 0]} args={[p.w, p.d]} cellSize={.25} cellThickness={.45} sectionSize={1} sectionThickness={.8} fadeDistance={18} fadeStrength={1} cellColor="#c9c6bf" sectionColor="#aaa69e" infiniteGrid={false} />}
  {[{
      pos: [0, p.h / 2, -p.d / 2],
      size: [p.w, p.h, wall]
    }, {
      pos: [-p.w / 2, p.h / 2, 0],
      size: [wall, p.h, p.d]
    }, {
      pos: [p.w / 2, p.h / 2, 0],
      size: [wall, p.h, p.d]
    }, {
      pos: [0, p.h / 2, p.d / 2],
      size: [p.w, p.h, wall]
    }].map((w, i) => <mesh key={i} position={w.pos} castShadow><boxGeometry args={w.size} /><SurfaceMaterial kind="wall" preset={surfaces.wall} repeat={[Math.max(w.size[0], w.size[2]) / 1, w.size[1] / 1.5]} roughness={.92} /></mesh>)}
  {items.map(item => <Furniture key={item.id} item={item} selected={selected === item.id} onSelect={setSelected} onMove={moveItem} editable={editable} />)}
  <ContactShadows position={[0, -.02, 0]} opacity={.22} scale={Math.max(p.w, p.d) * 1.5} blur={2.5} far={3} />
 </group>;
}
