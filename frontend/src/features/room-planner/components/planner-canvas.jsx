import React, { lazy, Suspense } from 'react';
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
  return <div className="canvas-wrap" role="region" aria-label="部屋の3Dプレビュー"><Suspense fallback={<div role="status" className="viewport-loading">3Dプレビューを読み込んでいます…</div>}>
      <PlannerViewport planKey={planKey} items={items} selected={selected} setSelected={setSelected} moveItem={moveItem} editable={editable} />
    </Suspense>
    <div className="canvas-label"><span className="live-dot" /> LIVE 3D VIEW <span className="canvas-label-divider" /> ドラッグで視点を変更</div>
    <div className="canvas-tools"><button title="寸法表示" aria-label="寸法表示" aria-pressed={showSizes} className={showSizes ? 'tool active' : 'tool'} onClick={toggleSizes}><Ruler size={17} /></button><button title="選択を削除" aria-label="選択を削除" disabled={!editable || !selected} className="tool" onClick={removeSelected}><Trash2 size={17} /></button></div>
    {showSizes && <div className="dimension-tag width-tag">{plan.w.toFixed(1)} m</div>} {showSizes && <div className="dimension-tag depth-tag">{plan.d.toFixed(1)} m</div>}
    </div>;
}
