import React, { useMemo } from 'react';
import { Shape, DoubleSide } from 'three';
import { Edges } from '@react-three/drei';
import { wallPieces } from '../utils/floor-plan';

function Floor({ floor, plan }) {
  const shape = useMemo(() => {
    const value = new Shape();
    floor.points.forEach(([x, z], i) => value[i ? 'lineTo' : 'moveTo'](x - plan.w / 2, plan.d / 2 - z));
    value.closePath(); return value;
  }, [floor, plan.w, plan.d]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.015, 0]} receiveShadow>
    <shapeGeometry args={[shape]} /><meshStandardMaterial color={floor.kind === 'balcony' ? '#a0845b' : '#c5b79e'} side={DoubleSide} roughness={1} envMapIntensity={.15} />
  </mesh>;
}
export function FloorPlanShell({ plan }) {
  return <group>
    {plan.floors.map(floor => <Floor key={floor.id} floor={floor} plan={plan} />)}
    {plan.walls.flatMap(wall => wallPieces(wall, plan).map((piece, i) => <mesh key={`${wall.id}-${i}`} position={piece.position} rotation={[0, piece.rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={piece.size} /><meshStandardMaterial color="#d3d9d5" roughness={.92} envMapIntensity={.15} /><Edges threshold={20} color="#64796f" />
    </mesh>))}
  </group>;
}
