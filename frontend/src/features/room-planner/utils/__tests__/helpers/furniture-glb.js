// 自作の机。商品モデルや外部サービスに依存せず、実際のGLB経路を検証する。
export function furnitureGlb(edit = () => {}) {
  const positions = new Float32Array([-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5,
    -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5]);
  const indices = new Uint16Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
  let binary = new Uint8Array(positions.byteLength + indices.byteLength);
  binary.set(new Uint8Array(positions.buffer)); binary.set(new Uint8Array(indices.buffer), positions.byteLength);
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ children: [1,2,3,4,5], translation: [6,2,-5] },
      { mesh: 0, scale: [1.2,.1,.6], translation: [0,.75,0] },
      ...[-1,1].flatMap(x => [-1,1].map(z => ({ mesh: 0, scale: [.08,.7,.08], translation: [x*.5,.35,z*.2] })))],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [.8,.3,.12,1], roughnessFactor: .8, metallicFactor: 0 } }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-.5,-.5,-.5], max: [.5,.5,.5] },
      { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength }],
    buffers: [{ byteLength: binary.byteLength }],
  };
  binary = edit(json, binary) ?? binary;
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const length = Math.ceil(encoded.byteLength / 4) * 4;
  const buffer = new ArrayBuffer(12 + 8 + length + 8 + binary.byteLength), view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, length, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer,20,length).fill(32); new Uint8Array(buffer,20,encoded.length).set(encoded);
  view.setUint32(20+length,binary.length,true); view.setUint32(24+length,0x004e4942,true);
  new Uint8Array(buffer,28+length).set(binary);
  return buffer;
}
