import React from 'react';
import { Armchair, BedDouble, Box, Lamp, Monitor, Refrigerator, Sofa, Tv } from 'lucide-react';
import { plans } from '../data/plans';
import { catalog } from '../data/catalog';
const furnitureIcons = {
  sofa: Sofa,
  bed: BedDouble,
  table: Box,
  desk: Monitor,
  chair: Armchair,
  tv: Tv,
  fridge: Refrigerator,
  lamp: Lamp
};
export function PlannerSidebar({
  planKey,
  changePlan,
  addItem,
  editable = true,
  canAdd = true,
  custom = false
}) {
  return <aside className="sidebar">
    <div className="section-heading"><span className="step">01</span><div><h2>間取りを選ぶ</h2><p>部屋のベースを選択してください</p></div></div>
    <div className="plan-list">{Object.entries(plans).map(([key, p]) => <button key={key} disabled={!editable} className={'plan-card ' + (planKey === key ? 'chosen' : '')} onClick={() => changePlan(key)}>
      <div className="plan-sketch"><svg viewBox="0 0 100 70"><path d={key === 'studio' ? 'M15 8 H85 V60 H15 Z' : key === '1ldk' ? 'M8 8 H92 V62 H8 Z M55 8 V62 M8 38 H55' : 'M7 7 H93 V63 H7 Z M58 7 V63 M7 38 H58'} fill="none" stroke="currentColor" strokeWidth="2.5" /><path d={key === 'studio' ? 'M45 60 H57' : key === '1ldk' ? 'M45 62 H56 M55 22 H55' : 'M45 63 H56 M58 20 H58'} stroke="#5b8f78" strokeWidth="4" /></svg></div>
      <div className="plan-info"><strong>{p.name}</strong><span>{p.desc}</span><small>{p.w}m × {p.d}m</small></div><span className="radio-dot">{planKey === key ? '✓' : ''}</span>
    </button>)}</div>
    <div className="section-heading furniture-heading"><span className="step">02</span><div><h2>家具・家電を追加</h2><p>{custom ? '選択すると壁に収まる位置に配置' : '選択すると部屋の中央に配置'}</p></div></div>
    <div className="catalog">{catalog.map(c => {
        const Icon = furnitureIcons[c.type];
        return <button key={c.type} disabled={!editable || !canAdd} className="catalog-item" onClick={() => addItem(c)}><span className="catalog-icon"><Icon size={19} /></span><span className="catalog-name">{c.name}<small>{c.w} × {c.d} × {c.h} m</small></span><span className="add">＋</span></button>;
      })}</div>
    {custom && <p className="sharing-limit">家具は床と壁に収まる位置へ追加します。取込間取りは個人保存のみ対応しています。</p>}
    {!canAdd && <p className="sharing-limit" role="status">家具は200点まで配置できます。</p>}
    <div className="sidebar-note"><span className="note-icon">i</span><span>家具はドラッグで移動、選択後に回転できます。寸法は一般的な製品の目安です。</span></div>
   </aside>;
}
