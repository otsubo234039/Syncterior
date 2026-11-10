import { useEffect, useState, useSyncExternalStore } from 'react';
import { isRoomLayout } from '../utils/room-state';
import { findFurniturePosition } from '../utils/floor-plan-furniture';
import { plans } from '../data/plans';
import { initialFurniture, uid } from '../utils/furniture';
import { createRoomSession } from '../utils/room-session';
import { roomLink, sharedRoomId } from '../utils/room-link';
import { roomApi } from '../api/room-api';
import { createLocalRoomStorage } from '../utils/local-room-storage';
import { CUSTOM_PLAN_KEY, isFloorPlan, polygonArea } from '../utils/floor-plan';

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
  const [session] = useState(() => createRoomSession({
    api: roomApi,
    initialRoom: local.restored.room ?? { planKey: 'studio', items: initialFurniture('studio') },
    roomId: local.roomId,
    onLocalChange: room => setLocalSave({ ...local.storage.save(room), message: '個人配置をこのブラウザに保存しました。' }),
    onRoomChange: id => window.history.replaceState(null, '', roomLink(window.location.href, id)),
  }));
  const collaboration = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [placementError, setPlacementError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showSizes, setShowSizes] = useState(true);
  const { planKey, items } = collaboration.room;
  const editable = ['local', 'connected'].includes(collaboration.status) && !collaboration.changingPlan;
  const customPlan = planKey === CUSTOM_PLAN_KEY ? collaboration.room.customPlan : null;
  const plan = customPlan ? { ...customPlan, desc: '図面からの概算モデル・測った一辺でサイズを合わせられます',
    area: customPlan.floors.filter(floor => floor.kind === 'room').reduce((area, floor) => area + polygonArea(floor.points), 0) } : plans[planKey];
  const active = items.find(item => item.id === selected);

  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);
  useEffect(() => {
    if (!items.some(item => item.id === selected)) setSelected(null);
  }, [items, selected]);

  const changePlan = key => {
    setPlacementError('');
    if (session.dispatch({ type: 'change-plan', planKey: key, items: initialFurniture(key) })) setSelected(null);
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

  return {
    planKey, plan, items, selected, active, showSizes, editable,
    changePlan, addItem, update, moveItem, rotate, setSelected, removeSelected,
    toggleSizes: () => setShowSizes(value => !value),
    collaboration, shareRoom: session.share, reconnect: session.reconnect, leaveRoom,
    localSave, clearLocalSave,
    customPlan, importFloorPlan, placementError,
    shareUrl: collaboration.roomId ? roomLink(window.location.href, collaboration.roomId) : '',
  };
}
