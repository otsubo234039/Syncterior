import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { cameraPanOffset } from '../utils/camera-pan';

export function CameraPanControls({ request, active }) {
  const { camera, controls, gl, invalidate } = useThree();
  const revision = useRef(0), elapsed = useRef(0);
  const move = amount => {
    if (!active || !controls?.enabled) return;
    const offset = cameraPanOffset(controls.getAzimuthalAngle(), request.direction, camera.position.distanceTo(controls.target) * amount);
    if (!offset) return;
    camera.position.x += offset[0]; camera.position.z += offset[2];
    controls.target.x += offset[0]; controls.target.z += offset[2];
    controls.update(); invalidate();
  };
  useEffect(() => {
    if (revision.current === request.revision) return;
    revision.current = request.revision; elapsed.current = 0; move(.04);
  }, [request.revision, active, camera, controls, invalidate]);
  useFrame((_, delta) => {
    if (!active || !request.holding || !controls?.enabled) return;
    const step = Math.min(delta, .05);
    elapsed.current += step;
    if (elapsed.current > .3) move(step * .25);
    invalidate();
  });
  useEffect(() => {
    if (!active || !controls) return;
    const element = controls.domElement ?? gl.domElement, doc = element.ownerDocument, win = doc.defaultView;
    let pointer = null;
    const cancel = () => {
      if (pointer === null) return;
      const id = pointer; pointer = null;
      // OrbitControlsにも終了を通知し、document上の移動リスナーを外す。
      element.dispatchEvent(new PointerEvent('pointercancel', { pointerId: id }));
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    };
    const down = event => {
      if (event.button !== 1 || event.isPrimary === false || !controls?.enabled) return;
      event.preventDefault(); cancel(); pointer = event.pointerId;
      element.setPointerCapture(event.pointerId);
    };
    const end = event => { if (pointer === event.pointerId) cancel(); };
    element.addEventListener('pointerdown', down, true);
    element.addEventListener('pointerup', end); element.addEventListener('lostpointercapture', end);
    // ネイティブのpointercancelはOrbitControls自身も処理する。
    const cancelled = event => { if (pointer === event.pointerId) { pointer = null; if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId); } };
    element.addEventListener('pointercancel', cancelled);
    win.addEventListener('blur', cancel); doc.addEventListener('visibilitychange', cancel);
    return () => {
      cancel(); element.removeEventListener('pointerdown', down, true);
      element.removeEventListener('pointerup', end); element.removeEventListener('lostpointercapture', end);
      element.removeEventListener('pointercancel', cancelled);
      win.removeEventListener('blur', cancel); doc.removeEventListener('visibilitychange', cancel);
    };
  }, [active, gl, controls]);
  return null;
}
