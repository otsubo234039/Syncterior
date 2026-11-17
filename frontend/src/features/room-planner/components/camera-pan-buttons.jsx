import React, { useEffect, useRef, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

const directions = [
  ['forward', '前', ArrowUp], ['left', '左', ArrowLeft],
  ['right', '右', ArrowRight], ['back', '後ろ', ArrowDown],
];

export function CameraPanButtons({ onPan, onStop }) {
  const pointer = useRef(null);
  const release = useCallback(event => {
    const active = pointer.current;
    if (!active || (event?.pointerId != null && event.pointerId !== active.id)) return;
    pointer.current = null;
    if (active.button.hasPointerCapture(active.id)) active.button.releasePointerCapture(active.id);
    onStop();
  }, [onStop]);
  useEffect(() => {
    window.addEventListener('blur', release); document.addEventListener('visibilitychange', release);
    return () => {
      release(); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', release);
    };
  }, [release]);
  return <div className="camera-pan-buttons" role="group" aria-label="視点の平行移動">
    {directions.map(([direction, label, Icon]) => <button key={direction} type="button" className={`tool pan-${direction}`}
      aria-label={`視点を${label}へ移動`} title={`視点を${label}へ移動`} onPointerDown={event => {
        if (event.button !== 0 || event.isPrimary === false || pointer.current) return;
        pointer.current = { id: event.pointerId, button: event.currentTarget };
        event.currentTarget.setPointerCapture(event.pointerId); onPan(direction, true);
      }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onBlur={() => release()}
      onClick={event => { if (event.detail === 0) onPan(direction, false); }}>
      <Icon size={18} aria-hidden="true" />
    </button>)}
  </div>;
}
