import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Room } from './room';

export default function PlannerViewport({ planKey, items, selected, setSelected, moveItem, editable }) {
  return (<Canvas frameloop="demand" shadows camera={{
      position: [8, 7, 9],
      fov: 42
    }} onPointerMissed={() => setSelected(null)}>
      <color attach="background" args={['#f1f0eb']} /><ambientLight intensity={1.4} /><directionalLight position={[5, 9, 4]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} /><Room planKey={planKey} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem} editable={editable} /><OrbitControls makeDefault target={[0, .5, 0]} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI * .49} /><Environment preset="apartment" />
    </Canvas>
  );
}
