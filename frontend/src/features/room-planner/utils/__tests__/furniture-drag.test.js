import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Ray, Vector3 } from 'three';
import { createFurnitureDrag } from '../furniture-drag.js';

function setup(enabled = true) {
  const controls = { enabled };
  const eventSource = new EventTarget();
  const captured = new Set();
  const target = {
    setPointerCapture: id => captured.add(id),
    hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id),
  };
  const pointer = (patch = {}) => ({
    pointerId: 1, button: 0, buttons: 1, isPrimary: true, target,
    point: { x: 2, y: 0, z: -3 },
    ray: new Ray(new Vector3(2, 10, -3), new Vector3(0, -1, 0)),
    stopPropagation() {}, ...patch,
  });
  const dispatch = (type, pointerId) => {
    const event = new Event(type);
    if (pointerId != null) Object.defineProperty(event, 'pointerId', { value: pointerId });
    eventSource.dispatchEvent(event);
  };
  const controller = createFurnitureDrag(controls, eventSource);
  const drag = {
    ...controller,
    begin: (event, position = { x: 2, z: -3 }) => controller.begin(event, position),
  };
  return { controls, captured, pointer, dispatch, drag };
}

test('locks the camera immediately, moves furniture, and restores it on release', () => {
  const { controls, captured, pointer, drag } = setup();
  assert.equal(drag.begin(pointer()), true);
  assert.equal(controls.enabled, false);
  assert.equal(captured.has(1), true);
  const positions = [];
  drag.move(pointer(), (x, z) => positions.push([x, z]));
  assert.deepEqual(positions, [[2, -3]]);
  drag.end(pointer());
  assert.equal(controls.enabled, true);
  assert.equal(captured.size, 0);
  drag.move(pointer(), () => assert.fail('movement continued after release'));
});

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) {
  test(`restores the camera after ${type}, including outside the canvas`, () => {
    const { controls, captured, pointer, drag, dispatch } = setup();
    drag.begin(pointer());
    dispatch(type, type === 'blur' ? undefined : 1);
    assert.equal(controls.enabled, true);
    assert.equal(captured.size, 0);
    drag.end();
    assert.equal(controls.enabled, true);
  });
}

test('ignores secondary buttons, secondary pointers, and unrelated pointer releases', () => {
  const { controls, pointer, drag, dispatch } = setup();
  assert.equal(drag.begin(pointer({ button: 2 })), false);
  assert.equal(drag.begin(pointer({ isPrimary: false })), false);
  assert.equal(controls.enabled, true);
  drag.begin(pointer());
  assert.equal(drag.begin(pointer({ pointerId: 2 })), false);
  drag.move(pointer({ pointerId: 2 }), () => assert.fail('another pointer moved furniture'));
  dispatch('pointerup', 2);
  assert.equal(controls.enabled, false);
  drag.end(pointer());
  assert.equal(controls.enabled, true);
});

test('unmount cleanup restores the original controls state and removes listeners', () => {
  const { controls, captured, pointer, drag, dispatch } = setup();
  drag.begin(pointer());
  drag.end();
  assert.equal(controls.enabled, true);
  assert.equal(captured.size, 0);
  controls.enabled = false;
  dispatch('pointerup', 1);
  assert.equal(controls.enabled, false);
});

test('preserves controls that were already disabled', () => {
  const { controls, pointer, drag } = setup(false);
  drag.begin(pointer());
  drag.end();
  assert.equal(controls.enabled, false);
});

test('releases the camera if pointermove shows that the button is no longer held', () => {
  const { controls, pointer, drag } = setup();
  drag.begin(pointer());
  drag.move(pointer({ buttons: 0 }), () => assert.fail('released pointer moved furniture'));
  assert.equal(controls.enabled, true);
});

test('supports repeated drags without losing the original camera state', () => {
  const { controls, pointer, drag, dispatch } = setup();
  for (let pointerId = 1; pointerId <= 3; pointerId++) {
    assert.equal(drag.begin(pointer({ pointerId })), true);
    assert.equal(controls.enabled, false);
    dispatch('pointerup', pointerId);
    assert.equal(controls.enabled, true);
  }
});


test('uses the live ray when walls or other furniture change the hit point', () => {
  const { pointer, drag } = setup();
  drag.begin(pointer());
  const positions = [];
  const ray = new Ray(new Vector3(3, 10, -2), new Vector3(0, -1, 0));
  for (const point of [
    { x: 0, y: 0, z: 0 },
    { x: 2.7, y: 2, z: -1 },
    { x: -1, y: 0.8, z: 2 },
  ]) {
    drag.move(pointer({ ray, point }), (x, z) => positions.push([x, z]));
  }
  assert.deepEqual(positions, [[3, -2], [3, -2], [3, -2]]);
  drag.end();
});

test('keeps the grabbed offset and the original height across consecutive moves', () => {
  const { pointer, drag } = setup();
  const direction = new Vector3(0, -1, -1).normalize();
  const startRay = new Ray(new Vector3(2.5, 10, 6.5), direction);
  drag.begin(pointer({ point: { x: 2.5, y: 1, z: -2.5 }, ray: startRay }));
  const positions = [];
  drag.move(pointer({ ray: startRay }), (x, z) => positions.push([x, z]));
  for (const x of [3.5, 4.5]) {
    drag.move(pointer({
      point: { x: 0, y: 0, z: 0 },
      ray: new Ray(new Vector3(x, 10, 7.5), direction),
    }), (x, z) => positions.push([x, z]));
  }
  assert.deepEqual(positions, [[2, -3], [3, -2], [4, -2]]);
  drag.end();
});

test('ignores rays that do not intersect the drag plane and keeps dragging afterward', () => {
  const { controls, pointer, drag } = setup();
  drag.begin(pointer());
  for (const ray of [
    new Ray(new Vector3(2, 10, -3), new Vector3(1, 0, 0)),
    new Ray(new Vector3(2, 10, -3), new Vector3(0, 1, 0)),
  ]) {
    drag.move(pointer({ ray }), () => assert.fail('invalid ray moved furniture'));
  }
  assert.equal(controls.enabled, false);
  const positions = [];
  drag.move(pointer(), (x, z) => positions.push([x, z]));
  assert.deepEqual(positions, [[2, -3]]);
  drag.end();
});

test('does not capture the pointer or lock the camera for an invalid initial ray', () => {
  const { controls, captured, pointer, drag } = setup();
  const ray = new Ray(new Vector3(2, 10, -3), new Vector3(1, 0, 0));
  assert.equal(drag.begin(pointer({ ray })), false);
  assert.equal(controls.enabled, true);
  assert.equal(captured.size, 0);
});
