import React, { lazy, Suspense, useState } from 'react';
import { floorPlanBounds } from '../utils/floor-plan';
import { planGridStep } from '../utils/plan-grid';
import { PlanView } from './plan-view';
import { Ruler, Trash2 } from 'lucide-react';
const PlannerViewport = lazy(() => import('./planner-viewport'));
export function PlannerCanvas({
  planKey,
  plan,
  items,
  selected,
  setSelected,
  moveItem,
  showSizes,
  toggleSizes,
  removeSelected,
  editable = true
}) {
  const [view, setView] = useState('3d');
  const [preset, setPreset] = useState({ name: 'initial', revision: 0 });
  const dimensions = planKey === 'custom' ? floorPlanBounds(plan) : plan;
  return <><div className="view-controls" role="group" aria-label="表示と視点">
    <button aria-pressed={view === 'plan'} onClick={() => setView('plan')}>平面図</button>
    <button aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button>
    <button onClick={() => { setView('3d'); setPreset(p => ({ name: 'initial', revision: p.revision + 1 })); }}>初期視点</button>
    <button onClick={() => { setView('3d'); setPreset(p => ({ name: 'front', revision: p.revision + 1 })); }}>正面</button>
  </div><div className="canvas-wrap" role="region" aria-label={view === 'plan' ? '部屋の平面プレビュー' : '部屋の3Dプレビュー'}>{view === 'plan' ? <PlanView planKey={planKey} plan={plan} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem} editable={editable} /> : <Suspense fallback={<div role="status" className="viewport-loading">3Dプレビューを読み込んでいます…</div>}>
      <PlannerViewport preset={preset} planKey={planKey} plan={plan} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem} editable={editable} />
    </Suspense>}
    <div className="canvas-label"><span className="live-dot" /> {view === 'plan' ? `平面図・1目盛 ${planGridStep(plan)} m` : '3D・ドラッグで視点を変更'}</div>
    <div className="canvas-tools"><button title="寸法表示" aria-label="寸法表示" aria-pressed={showSizes} className={showSizes ? 'tool active' : 'tool'} onClick={toggleSizes}><Ruler size={17} /></button><button title="選択を削除" aria-label="選択を削除" disabled={!editable || !selected} className="tool" onClick={removeSelected}><Trash2 size={17} /></button></div>
    {showSizes && <div className="dimension-tag width-tag">{dimensions.w.toFixed(1)} m</div>} {showSizes && <div className="dimension-tag depth-tag">{dimensions.d.toFixed(1)} m</div>}
    </div></>;
}
