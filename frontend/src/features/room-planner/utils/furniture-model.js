import { AmbientLight, Box3, Color, DirectionalLight, Group, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { inspectFurnitureGlb } from './furniture-glb.js';
import { MODEL_UP_AXES, modelDimensionsValid } from './imported-furniture.js';

export function disposeFurnitureModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(child => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of [child.material].flat().filter(Boolean)) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  geometries.forEach(geometry => geometry.dispose());
  textures.forEach(texture => { texture.dispose(); texture.source?.data?.close?.(); });
}

export async function loadFurnitureModel(bytes, signal) {
  signal?.throwIfAborted();
  const details = inspectFurnitureGlb(bytes);
  const gltf = await new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, value) => {
      if (finished) { if (value) disposeFurnitureModel(value.scene); return; }
      finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(new DOMException('家具の読み込みを中止しました。', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('家具の読み込みが時間内に完了しませんでした。')), 20_000);
    signal?.addEventListener('abort', abort, { once: true });
    new GLTFLoader().parseAsync(bytes, '').then(value => finish(null, value), () => finish(new Error('家具モデルを読み込めませんでした。GLBを確認してください。')));
  });
  try {
    gltf.scene.traverse(child => {
      if (!child.isMesh) return;
      const positions = child.geometry.getAttribute('position');
      if (!positions || !Array.from(child.matrixWorld.elements).every(Number.isFinite)) throw new Error('形状に不正な数値があります。');
      for (let index = 0; index < positions.count; index++) {
        if (![positions.getX(index), positions.getY(index), positions.getZ(index)].every(Number.isFinite)) throw new Error('頂点に不正な数値があります。');
      }
      const indices = child.geometry.getIndex();
      for (let index = 0; index < (indices?.count ?? 0); index++) {
        const vertex = indices.getX(index);
        if (!Number.isInteger(vertex) || vertex < 0 || vertex >= positions.count) throw new Error('形状の頂点参照が正しくありません。');
      }
      for (const attribute of Object.values(child.geometry.attributes)) {
        if (!attribute.array.every(Number.isFinite)) throw new Error('形状の属性に不正な数値があります。');
      }
    });
    const size = furnitureModelSize(gltf.scene, 'y', 0);
    return { scene: gltf.scene, size, ...details };
  } catch (error) { disposeFurnitureModel(gltf.scene); throw error; }
}

function orientedModel(scene, up, front) {
  if (!MODEL_UP_AXES.includes(up) || !Number.isInteger(front) || front < 0 || front > 3) throw new Error('家具の向きが正しくありません。');
  const upright = new Group();
  const angles = { y: [0,0,0], z: [-Math.PI/2,0,0], x: [0,0,Math.PI/2],
    '-y': [Math.PI,0,0], '-z': [Math.PI/2,0,0], '-x': [0,0,-Math.PI/2] };
  upright.rotation.set(...angles[up]);
  upright.add(scene.clone(true));
  const heading = new Group(); heading.rotation.y = front * Math.PI / 2; heading.add(upright);
  heading.updateMatrixWorld(true);
  return heading;
}

export function furnitureModelSize(scene, up, front) {
  const box = new Box3().setFromObject(orientedModel(scene, up, front), true);
  const size = box.getSize(new Vector3());
  if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 1e-8)) throw new Error('家具の幅・奥行き・高さを計測できませんでした。');
  return { w: size.x, d: size.z, h: size.y };
}

export function fitFurnitureModel(scene, item) {
  if (!modelDimensionsValid(item)) throw new Error('家具の寸法は0.02〜20mで指定してください。');
  const root = orientedModel(scene, item.modelUp, item.modelFront);
  const box = new Box3().setFromObject(root, true), size = box.getSize(new Vector3());
  if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 1e-8)) throw new Error('家具の寸法が正しくありません。');
  const scaled = new Group(); scaled.scale.set(item.w / size.x, item.h / size.y, item.d / size.z); scaled.add(root);
  const placement = new Group();
  scaled.position.set(-(box.min.x + box.max.x) / 2 * scaled.scale.x, -box.min.y * scaled.scale.y,
    -(box.min.z + box.max.z) / 2 * scaled.scale.z);
  placement.add(scaled);
  const tint = new Color(item.color ?? '#ffffff');
  placement.traverse(child => {
    if (!child.isMesh) return;
    child.castShadow = true; child.receiveShadow = true;
    const clone = material => {
      const copy = material.clone(); copy.color?.multiply(tint); return copy;
    };
    child.material = Array.isArray(child.material) ? child.material.map(clone) : clone(child.material);
  });
  return placement;
}

// インスタンスは原本のgeometry/textureを共有し、複製したmaterialだけを所有する。
export function disposeFurnitureInstance(root) {
  root.traverse(child => { for (const material of [child.material].flat().filter(Boolean)) material.dispose(); });
}

export function createFurniturePreview() {
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(320, 240); renderer.setPixelRatio(1);
  return {
    render(model, item) {
      const scene = new Scene(); scene.background = new Color('#eef2eb');
      const object = fitFurnitureModel(model, item); scene.add(object);
      scene.add(new AmbientLight('#ffffff', 2));
      const light = new DirectionalLight('#ffffff', 3); light.position.set(3, 5, 4); scene.add(light);
      const extent = Math.max(item.w, item.d, item.h);
      const camera = new PerspectiveCamera(40, 4/3, extent / 100, extent * 20);
      camera.position.set(extent * 1.6, item.h/2 + extent * 1.1, extent * 1.8); camera.lookAt(0, item.h/2, 0);
      try { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); }
      finally { disposeFurnitureInstance(object); }
    },
    dispose() { renderer.dispose(); renderer.forceContextLoss(); },
  };
}
