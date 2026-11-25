import React, { useMemo } from 'react';
import { Shape, DoubleSide } from 'three';
import { Edges } from '@react-three/drei';
import { wallPieces } from '../utils/floor-plan';
import { SurfaceMaterial } from './surface-material';

function Floor({ floor, plan, surfaces }) {
  const shape = useMemo(() => {
    const value = new Shape();
    floor.points.forEach(([x, z], i) => value[i ? 'lineTo' : 'moveTo'](x - plan.w / 2, plan.d / 2 - z));
    value.closePath(); return value;
  }, [floor, plan.w, plan.d]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.015, 0]} receiveShadow>
    <shapeGeometry args={[shape]} /><SurfaceMaterial kind="floor" preset={floor.kind === 'balcony' ? 'stone' : surfaces.floor} repeat={[plan.w / 1.5, plan.d / 1.5]} side={DoubleSide} />
  </mesh>;
}
export function FloorPlanShell({ plan, surfaces }) {
  return <group>
    {plan.floors.map(floor => <Floor key={floor.id} floor={floor} plan={plan} surfaces={surfaces} />)}
    {plan.walls.flatMap(wall => wallPieces(wall, plan).map((piece, i) => <mesh key={`${wall.id}-${i}`} position={piece.position} rotation={[0, piece.rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={piece.size} /><SurfaceMaterial kind="wall" preset={surfaces.wall} repeat={[Math.max(piece.size[0], piece.size[2]) / 1, piece.size[1] / 1.5]} roughness={.92} /><Edges threshold={20} color="#64796f" />
    </mesh>))}
  </group>;
}
