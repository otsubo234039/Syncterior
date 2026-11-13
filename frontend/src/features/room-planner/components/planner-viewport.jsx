import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { viewPreset } from '../utils/view-preset';
import { Room } from './room';

export default function PlannerViewport({ preset, planKey, plan, items, selected, setSelected, moveItem, editable }) {
  return (<Canvas frameloop="demand" shadows camera={{
      position: [8, 7, 9],
      fov: 42
    }} onPointerMissed={() => setSelected(null)}>
      <color attach="background" args={['#f1f0eb']} /><ambientLight intensity={1.4} /><directionalLight position={[5, 9, 4]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} /><group><Room plan={plan} planKey={planKey} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem} editable={editable} /></group><FramePlan preset={preset} planKey={planKey} plan={plan} /><OrbitControls makeDefault target={[0, .5, 0]} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI * .49} /><Environment preset="apartment" />
    </Canvas>
  );
}

function FramePlan({ preset, planKey, plan }) {
  const { camera, controls, invalidate } = useThree();
  useEffect(() => {
    if (!controls) return;
    // 視点操作直後の慣性を消し、プリセットへ確実に戻す。
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    const view = viewPreset(planKey, plan, preset?.name, camera.aspect, camera.fov);
    camera.position.set(...view.position);
    controls.target.set(...view.target);
    controls.maxDistance = view.maxDistance;
    controls.maxPolarAngle = view.maxPolarAngle;
    controls.update(); invalidate();
  }, [preset, planKey, plan.w, plan.d, plan.h, camera.aspect, camera, controls, invalidate]);
  return null;
}
