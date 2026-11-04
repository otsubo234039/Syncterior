import { useEffect, useState, useSyncExternalStore } from 'react';
import { plans } from '../data/plans';
import { initialFurniture, uid } from '../utils/furniture';
import { createRoomSession } from '../utils/room-session';
import { roomLink, sharedRoomId } from '../utils/room-link';
import { roomApi } from '../api/room-api';

export function useRoomPlanner() {
  const [session] = useState(() => createRoomSession({
    api: roomApi,
    initialRoom: { planKey: 'studio', items: initialFurniture('studio') },
    roomId: sharedRoomId(window.location.href),
    onRoomChange: id => window.history.replaceState(null, '', roomLink(window.location.href, id)),
  }));
  const collaboration = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [selected, setSelected] = useState(null);
  const [showSizes, setShowSizes] = useState(true);
  const { planKey, items } = collaboration.room;
  const editable = ['local', 'connected'].includes(collaboration.status) && !collaboration.changingPlan;
  const plan = plans[planKey];
  const active = items.find(item => item.id === selected);

  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);
  useEffect(() => {
    if (!items.some(item => item.id === selected)) setSelected(null);
  }, [items, selected]);

  const changePlan = key => {
    if (session.dispatch({ type: 'change-plan', planKey: key, items: initialFurniture(key) })) setSelected(null);
  };
  const addItem = catalogItem => {
    if (items.length >= 200) return;
    const item = { ...catalogItem, id: uid(), x: 0, z: 0, rot: 0 };
    if (session.dispatch({ type: 'add', item })) setSelected(item.id);
  };
  const update = (id, patch) => session.dispatch({ type: 'update', id, patch });
  const moveItem = (id, x, z) => update(id, { x, z });
  const rotate = () => active && session.dispatch({ type: 'rotate', id: active.id });
  const removeSelected = () => {
    if (selected && session.dispatch({ type: 'remove', id: selected })) setSelected(null);
  };

  return {
    planKey, plan, items, selected, active, showSizes, editable,
    changePlan, addItem, update, moveItem, rotate, setSelected, removeSelected,
    toggleSizes: () => setShowSizes(value => !value),
    collaboration, shareRoom: session.share, reconnect: session.reconnect, leaveRoom: session.leave,
    shareUrl: collaboration.roomId ? roomLink(window.location.href, collaboration.roomId) : '',
  };
}
