// メモリ上の原本を残すので、IndexedDBが使えなくてもこの画面での編集は継続できる。
const memory = new Map();
export const MODEL_DATABASE = 'syncterior.furniture-models';

function accessModel(id, bytes) {
  return new Promise((resolve, reject) => {
    let database, transaction, settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); database?.close();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => {
      try { transaction?.abort(); } catch { /* 終了済みのトランザクションには触れない。 */ }
      finish(new Error('家具の保存領域に接続できませんでした。'));
    }, 5000);
    try {
      const open = globalThis.indexedDB.open(MODEL_DATABASE, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('models');
      open.onerror = () => finish(open.error);
      open.onblocked = () => finish(new Error('家具の保存領域を開けませんでした。'));
      open.onsuccess = () => {
        database = open.result;
        if (settled) { database.close(); return; }
        try {
          transaction = database.transaction('models', bytes ? 'readwrite' : 'readonly');
          const store = transaction.objectStore('models');
          const request = bytes ? store.put(bytes, id) : store.get(id);
          transaction.oncomplete = () => finish(null, request.result);
          transaction.onabort = () => finish(transaction.error ?? new Error('家具の保存を完了できませんでした。'));
          transaction.onerror = () => finish(transaction.error ?? new Error('家具の保存に失敗しました。'));
        } catch (error) { finish(error); }
      };
    } catch (error) { finish(error); }
  });
}

export async function saveFurnitureAsset(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const assetId = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
  memory.set(assetId, bytes);
  try {
    await accessModel(assetId, bytes);
    memory.delete(assetId);
    return { assetId, error: '' };
  } catch {
    return { assetId, error: '家具モデルを保存できませんでした。この画面では使えますが、再読み込み後は再取り込みが必要です。' };
  }
}

export async function loadFurnitureAsset(assetId) {
  if (memory.has(assetId)) return memory.get(assetId);
  let bytes;
  try { bytes = await accessModel(assetId); }
  catch { throw new Error('家具モデルの保存領域を読み込めません。削除して再取り込みしてください。'); }
  if (!(bytes instanceof ArrayBuffer)) throw new Error('保存した家具モデルが見つかりません。削除して再取り込みしてください。');
  // 読み込んだ全モデルを無期限にキャッシュしない。
  return bytes;
}
