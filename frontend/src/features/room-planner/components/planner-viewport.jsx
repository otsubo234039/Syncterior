import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Room } from './room';

export default function PlannerViewport({ planKey, plan, displayScale = 1, items, selected, setSelected, moveItem, editable }) {
  return (<Canvas frameloop="demand" shadows camera={{
      position: [8, 7, 9],
      fov: 42
    }} onPointerMissed={() => setSelected(null)}>
      <color attach="background" args={['#f1f0eb']} /><ambientLight intensity={1.4} /><directionalLight position={[5, 9, 4]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} /><group scale={1 / displayScale}><Room plan={plan} planKey={planKey} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem} editable={editable} /></group><FramePlan planKey={planKey} plan={plan} /><OrbitControls makeDefault target={[0, .5, 0]} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI * .49} /><Environment preset="apartment" />
    </Canvas>
  );
}

function FramePlan({ planKey, plan }) {
  const { camera, controls, invalidate } = useThree();
  useEffect(() => {
    if (!controls) return;
    if (planKey === 'custom') {
      const size = Math.max(plan.w, plan.d, plan.h) * 1.25;
      camera.position.set(size * .8, size * .85, size);
      controls.target.set(0, plan.h * .2, 0);
      controls.maxDistance = size * 4;
    } else {
      camera.position.set(8, 7, 9); controls.target.set(0, .5, 0); controls.maxDistance = 16;
    }
    controls.update(); invalidate();
  }, [planKey, plan.w, plan.d, plan.h, camera, controls, invalidate]);
  return null;
}
