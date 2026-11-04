import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { createFurnitureDrag } from '../utils/furniture-drag';

export function useFurnitureDrag(enabled = true) {
  const controls = useThree(state => state.controls);
  const canvas = useThree(state => state.gl.domElement);
  const drag = useMemo(
    () => createFurnitureDrag(controls, canvas.ownerDocument.defaultView),
    [controls, canvas],
  );

  // Also unlock the camera when changing plans or deleting the dragged furniture.
  useEffect(() => () => drag.end(), [drag]);

  useEffect(() => {
    if (!enabled) drag.end();
  }, [drag, enabled]);

  return drag;
}
