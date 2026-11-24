import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isRoomLayout } from '../utils/room-state';
import { findFurniturePosition } from '../utils/floor-plan-furniture';
import { plans } from '../data/plans';
import { initialFurniture, uid } from '../utils/furniture';
import { createRoomSession } from '../utils/room-session';
import { roomLink, sharedRoomId } from '../utils/room-link';
import { roomApi } from '../api/room-api';
import { createLocalRoomStorage } from '../utils/local-room-storage';
import { CUSTOM_PLAN_KEY, isFloorPlan, polygonArea } from '../utils/floor-plan';
import { createDrawingStorage, newDrawing, newDrawingId, legacyDrawingId } from '../utils/drawing-document';
import { constrainFurnitureToRoom } from '../utils/furniture-bounds';
import { modelDimensionsValid } from '../utils/imported-furniture';
import { MAX_MODEL_BYTES } from '../utils/furniture-glb';
import { saveFurnitureAsset } from '../utils/furniture-asset-storage';
import { useFurnitureGeneration } from './use-furniture-generation';

export function useRoomPlanner({ generateFurnitureModel = null } = {}) {
  const [local] = useState(() => {
    const storage = createLocalRoomStorage();
    const roomId = sharedRoomId(window.location.href);
    // 共有リンクでは個人保存を読み込まず、共有先の取得を優先する。
    return { storage, roomId, restored: roomId ? { room: null, error: '' } : storage.load() };
  });
  const [localSave, setLocalSave] = useState(() => ({
    error: local.restored.error,
    message: local.restored.room ? '保存した個人配置を復元しました。' : 'このブラウザに自動保存',
  }));
  const sceneDrawingId = useRef(local.restored.drawingId
    ?? (local.restored.room?.customPlan ? legacyDrawingId(local.restored.room.customPlan) : undefined));
  const [session] = useState(() => createRoomSession({
    api: roomApi,
    initialRoom: local.restored.room ?? { planKey: 'studio', items: initialFurniture('studio') },
    roomId: local.roomId,
    onLocalChange: room => setLocalSave({ ...local.storage.save(room, sceneDrawingId.current), message: '個人配置をこのブラウザに保存しました。' }),
    onRoomChange: id => window.history.replaceState(null, '', roomLink(window.location.href, id)),
  }));
  const collaboration = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [placementError, setPlacementError] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState(local.roomId ? 'layout' : 'drawing');
  const [drawingStore] = useState(() => createDrawingStorage());
  const [drawingInitial] = useState(() => drawingStore.load());
  const [savedDrawing, setSavedDrawing] = useState(drawingInitial.plan);
  const [savedDrawingId, setSavedDrawingId] = useState(drawingInitial.drawingId
    ?? (drawingInitial.plan ? sceneDrawingId.current ?? legacyDrawingId(drawingInitial.plan) : undefined));
  const [drawing, setDrawing] = useState(() => ({
    plan: drawingInitial.plan ?? local.restored.room?.customPlan ?? newDrawing(),
    drawingId: savedDrawingId ?? sceneDrawingId.current ?? newDrawingId(),
    image: null, generation: 0, modified: false,
  }));
  const [drawingNotice, setDrawingNotice] = useState({ error: drawingInitial.error, message: drawingInitial.plan
    ? '保存した図面を開きました。' : '' });
  const drawingDirty = drawing.drawingId !== savedDrawingId || JSON.stringify(drawing.plan) !== JSON.stringify(savedDrawing);
  const [selected, setSelected] = useState(null);
  const [showSizes, setShowSizes] = useState(true);
  const [furnitureImport, setFurnitureImport] = useState({ draft: null, busy: false, error: '', message: '' });
  const modelImportController = useRef(null);
  const modelImportSaving = useRef(false);
  const { planKey, items } = collaboration.room;
  const editable = ['local', 'connected'].includes(collaboration.status) && !collaboration.changingPlan;
  const customPlan = planKey === CUSTOM_PLAN_KEY ? collaboration.room.customPlan : null;
  const preserveDrawingItems = Boolean(customPlan && sceneDrawingId.current === drawing.drawingId);
  const plan = customPlan ? { ...customPlan,
    area: customPlan.floors.filter(floor => floor.kind === 'room').reduce((area, floor) => area + polygonArea(floor.points), 0) } : plans[planKey];
  const active = items.find(item => item.id === selected);

  const cancelFurnitureImport = () => {
    modelImportController.current?.abort(); modelImportSaving.current = false;
    setFurnitureImport({ draft: null, busy: false, error: '', message: '' });
  };
  useEffect(() => {
    cancelFurnitureImport();
    return () => modelImportController.current?.abort();
  }, [workspaceMode, collaboration.status, planKey, customPlan]);
  useEffect(() => {
    const draft = furnitureImport.draft;
    return () => { if (draft) draft.library.disposeFurnitureModel(draft.model.scene); };
  }, [furnitureImport.draft?.model]);

  const readFurnitureFile = async (file, metadata = {}, signal) => {
    cancelFurnitureImport();
    if (!file || signal?.aborted || collaboration.status !== 'local') return false;
    if (!/\.glb$/i.test(file.name) || file.size > MAX_MODEL_BYTES || file.size < 28) {
      setFurnitureImport({ draft: null, busy: false, error: '20MB以下のGLBファイルを選択してください。', message: '' });
      return false;
    }
    const controller = new AbortController(); modelImportController.current = controller;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    setFurnitureImport({ draft: null, busy: true, error: '', message: '' });
    try {
      const bytes = await file.arrayBuffer(); controller.signal.throwIfAborted();
      const library = await import('../utils/furniture-model'); controller.signal.throwIfAborted();
      const model = await library.loadFurnitureModel(bytes, controller.signal);
      if (controller.signal.aborted) { library.disposeFurnitureModel(model.scene); return false; }
      if (metadata.source && !modelDimensionsValid(model.size)) {
        library.disposeFurnitureModel(model.scene);
        throw new Error('生成されたモデルのサイズが配置できる範囲外です。');
      }
      const dimensions = Object.fromEntries(Object.entries(model.size).map(([key, value]) => [key, Math.max(.02, Math.min(20, value)).toFixed(3)]));
      setFurnitureImport({ draft: { bytes, library, model, name: file.name.replace(/\.glb$/i, '').slice(0,80),
        ...(metadata.source ? model.size : dimensions), ...metadata, modelUp: 'y', modelFront: 0 }, busy: false, error: '', message: '' });
      return true;
    } catch (error) {
      if (!controller.signal.aborted) setFurnitureImport({ draft: null, busy: false, error: error.message, message: '' });
      return false;
    } finally { signal?.removeEventListener('abort', abort); }
  };
  const furnitureGeneration = useFurnitureGeneration({ generate: generateFurnitureModel, readModel: readFurnitureFile,
    cancelModel: cancelFurnitureImport, workspaceMode, status: collaboration.status, planKey, customPlan });
  const updateFurnitureDraft = patch => setFurnitureImport(previous => {
    if (!previous.draft) return previous;
    const draft = { ...previous.draft, ...patch };
    if (draft.source && (Object.hasOwn(patch, 'modelUp') || Object.hasOwn(patch, 'modelFront'))) {
      Object.assign(draft, draft.library.furnitureModelSize(draft.model.scene, draft.modelUp, draft.modelFront));
    }
    return { ...previous, error: '', draft };
  });
  const importFurniture = async () => {
    const draft = furnitureImport.draft, controller = modelImportController.current;
    if (!draft || modelImportSaving.current || controller?.signal.aborted || collaboration.status !== 'local') return;
    const initial = { type: 'model', name: draft.name.trim(), w: Number(draft.w), d: Number(draft.d), h: Number(draft.h),
      modelUp: draft.modelUp, modelFront: draft.modelFront, color: '#ffffff', id: uid(), x: 0, z: 0, rot: 0 };
    const error = !initial.name || initial.name.length > 80 ? '家具の名前を1〜80文字で入力してください。'
      : !modelDimensionsValid(initial) ? '幅・奥行き・高さを0.02〜20mで入力してください。' : '';
    if (error) { setFurnitureImport(previous => ({ ...previous, error })); return; }
    const item = customPlan ? findFurniturePosition(initial, customPlan) : constrainFurnitureToRoom(initial, plan);
    if (!item || items.length >= 200) {
      setFurnitureImport(previous => ({ ...previous, error: items.length >= 200 ? '家具は200点まで配置できます。' : 'この家具が床と壁に収まる位置が見つかりませんでした。' }));
      return;
    }
    modelImportSaving.current = true;
    setFurnitureImport(previous => ({ ...previous, busy: true, error: '' }));
    try {
      const stored = await saveFurnitureAsset(draft.bytes);
      const latest = session.getSnapshot();
      if (controller.signal.aborted || latest.status !== 'local') return;
      if (latest.room.planKey !== planKey || (latest.room.customPlan ?? null) !== customPlan || latest.room.items.length >= 200) {
        setFurnitureImport(previous => ({ ...previous, busy: false, error: '部屋や家具数が変わりました。現在の配置を確認して再試行してください。' }));
        return;
      }
      if (session.dispatch({ type: 'add', item: { ...item, assetId: stored.assetId } })) {
        setSelected(item.id); setPlacementError('');
        setFurnitureImport({ draft: null, busy: false, error: stored.error, message: `${item.name}を配置しました。` });
      }
    } catch {
      if (!controller.signal.aborted) setFurnitureImport(previous => ({ ...previous, busy: false, error: '家具を取り込めませんでした。再試行してください。' }));
    } finally { if (modelImportController.current === controller) modelImportSaving.current = false; }
  };

  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);
  useEffect(() => {
    if (!items.some(item => item.id === selected)) setSelected(null);
  }, [items, selected]);
  useEffect(() => {
    if (!drawingDirty || !drawing.modified || collaboration.status !== 'local') return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [drawingDirty, drawing.modified, collaboration.status]);

  const changePlan = key => {
    setPlacementError('');
    const previous = sceneDrawingId.current; sceneDrawingId.current = undefined;
    if (session.dispatch({ type: 'change-plan', planKey: key, items: initialFurniture(key) })) setSelected(null);
    else sceneDrawingId.current = previous;
  };
  const addItem = catalogItem => {
    if (items.length >= 200) return;
    const initial = { ...catalogItem, id: uid(), x: 0, z: 0, rot: 0 };
    const item = customPlan ? findFurniturePosition(initial, customPlan) : initial;
    setPlacementError(item ? '' : 'この家具が床と壁に収まる位置が見つかりませんでした。');
    if (!item) return;
    if (session.dispatch({ type: 'add', item })) setSelected(item.id);
  };
  const update = (id, patch) => session.dispatch({ type: 'update', id, patch });
  const moveItem = (id, x, z) => session.dispatch({ type: 'update', id, patch: { x, z },
    ...(customPlan ? { slideAlongWalls: true } : {}) });
  const rotate = () => active && session.dispatch({ type: 'rotate', id: active.id });
  const removeSelected = () => {
    if (selected && session.dispatch({ type: 'remove', id: selected })) setSelected(null);
  };
  const clearLocalSave = () => setLocalSave({
    ...local.storage.clear(), message: '保存データを削除しました。画面の配置は残ります。',
  });
  const leaveRoom = () => {
    session.leave();
    setLocalSave({ error: '', message: '共同編集から退出しました。' });
  };
  const importFloorPlan = (value, preserveItems = false) => {
    if (collaboration.status !== 'local' || !isFloorPlan(value)) return false;
    const nextItems = preserveItems && customPlan ? items : [];
    if (!isRoomLayout({ planKey: CUSTOM_PLAN_KEY, customPlan: value, items: nextItems })) return false;
    setSelected(null);
    setPlacementError('');
    return session.dispatch({ type: 'change-plan', planKey: CUSTOM_PLAN_KEY, customPlan: value, items: nextItems });
  };
  const replaceDrawing = (value, image = null, { newDocument = true, drawingId } = {}) => {
    if (collaboration.status !== 'local' || !isFloorPlan(value)) return false;
    setDrawing(previous => ({ plan: value, image, generation: previous.generation + 1, modified: true,
      drawingId: drawingId ?? (newDocument ? newDrawingId() : previous.drawingId) }));
    setDrawingNotice({ error: '', message: '図面を開きました。' });
    return true;
  };
  const startDrawingImport = () => {
    if (collaboration.status !== 'local') return false;
    setDrawing(previous => ({ plan: null, image: null, generation: previous.generation + 1,
      drawingId: newDrawingId(), modified: true }));
    setDrawingNotice({ error: '', message: '新しい画像へ切り替えました。サイズを合わせて「図面へ変換」を押してください。' });
    return true;
  };
  const saveDrawing = value => {
    if (collaboration.status !== 'local') return false;
    const result = drawingStore.save(value, drawing.drawingId);
    setDrawingNotice({ ...result, message: result.error ? '' : '図面を保存しました。' });
    if (result.error) return false;
    setSavedDrawing(structuredClone(value));
    setSavedDrawingId(drawing.drawingId);
    setDrawing(previous => ({ ...previous, modified: false }));
    return true;
  };
  const generateFromDrawing = value => {
    const previous = sceneDrawingId.current; sceneDrawingId.current = drawing.drawingId;
    if (!importFloorPlan(value, preserveDrawingItems)) {
      sceneDrawingId.current = previous;
      setDrawingNotice({ error: '家具が新しい床や壁に収まりません。家具を移動・削除してから3Dへ反映してください。図面はそのまま保存できます。', message: '' });
      return false;
    }
    setWorkspaceMode('layout');
    return true;
  };

  return {
    planKey, plan, items, selected, active, showSizes, editable,
    changePlan, addItem, update, moveItem, rotate, setSelected, removeSelected,
    toggleSizes: () => setShowSizes(value => !value),
    collaboration, shareRoom: session.share, reconnect: session.reconnect, leaveRoom,
    localSave, clearLocalSave,
    customPlan, importFloorPlan, placementError,
    furnitureImport, readFurnitureFile, updateFurnitureDraft, importFurniture, cancelFurnitureImport,
    furnitureGeneration,
    workspaceMode, setWorkspaceMode, drawing, drawingDirty, savedDrawing, savedDrawingId, drawingNotice, preserveDrawingItems,
    replaceDrawing, startDrawingImport, saveDrawing, generateFromDrawing,
    updateDrawing: (value, generation) => {
      if (collaboration.status === 'local') setDrawing(previous => previous.generation === generation
        ? { ...previous, plan: value, modified: true } : previous);
    },
    shareUrl: collaboration.roomId ? roomLink(window.location.href, collaboration.roomId) : '',
  };
}
