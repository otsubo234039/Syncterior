import React, { lazy, Suspense, useState, useMemo, useCallback } from 'react';
import { walkingWorld, walkingStart } from '../utils/first-person';
import { floorPlanBounds } from '../utils/floor-plan';
import { planGridStep } from '../utils/plan-grid';
import { PlanView } from './plan-view';
import { CameraPanButtons } from './camera-pan-buttons';
import { Grid3X3, Ruler, Trash2 } from 'lucide-react';
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
  showGrid,
  toggleGrid,
  removeSelected,
  editable = true,
  surfaces
}) {
  const [view, setView] = useState('3d');
  const [preset, setPreset] = useState({ name: 'initial', revision: 0 });
  const [pan, setPan] = useState({ direction: null, revision: 0, holding: false });
  const panCamera = useCallback((direction, holding) => setPan(previous => ({ direction, holding, revision: previous.revision + 1 })), []);
  const stopPan = useCallback(() => setPan(previous => previous.holding ? { ...previous, holding: false } : previous), []);
  const world = useMemo(() => walkingWorld(planKey, plan, items), [planKey,plan,items]);
  const start = useMemo(() => view === 'walk' ? walkingStart(world) : null, [world,view]);
  const exitWalking = useCallback(() => {
    setView('3d'); setPreset(p => ({ name:'initial', revision:p.revision+1 }));
  }, []);
  const dimensions = planKey === 'custom' ? floorPlanBounds(plan) : plan;
  return <><div className="view-controls" role="group" aria-label="表示と視点">
    <button aria-pressed={view === 'plan'} onClick={() => setView('plan')}>平面図</button>
    <button aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button>
    <button aria-pressed={view === 'walk'} onClick={() => setView('walk')}>一人称</button>
    <button onClick={() => { setView('3d'); setPreset(p => ({ name: 'initial', revision: p.revision + 1 })); }}>初期視点</button>
    <button onClick={() => { setView('3d'); setPreset(p => ({ name: 'front', revision: p.revision + 1 })); }}>正面</button>
  </div>{view === 'walk' && !start && <p role="status">歩ける場所がありません。家具や床・壁を調整してください。</p>}<div className="canvas-wrap" role="region" aria-label={view === 'plan' ? '部屋の平面プレビュー' : '部屋の3Dプレビュー'}>{view === 'plan' ? <PlanView planKey={planKey} plan={plan} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem} editable={editable} showGrid={showGrid} /> : <Suspense fallback={<div role="status" className="viewport-loading">3Dプレビューを読み込んでいます…</div>}>
      <PlannerViewport preset={preset} pan={pan} planKey={planKey} plan={plan} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem} editable={editable} walking={view === 'walk' && Boolean(start)} world={world} walkStart={start} onExitWalking={exitWalking} surfaces={surfaces} showGrid={showGrid} />
    </Suspense>}
    <div className="canvas-label"><span className="live-dot" /> {view === 'plan' ? `平面図・1目盛 ${planGridStep(plan)} m` : view === 'walk' ? '画面を選択 → WASD／矢印で移動・ドラッグで見回す・Escで終了' : '3D・ドラッグで視点を変更'}</div>
    <div className="canvas-tools"><button title="寸法表示" aria-label="寸法表示" aria-pressed={showSizes} className={showSizes ? 'tool active' : 'tool'} onClick={toggleSizes}><Ruler size={17} /></button><button title="マス目表示" aria-label="マス目表示" aria-pressed={showGrid} className={showGrid ? 'tool active' : 'tool'} onClick={toggleGrid}><Grid3X3 size={17} /></button><button title="選択を削除" aria-label="選択を削除" disabled={!editable || !selected} className="tool" onClick={removeSelected}><Trash2 size={17} /></button></div>
    {view === '3d' && <CameraPanButtons onPan={panCamera} onStop={stopPan} />}
    {showSizes && <div className="dimension-tag width-tag">{dimensions.w.toFixed(1)} m</div>} {showSizes && <div className="dimension-tag depth-tag">{dimensions.d.toFixed(1)} m</div>}
    </div></>;
}
