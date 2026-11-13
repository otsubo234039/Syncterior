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

export function useRoomPlanner() {
  const [local] = useState(() => {
    const storage = createLocalRoomStorage();
    const roomId = sharedRoomId(window.location.href);
    // 共有リンクでは個人保存を読み込まず、共有先の取得を優先する。
    return { storage, roomId, restored: roomId ? { room: null, error: '' } : storage.load() };
  });
  const [localSave, setLocalSave] = useState(() => ({
    error: local.restored.error,
    message: local.restored.room ? '保存した個人配置を復元しました。' : '個人編集はこのブラウザに自動保存されます。',
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
    ? '保存した図面を開きました。' : '図面を作成し、3Dを開かずに保存できます。' });
  const drawingDirty = drawing.drawingId !== savedDrawingId || JSON.stringify(drawing.plan) !== JSON.stringify(savedDrawing);
  const [selected, setSelected] = useState(null);
  const [showSizes, setShowSizes] = useState(true);
  const { planKey, items } = collaboration.room;
  const editable = ['local', 'connected'].includes(collaboration.status) && !collaboration.changingPlan;
  const customPlan = planKey === CUSTOM_PLAN_KEY ? collaboration.room.customPlan : null;
  const preserveDrawingItems = Boolean(customPlan && sceneDrawingId.current === drawing.drawingId);
  const plan = customPlan ? { ...customPlan, desc: '2D図面から生成した間取り・壁や床の変更は図面モードで行えます',
    area: customPlan.floors.filter(floor => floor.kind === 'room').reduce((area, floor) => area + polygonArea(floor.points), 0) } : plans[planKey];
  const active = items.find(item => item.id === selected);

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
    ...local.storage.clear(), message: '保存した個人配置を消去しました。画面の配置は残り、次の個人編集から再び保存します。',
  });
  const leaveRoom = () => {
    session.leave();
    setLocalSave({ error: '', message: '共有から退出しました。個人保存は変更していません。次の編集から保存します。' });
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
    setDrawingNotice({ error: '', message: '図面を開きました。「図面を保存」でこのブラウザに保存できます。' });
    return true;
  };
  const saveDrawing = value => {
    if (collaboration.status !== 'local') return false;
    const result = drawingStore.save(value, drawing.drawingId);
    setDrawingNotice({ ...result, message: result.error ? '' : '図面をこのブラウザに保存しました。3Dを開かなくても復元できます。' });
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
    workspaceMode, setWorkspaceMode, drawing, drawingDirty, savedDrawing, savedDrawingId, drawingNotice, preserveDrawingItems,
    replaceDrawing, saveDrawing, generateFromDrawing,
    updateDrawing: (value, generation) => {
      if (collaboration.status === 'local') setDrawing(previous => previous.generation === generation
        ? { ...previous, plan: value, modified: true } : previous);
    },
    setDrawingImage: image => setDrawing(previous => ({ ...previous, image })),
    shareUrl: collaboration.roomId ? roomLink(window.location.href, collaboration.roomId) : '',
  };
}
