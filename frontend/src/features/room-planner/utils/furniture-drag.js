import { Plane, Vector3 } from 'three';

// Disable controls synchronously: OrbitControls also handles the native pointerdown.
export function createFurnitureDrag(controls, eventSource) {
  let drag = null;

  function end(event) {
    if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return;

    const { pointerId, target, controlsEnabled } = drag;
    drag = null;
    eventSource.removeEventListener('pointerup', end);
    eventSource.removeEventListener('pointercancel', end);
    eventSource.removeEventListener('lostpointercapture', end);
    eventSource.removeEventListener('blur', end);
    controls.enabled = controlsEnabled;
    if (target.hasPointerCapture?.(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  }

  function begin(event, position) {
    if (!controls || drag || event.button !== 0 || event.isPrimary === false) return false;

    // Captured pointer events may carry the intersection of a wall, another
    // object, or an old hit. Only the live ray is stable throughout a drag.
    const plane = new Plane(new Vector3(0, 1, 0), -event.point.y);
    const point = event.ray.intersectPlane(plane, new Vector3());
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;

    event.stopPropagation();
    drag = {
      plane,
      offset: { x: position.x - point.x, z: position.z - point.z },
      pointerId: event.pointerId,
      target: event.target,
      controlsEnabled: controls.enabled,
    };
    controls.enabled = false;
    eventSource.addEventListener('pointerup', end);
    eventSource.addEventListener('pointercancel', end);
    eventSource.addEventListener('lostpointercapture', end);
    eventSource.addEventListener('blur', end);
    event.target.setPointerCapture(event.pointerId);
    return true;
  }

  function move(event, onMove) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (event.buttons !== 1) {
      end(event);
      return;
    }
    event.stopPropagation();
    const point = event.ray.intersectPlane(drag.plane, new Vector3());
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return;
    onMove(point.x + drag.offset.x, point.z + drag.offset.z);
  }

  return { begin, move, end };
}
