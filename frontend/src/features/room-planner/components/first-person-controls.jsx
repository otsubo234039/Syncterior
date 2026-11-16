import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { walkingStep } from '../utils/first-person';

export function FirstPersonControls({ world, start, onExit }) {
  const { camera, gl, controls, invalidate } = useThree();
  const keys = useRef(new Set()), heading = useRef({ yaw: 0, pitch: 0 });
  useEffect(() => {
    const canvas = gl.domElement, doc = canvas.ownerDocument, win = doc.defaultView;
    const previous = { tab: canvas.getAttribute('tabindex'), label: canvas.getAttribute('aria-label'), fov: camera.fov, near: camera.near };
    const keyMap = { KeyW:'forward', ArrowUp:'forward', KeyS:'back', ArrowDown:'back', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right' };
    let drag = null;
    const release = () => {
      const active = drag; drag = null;
      if (active && canvas.hasPointerCapture(active.id)) canvas.releasePointerCapture(active.id);
    };
    const stop = () => { keys.current.clear(); release(); };
    const down = event => {
      if (event.code === 'Escape') { event.preventDefault(); stop(); onExit(); return; }
      if (!keyMap[event.code] || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      event.preventDefault(); event.stopPropagation(); keys.current.add(event.code); invalidate();
    };
    const up = event => { keys.current.delete(event.code); };
    const pointerDown = event => {
      if (event.button !== 0 || event.isPrimary === false) return;
      canvas.focus({ preventScroll: true }); release();
      drag = { id:event.pointerId, x:event.clientX, y:event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const move = event => {
      if (!drag || drag.id !== event.pointerId) return;
      heading.current.yaw -= (event.clientX-drag.x)*.004;
      heading.current.pitch = Math.max(-1.3, Math.min(1.3, heading.current.pitch-(event.clientY-drag.y)*.004));
      drag.x=event.clientX; drag.y=event.clientY;
      camera.rotation.set(heading.current.pitch,heading.current.yaw,0,'YXZ'); invalidate();
    };
    heading.current = { yaw:0, pitch:0 }; camera.position.set(...start);
    if (controls) controls.enabled = false;
    camera.rotation.set(0,0,0,'YXZ'); camera.fov=65; camera.near=.05; camera.updateProjectionMatrix();
    canvas.tabIndex=0; canvas.setAttribute('aria-label','一人称視点の操作'); canvas.focus({ preventScroll:true }); invalidate();
    canvas.addEventListener('keydown',down); win.addEventListener('keyup',up);
    canvas.addEventListener('pointerdown',pointerDown); canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',release); canvas.addEventListener('pointercancel',release); canvas.addEventListener('lostpointercapture',release);
    canvas.addEventListener('blur',stop); win.addEventListener('blur',stop); doc.addEventListener('visibilitychange',stop);
    return () => {
      stop(); canvas.removeEventListener('keydown',down); win.removeEventListener('keyup',up);
      canvas.removeEventListener('pointerdown',pointerDown); canvas.removeEventListener('pointermove',move);
      canvas.removeEventListener('pointerup',release); canvas.removeEventListener('pointercancel',release); canvas.removeEventListener('lostpointercapture',release);
      canvas.removeEventListener('blur',stop); win.removeEventListener('blur',stop); doc.removeEventListener('visibilitychange',stop);
      for (const [name,value] of [['tabindex',previous.tab],['aria-label',previous.label]]) {
        if (value === null) canvas.removeAttribute(name); else canvas.setAttribute(name,value);
      }
      camera.fov=previous.fov; camera.near=previous.near; camera.updateProjectionMatrix(); invalidate();
      if (controls) controls.enabled = true;
    };
  }, [camera,gl,controls,world,start,onExit,invalidate]);
  useFrame((_, delta) => {
    const pressed = (...codes) => codes.some(code=>keys.current.has(code)) ? 1 : 0;
    const forward=pressed('KeyW','ArrowUp')-pressed('KeyS','ArrowDown');
    const right=pressed('KeyD','ArrowRight')-pressed('KeyA','ArrowLeft');
    if (!forward && !right) return;
    const next = walkingStep(world,camera.position.toArray(),heading.current.yaw,forward,right,delta);
    if (next[0] === camera.position.x && next[2] === camera.position.z) return;
    camera.position.set(...next); invalidate();
  });
  return null;
}
