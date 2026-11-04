import React from 'react';
import { useRoomPlanner } from '../hooks/use-room-planner';
import { PlannerSidebar } from './planner-sidebar';
import { PlannerCanvas } from './planner-canvas';
import { FurnitureProperties } from './furniture-properties';
export function RoomPlanner() {
  const planner = useRoomPlanner();
  const {
    plan,
    items,
    planKey,
    changePlan,
    addItem,
    active,
    rotate,
    update
  } = planner;
  const totalArea = (plan.w * plan.d).toFixed(1);
  return <>
 <PlannerSidebar planKey={planKey} changePlan={changePlan} addItem={addItem} />
 <section className="workspace">
    <div className="workspace-top"><div><div className="eyebrow">YOUR SPACE</div><h1>{plan.name}<span> / 3Dレイアウト</span></h1><p>{plan.desc}</p></div><div className="room-metrics"><div><span>ROOM SIZE</span><strong>{totalArea}<small> m²</small></strong></div><div><span>FURNITURE</span><strong>{items.length}<small> 点</small></strong></div></div></div>
<PlannerCanvas {...planner} />
    <div className="workspace-bottom"><div className="hint"><span className="hint-key">TIP</span> 家具をクリックして選択、ドラッグして配置を調整</div><div className="controls-hint"><span>左ドラッグ：回転</span><span>スクロール：ズーム</span></div></div>
<FurnitureProperties active={active} plan={plan} rotate={rotate} update={update} />
 </section>
 </>;
}
