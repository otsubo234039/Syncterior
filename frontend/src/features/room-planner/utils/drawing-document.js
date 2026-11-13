import { isFloorPlan } from './floor-plan.js';

export const DRAWING_KEY = 'syncterior.drawing';
const MAX_LENGTH = 1_000_000;
export const isDrawingId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
export const newDrawingId = () => globalThis.crypto.randomUUID();

// IDのない従来の個人配置から図面を開く際の移行用ID。新規の図面にはUUIDを発行する。
export function legacyDrawingId(plan) {
  const raw = JSON.stringify(plan);
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  return `legacy-${(hash >>> 0).toString(16)}-${raw.length}`;
}

export function newDrawing({ name = '新しい図面', w = 8, d = 6, h = 2.5 } = {}) {
  const plan = { version: 1, name, w, d, h, wallThickness: .12,
    floors: [{ id: 'floor', kind: 'room', points: [[0, 0], [w, 0], [w, d], [0, d]] }], walls: [] };
  return isFloorPlan(plan) ? plan : null;
}

// 2Dと3Dが共用する実寸の形状を保存する。画像・表示状態・生成したメッシュは含めない。
export function encodeDrawing(plan, drawingId) {
  if (!isFloorPlan(plan)) throw new Error('図面の形状が不正です。');
  if (drawingId !== undefined && !isDrawingId(drawingId)) throw new Error('図面IDが不正です。');
  const raw = JSON.stringify({ version: 1, plan, ...(drawingId !== undefined ? { drawingId } : {}) });
  if (raw.length > MAX_LENGTH) throw new Error('図面データが大きすぎます。');
  return raw;
}

export function decodeDrawingDocument(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_LENGTH) throw new Error('図面データが大きすぎます。');
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error('図面ファイルを読み込めません。正しいJSONファイルを選択してください。'); }
  if (!value || value.version !== 1 || Object.keys(value).some(key => !['version', 'plan', 'drawingId'].includes(key)) || !isFloorPlan(value.plan)
    || (value.drawingId !== undefined && !isDrawingId(value.drawingId))) {
    throw new Error('対応していない図面、または不正な図面データです。');
  }
  return { plan: value.plan, ...(value.drawingId !== undefined ? { drawingId: value.drawingId } : {}) };
}

export const decodeDrawing = raw => decodeDrawingDocument(raw).plan;

export function createDrawingStorage(getStorage = () => globalThis.localStorage) {
  return {
    load() {
      try {
        const raw = getStorage().getItem(DRAWING_KEY);
        return { ...(raw === null ? { plan: null } : decodeDrawingDocument(raw)), error: '' };
      } catch { return { plan: null, error: '保存した図面を読み込めませんでした。新規作成や図面ファイルから編集を続けられます。' }; }
    },
    save(plan, drawingId) {
      try { getStorage().setItem(DRAWING_KEY, encodeDrawing(plan, drawingId)); return { error: '' }; }
      catch { return { error: '図面を保存できませんでした。編集を続けるか、図面ファイルを書き出してください。' }; }
    },
  };
}
