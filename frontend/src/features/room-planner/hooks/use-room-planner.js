import { useState } from 'react';
import { plans } from '../data/plans';
import { initialFurniture, uid } from '../utils/furniture';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function useRoomPlanner() {
  const [planKey, setPlanKey] = useState('studio');
  const [items, setItems] = useState(() => initialFurniture('studio'));
  const [selected, setSelected] = useState(null);
  const [showSizes, setShowSizes] = useState(true);
  const plan = plans[planKey],
    active = items.find(x => x.id === selected);
  const changePlan = key => {
    setPlanKey(key);
    setItems(initialFurniture(key));
    setSelected(null);
  };
  const addItem = c => {
    const item = {
      ...c,
      id: uid(),
      x: 0,
      z: 0,
      rot: 0
    };
    setItems(a => [...a, item]);
    setSelected(item.id);
  };
  const update = (id, patch) => setItems(a => a.map(x => x.id === id ? {
    ...x,
    ...patch
  } : x));
  const moveItem = (id, x, z) => {
    const halfW = plan.w / 2,
      halfD = plan.d / 2,
      item = items.find(a => a.id === id);
    if (!item) return;
    update(id, {
      x: clamp(x, -halfW + item.w / 2, halfW - item.w / 2),
      z: clamp(z, -halfD + item.d / 2, halfD - item.d / 2)
    });
  };
  const rotate = () => active && update(active.id, {
    rot: active.rot + Math.PI / 2
  });
  const removeSelected = () => {
    if (selected) {
      setItems(a => a.filter(x => x.id !== selected));
      setSelected(null);
    }
  };
  const toggleSizes = () => setShowSizes(value => !value);
  return {
    planKey,
    plan,
    items,
    selected,
    active,
    showSizes,
    changePlan,
    addItem,
    update,
    moveItem,
    rotate,
    setSelected,
    removeSelected,
    toggleSizes
  };
}
