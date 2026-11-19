import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { viewPreset } from '../utils/view-preset';
import { Room } from './room';
import { FirstPersonControls } from './first-person-controls';
import { CameraPanControls } from './camera-pan-controls';
import { MOUSE } from 'three';
import { ViewportLoading } from './viewport-loading';

export default function PlannerViewport({ preset, pan, planKey, plan, items, selected, setSelected, moveItem, editable, walking, world, walkStart, onExitWalking, onReadyChange }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => { onReadyChange(ready); }, [ready, onReadyChange]);
  useLayoutEffect(() => () => onReadyChange(false), [onReadyChange]);
  return <><div className="viewport-scene" aria-busy={!ready}><Canvas frameloop="demand" shadows camera={{
      position: [8, 7, 9],
      fov: 42
    }} onPointerMissed={() => { if (!walking) setSelected(null); }}>
      <Suspense fallback={null}><color attach="background" args={['#f1f0eb']} /><ambientLight intensity={1.4} /><directionalLight position={[5, 9, 4]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} /><group><Room plan={plan} planKey={planKey} items={items} selected={selected} setSelected={walking ? ignoreSelection : setSelected} moveItem={moveItem} editable={editable && !walking} /></group><FramePlan preset={preset} planKey={planKey} plan={plan} active={!walking} /><OrbitControls enableDamping={false} enabled={!walking} makeDefault target={[0, .5, 0]} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI * .49} screenSpacePanning={false} mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN }} /><CameraPanControls request={pan} active={!walking} />{walking && <FirstPersonControls world={world} start={walkStart} onExit={onExitWalking} />}<Environment preset="apartment" /><SceneReady onReady={setReady} /></Suspense>
    </Canvas></div>{!ready && <ViewportLoading />}</>;
}

// useFrameは描画の直前に呼ばれる。次のブラウザフレームで初回描画の完了を通知する。
function SceneReady({ onReady }) {
  const invalidate = useThree(state => state.invalidate);
  const pending = useRef(null), reported = useRef(false);
  useLayoutEffect(() => {
    reported.current = false; onReady(false); invalidate();
    return () => {
      if (pending.current !== null) cancelAnimationFrame(pending.current);
      pending.current = null; reported.current = false; onReady(false);
    };
  }, [onReady, invalidate]);
  useFrame(() => {
    if (reported.current || pending.current !== null) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = null; reported.current = true; onReady(true);
    });
  });
  return null;
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
