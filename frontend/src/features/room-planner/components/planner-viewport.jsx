import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { viewPreset } from '../utils/view-preset';
import { Room } from './room';
import { FirstPersonControls } from './first-person-controls';
import { CameraPanControls } from './camera-pan-controls';
import { MOUSE } from 'three';

export default function PlannerViewport({ preset, pan, planKey, plan, items, selected, setSelected, moveItem, editable, walking, world, walkStart, onExitWalking }) {
  return (<Canvas frameloop="demand" shadows camera={{
      position: [8, 7, 9],
      fov: 42
    }} onPointerMissed={() => { if (!walking) setSelected(null); }}>
      <color attach="background" args={['#f1f0eb']} /><ambientLight intensity={1.4} /><directionalLight position={[5, 9, 4]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} /><group><Room plan={plan} planKey={planKey} items={items} selected={selected} setSelected={walking ? ignoreSelection : setSelected} moveItem={moveItem} editable={editable && !walking} /></group><FramePlan preset={preset} planKey={planKey} plan={plan} active={!walking} /><OrbitControls enableDamping={false} enabled={!walking} makeDefault target={[0, .5, 0]} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI * .49} screenSpacePanning={false} mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN }} /><CameraPanControls request={pan} active={!walking} />{walking && <FirstPersonControls world={world} start={walkStart} onExit={onExitWalking} />}<Environment preset="apartment" />
    </Canvas>
  );
}

const ignoreSelection = () => {};
function FramePlan({ preset, planKey, plan, active }) {
  const { camera, controls, invalidate } = useThree();
  useEffect(() => {
    if (!controls || !active) return;
    // 平行移動した注視点もプリセットの位置へ戻す。
    const view = viewPreset(planKey, plan, preset?.name, camera.aspect, camera.fov);
    camera.position.set(...view.position);
    controls.target.set(...view.target);
    controls.maxDistance = view.maxDistance;
    controls.maxPolarAngle = view.maxPolarAngle;
    controls.update(); invalidate();
  }, [preset, planKey, plan.w, plan.d, plan.h, camera.aspect, camera, controls, invalidate, active]);
  return null;
}
