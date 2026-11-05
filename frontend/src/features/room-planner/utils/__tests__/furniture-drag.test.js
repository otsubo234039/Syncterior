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

test('ドラッグ開始時に視点を即座に固定し、家具移動後の終了時に解除する', () => {
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
  test(`キャンバス外を含め、${type}の発生後に視点操作を復帰する`, () => {
    const { controls, captured, pointer, drag, dispatch } = setup();
    drag.begin(pointer());
    dispatch(type, type === 'blur' ? undefined : 1);
    assert.equal(controls.enabled, true);
    assert.equal(captured.size, 0);
    drag.end();
    assert.equal(controls.enabled, true);
  });
}

test('右ボタン・副ポインター・無関係なポインターの終了を無視する', () => {
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

test('アンマウント時に視点操作を元の状態へ戻し、イベント購読を解除する', () => {
  const { controls, captured, pointer, drag, dispatch } = setup();
  drag.begin(pointer());
  drag.end();
  assert.equal(controls.enabled, true);
  assert.equal(captured.size, 0);
  controls.enabled = false;
  dispatch('pointerup', 1);
  assert.equal(controls.enabled, false);
});

test('開始前から無効だった視点操作を無効のまま保持する', () => {
  const { controls, pointer, drag } = setup(false);
  drag.begin(pointer());
  drag.end();
  assert.equal(controls.enabled, false);
});

test('ポインター移動時にボタンが離されていれば視点固定を解除する', () => {
  const { controls, pointer, drag } = setup();
  drag.begin(pointer());
  drag.move(pointer({ buttons: 0 }), () => assert.fail('released pointer moved furniture'));
  assert.equal(controls.enabled, true);
});

test('ドラッグを繰り返しても視点操作を元の状態へ復帰できる', () => {
  const { controls, pointer, drag, dispatch } = setup();
  for (let pointerId = 1; pointerId <= 3; pointerId++) {
    assert.equal(drag.begin(pointer({ pointerId })), true);
    assert.equal(controls.enabled, false);
    dispatch('pointerup', pointerId);
    assert.equal(controls.enabled, true);
  }
});


test('壁や他の家具によって交差位置が変わっても現在のレイから移動先を求める', () => {
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

test('連続移動でもつかんだ位置のずれと開始時の高さを維持する', () => {
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

test('移動平面と交差しないレイを無視し、その後もドラッグを継続できる', () => {
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

test('開始時のレイが不正な場合はポインターを捕捉せず、視点も固定しない', () => {
  const { controls, captured, pointer, drag } = setup();
  const ray = new Ray(new Vector3(2, 10, -3), new Vector3(1, 0, 0));
  assert.equal(drag.begin(pointer({ ray })), false);
  assert.equal(controls.enabled, true);
  assert.equal(captured.size, 0);
});
