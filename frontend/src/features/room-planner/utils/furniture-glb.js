export const MAX_MODEL_BYTES = 20 * 1024 * 1024;
const fail = message => { throw new Error(message); };
const integer = value => Number.isSafeInteger(value) && value >= 0;

// GLTFLoaderより先に検査し、外部取得・デコーダー取得を伴うモデルを読み込まない。
export function inspectFurnitureGlb(buffer) {
  try { return inspectGlb(buffer); }
  catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) fail('GLBの構造が正しくありません。ファイルを確認してください。');
    throw error;
  }
}

function inspectGlb(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 28 || buffer.byteLength > MAX_MODEL_BYTES) {
    fail('20MB以下のGLBファイルを選択してください。');
  }
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
    || view.getUint32(8, true) !== buffer.byteLength) fail('有効なglTF 2.0のGLBファイルではありません。');
  let offset = 12, json, binary;
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) fail('GLBのデータが途中で切れています。');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    offset += 8;
    if (length % 4 || offset + length > buffer.byteLength) fail('GLBのデータ長が正しくありません。');
    if (type === 0x4e4f534a && !json && offset === 20) {
      try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buffer, offset, length))); }
      catch { fail('GLBのJSONを読み込めませんでした。'); }
    } else if (type === 0x004e4942 && json && !binary) binary = new Uint8Array(buffer, offset, length);
    else fail('このGLBのチャンク構成には対応していません。');
    offset += length;
  }
  if (!json || json.asset?.version !== '2.0' || !binary || !Array.isArray(json.buffers)
    || json.buffers.length !== 1 || !integer(json.buffers[0].byteLength)
    || json.buffers[0].byteLength > binary.byteLength || json.buffers[0].byteLength < binary.byteLength - 3) {
    fail('形状データを埋め込んだGLBを選択してください。');
  }
  const allowedExtensions = ['KHR_materials_unlit', 'KHR_materials_ior', 'KHR_materials_clearcoat',
    'KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_specular', 'KHR_texture_transform',
    'KHR_materials_emissive_strength', 'KHR_materials_sheen'];
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'uri')) fail('外部参照のない、画像と形状を埋め込んだGLBを選択してください。');
    if (value.extensions && Object.keys(value.extensions).some(key => !allowedExtensions.includes(key))) {
      fail('圧縮など未対応の拡張があります。圧縮なしのGLBで書き出してください。');
    }
    for (const child of Object.values(value)) inspect(child);
  };
  inspect(json);
  if ([...(json.extensionsRequired ?? []), ...(json.extensionsUsed ?? [])].some(key => !allowedExtensions.includes(key))) {
    fail('圧縮など未対応の拡張があります。圧縮なしのGLBで書き出してください。');
  }
  if (json.skins?.length || json.animations?.length || json.cameras?.length) fail('アニメーション・カメラを含まない静的な家具モデルを選択してください。');
  if (!Array.isArray(json.nodes) || json.nodes.length > 256 || !Array.isArray(json.meshes)
    || !json.meshes.length || json.meshes.length > 128 || (json.materials?.length ?? 0) > 64) fail('家具モデルが空か、部品数が多すぎます。');
  const bufferView = index => {
    const part = json.bufferViews?.[index];
    if (!part || part.buffer !== 0 || !integer(part.byteOffset ?? 0) || !integer(part.byteLength)
      || (part.byteOffset ?? 0) + part.byteLength > json.buffers[0].byteLength) fail('GLBのバッファ参照が正しくありません。');
    return binary.subarray(part.byteOffset ?? 0, (part.byteOffset ?? 0) + part.byteLength);
  };
  (json.bufferViews ?? []).forEach((_, index) => bufferView(index));
  for (const accessor of json.accessors ?? []) {
    if (!integer(accessor.count) || accessor.count > 300_000 || accessor.sparse) fail('頂点数が多すぎるか、未対応の形状データです。');
    bufferView(accessor.bufferView);
  }
  const meshCounts = json.meshes.map(mesh => {
    if (!Array.isArray(mesh.primitives) || !mesh.primitives.length) fail('空の形状が含まれています。');
    return mesh.primitives.reduce((total, primitive) => {
      const positions = json.accessors?.[primitive.attributes?.POSITION];
      const indices = primitive.indices === undefined ? positions : json.accessors?.[primitive.indices];
      if ((primitive.mode ?? 4) !== 4 || primitive.targets || !positions || !indices
        || positions.type !== 'VEC3' || indices.count % 3) fail('三角形メッシュの静的な家具モデルを選択してください。');
      return total + indices.count / 3;
    }, 0);
  });
  let triangles = 0;
  const visit = (index, visited) => {
    if (!integer(index) || !json.nodes[index] || visited.has(index)) fail('GLBのノード参照が正しくありません。');
    visited.add(index);
    const node = json.nodes[index];
    if (node.mesh !== undefined) {
      if (!integer(node.mesh) || meshCounts[node.mesh] === undefined) fail('GLBの形状参照が正しくありません。');
      triangles += meshCounts[node.mesh];
    }
    for (const key of ['matrix', 'translation', 'rotation', 'scale']) {
      if (node[key] !== undefined && (!Array.isArray(node[key]) || !node[key].every(Number.isFinite))) fail('形状に不正な数値が含まれています。');
    }
    for (const child of node.children ?? []) visit(child, visited);
  };
  if (json.scenes?.length !== 1) fail('シーンが1つのGLBを選択してください。');
  const scene = json.scenes?.[json.scene ?? 0];
  if (!scene?.nodes?.length) fail('表示できる形状がありません。');
  const visited = new Set();
  for (const index of scene.nodes) visit(index, visited);
  if (visited.size !== json.nodes.length) fail('シーンに含まれない部品を除いて書き出してください。');
  if (triangles < 1 || triangles > 100_000) fail('家具1点の三角形数は10万以下にしてください。');
  if ((json.images?.length ?? 0) > 8) fail('画像は8枚以下のモデルにしてください。');
  let pixels = 0;
  for (const image of json.images ?? []) {
    const bytes = bufferView(image.bufferView);
    const [width, height] = embeddedImageSize(bytes, image.mimeType);
    pixels += width * height;
    if (width < 1 || height < 1 || width > 2048 || height > 2048 || pixels > 16_777_216) fail('テクスチャは各辺2048px以下、合計1600万画素以下にしてください。');
  }
  return { triangles };
}

function embeddedImageSize(bytes, mime) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png' && bytes.length >= 24 && view.getUint32(0) === 0x89504e47
    && view.getUint32(4) === 0x0d0a1a0a && view.getUint32(12) === 0x49484452) {
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 7) {
        return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
      }
      offset += length;
    }
  }
  if (mime === 'image/webp' && bytes.length >= 30 && view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
    const type = view.getUint32(12), u24 = i => bytes[i] | bytes[i+1] << 8 | bytes[i+2] << 16;
    if (type === 0x56503858) return [1 + u24(24), 1 + u24(27)];
    if (type === 0x56503820 && u24(23) === 0x2a019d) return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
    if (type === 0x5650384c && bytes[20] === 0x2f) return [1 + ((bytes[21] | bytes[22] << 8) & 0x3fff), 1 + ((bytes[22] >> 6 | bytes[23] << 2 | bytes[24] << 10) & 0x3fff)];
  }
  fail('PNG・JPEG・WebPを埋め込んだGLBを選択してください。');
}
