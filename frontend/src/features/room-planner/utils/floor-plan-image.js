import opencvUrl from '@techstark/opencv-js/dist/opencv.js?url';
import { floorPlanFromLines } from './floor-plan-detection.js';

export async function readFloorPlanImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error('JPEG・PNG・WebPの10MB以下の画像を選択してください。');
  }
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('画像を読み込めませんでした。ファイルが壊れていないか確認してください。'); }
  try {
    if (bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 20_000_000
      || bitmap.width < 32 || bitmap.height < 32) throw new Error('画像は各辺32〜8192px、合計2000万画素以下にしてください。');
    const ratio = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { pixels: context.getImageData(0, 0, canvas.width, canvas.height), preview: canvas.toDataURL('image/png') };
  } finally { bitmap.close(); }
}

export function recognizeFloorPlan(image, signal) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./opencv-worker.js', import.meta.url));
    const finish = (error, result) => {
      worker.terminate(); clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(new DOMException('解析を中止しました。', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('画像解析が時間内に完了しませんでした。再試行してください。')), 60_000);
    worker.onerror = () => finish(new Error('画像解析を起動できませんでした。再試行してください。'));
    worker.onmessage = ({ data }) => {
      if (data.error) return finish(new Error(data.error));
      try { finish(null, { plan: floorPlanFromLines(data), engine: data.engine }); }
      catch (error) { finish(error); }
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) return abort();
    // 原本を転送しないので、再解析にも同じ画像を使える。
    const pixels = image.pixels.data.slice().buffer;
    worker.postMessage({ url: new URL(opencvUrl, location.href).href, pixels,
      width: image.pixels.width, height: image.pixels.height }, [pixels]);
  });
}
