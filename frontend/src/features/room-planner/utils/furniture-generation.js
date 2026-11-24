import { MAX_MODEL_BYTES } from './furniture-glb.js';

export const MAX_FURNITURE_IMAGES = 4;
export const MAX_FURNITURE_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateFurnitureImages(files, existingCount = 0) {
  if (!files.length || files.length + existingCount > MAX_FURNITURE_IMAGES) {
    throw new Error('家具の画像は1〜4枚まで選択してください。');
  }
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      || file.size <= 0 || file.size > MAX_FURNITURE_IMAGE_BYTES) {
      throw new Error('1枚10MB以下のJPEG・PNG・WebP画像を選択してください。');
    }
  }
}

export function furnitureGenerationRequest(draft) {
  validateFurnitureImages(draft.images);
  const name = draft.name.trim();
  if (!name || name.length > 80) throw new Error('家具の名前を1〜80文字で入力してください。');
  return { images: [...draft.images], name };
}

// 元画像は送信用に保持し、表示URLだけを作る。サービス固有の形式には変換しない。
export async function readFurnitureImages(files, signal, {
  decode = file => createImageBitmap(file),
  createUrl = file => URL.createObjectURL(file),
  revokeUrl = url => URL.revokeObjectURL(url),
} = {}) {
  validateFurnitureImages(files);
  const images = [];
  try {
    for (const file of files) {
      signal.throwIfAborted();
      let bitmap;
      try { bitmap = await decode(file); }
      catch { throw new Error('画像を読み込めませんでした。JPEG・PNG・WebPの画像を確認してください。'); }
      try {
        signal.throwIfAborted();
        if (bitmap.width < 32 || bitmap.height < 32 || bitmap.width > 8192 || bitmap.height > 8192
          || bitmap.width * bitmap.height > 20_000_000) {
          throw new Error('画像は各辺32〜8192px、合計2000万画素以下にしてください。');
        }
        images.push({ file, url: createUrl(file) });
      } finally { bitmap.close(); }
    }
    return images;
  } catch (error) {
    images.forEach(image => revokeUrl(image.url));
    throw error;
  }
}

// 接続口: generate(request, { signal, onProgress }) -> Promise<{ file: File }>。
// ジョブID、認証、ポーリング、サービス固有のURLは接続側に閉じ込める。
export async function runFurnitureGeneration(generate, draft, { signal, onProgress }) {
  signal.throwIfAborted();
  const request = furnitureGenerationRequest(draft);
  if (typeof generate !== 'function') throw new Error('モデルを作成できませんでした。もう一度お試しください。');
  let abort;
  let finished = false;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return generate(request, { signal, onProgress: value => {
          if (finished || signal.aborted || !['queued', 'running'].includes(value?.phase)) return;
          const progress = Number.isFinite(value.progress) ? Math.max(0, Math.min(100, value.progress)) : null;
          onProgress?.({ phase: value.phase, progress });
        } });
      }),
      new Promise((_, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
    signal.throwIfAborted();
    if (!(result?.file instanceof Blob) || !/\.glb$/i.test(result.file.name ?? '')
      || result.file.size < 28 || result.file.size > MAX_MODEL_BYTES) {
      throw new Error('生成結果を取得できませんでした。20MB以下のGLBが必要です。');
    }
    return { file: result.file, metadata: { name: request.name } };
  } finally {
    finished = true;
    signal.removeEventListener('abort', abort);
  }
}
