import React, { useEffect, useRef, useState } from 'react';
import { PlanGrid } from './plan-grid';
import { planGridStep } from '../utils/plan-grid';
import { editFloorPlan } from '../utils/floor-plan-edit';
import { wallLength } from '../utils/floor-plan';
import { uid } from '../utils/furniture';

export function FloorPlanEditor({ plan, image, onApply, onChange, onPreview }) {
  const drawing = useRef(null), drag = useRef(null), metadata = useRef(null);
  const [draft, setDraft] = useState(plan);
  const current = useRef(draft); current.current = draft;
  const [mode, setMode] = useState('select'), [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null), [error, setError] = useState('');
  const [opacity, setOpacity] = useState(.6), [showImage, setShowImage] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [history, setHistory] = useState([]), [future, setFuture] = useState([]);
  const replaceDraft = next => { current.current = next; setDraft(next); onChange?.(next); };
  const finishDrag = (cancel = false) => {
    const active = drag.current; drag.current = null;
    if (!active) return;
    if (cancel) { replaceDraft(active.before); setError(''); }
    else if (current.current !== active.before) {
      setHistory(values => [...values.slice(-99), active.before]); setFuture([]);
    }
    if (active.node.hasPointerCapture(active.pointerId)) active.node.releasePointerCapture(active.pointerId);
  };
  useEffect(() => {
    const blur = () => finishDrag(true);
    window.addEventListener('blur', blur);
    return () => { finishDrag(true); window.removeEventListener('blur', blur); };
  }, []);
  const location = event => {
    const matrix = drawing.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (![point.x, point.y].every(Number.isFinite)) return null;
    return [Math.max(0, Math.min(draft.w, point.x)), Math.max(0, Math.min(draft.d, point.y))];
  };
  const change = (action, continuous = false) => {
    const before = current.current, next = editFloorPlan(before, action);
    if (!next) { setError('この変更は適用できません。床の交差、壁の長さ、開口の重なりやはみ出しを確認してください。'); return false; }
    setError('');
    if (next !== before) {
      if (!continuous) { setHistory(values => [...values.slice(-99), before]); setFuture([]); }
      replaceDraft(next);
    }
    return true;
  };
  const wall = draft.walls.find(w => w.id === selected?.wallId);
  const opening = wall?.openings.find(o => o.id === selected?.openingId);
  const floor = draft.floors.find(f => f.id === selected?.floorId);
  const at = (w, offset) => {
    const length = wallLength(w);
    return w.start.map((value, axis) => value + (w.end[axis] - value) * offset / length);
  };
  const selectWall = w => {
    if (mode === 'erase') {
      if (change({ type: 'remove-wall', wallId: w.id })) setSelected(null);
    } else setSelected({ wallId: w.id });
  };
  const pickWall = (event, w) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (mode === 'wall') { pickCanvas(event); return; }
    if (mode === 'door' || mode === 'window') {
      const p = location(event);
      if (!p) return;
      if (!pending || pending.wallId !== w.id) setPending({ wallId: w.id, point: p });
      else if (change({ type: 'add-opening', wallId: w.id, id: uid(), kind: mode, start: pending.point, end: p })) setPending(null);
      return;
    }
    selectWall(w);
  };
  function pickCanvas(event) {
    if (event.button !== 0) return;
    const p = location(event);
    if (!p) return;
    if (mode === 'wall') {
      if (!pending) setPending({ point: p });
      else if (change({ type: 'add-wall', id: uid(), start: pending.point, end: p })) setPending(null);
    } else if (mode === 'select') setSelected(null);
  }
  const handle = (label, p, action) => <g key={label} role="button" aria-label={label} tabIndex={0} className="floor-edit-handle" transform={`translate(${p[0]} ${p[1]})`}
    onFocus={() => { if (action.floorId) setSelected(value => ({ ...value, floorPoint: action.index })); }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.stopPropagation(); finishDrag();
      if (action.floorId) setSelected(value => ({ ...value, floorPoint: action.index }));
      drag.current = { node: event.currentTarget, pointerId: event.pointerId, before: current.current, action };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onKeyDown={event => {
      const delta = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[event.key];
      if (!delta) return;
      event.preventDefault(); event.stopPropagation();
      change({ ...action, point: p.map((value, axis) => value + delta[axis] * (event.shiftKey ? .1 : .01)) });
    }}>
    <circle r=".001" fill="transparent" stroke="transparent" strokeWidth="32" vectorEffect="non-scaling-stroke" />
    <circle r={Math.max(draft.w, draft.d) * .008} fill="#fff" stroke="#b85320" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
  </g>;
  const commitMetadata = () => {
    if (!metadata.current.checkValidity()) metadata.current.closest('details').open = true;
    if (!metadata.current.reportValidity()) return false;
    const data = new FormData(metadata.current);
    return change({ type: 'update-metadata', name: String(data.get('name')).trim(), height: Number(data.get('height')) });
  };
  const modes = [['select', '選択・頂点を動かす'], ['wall', '壁を追加'], ['erase', '線を消す'], ['door', '扉を追加'], ['window', '窓を追加']];
  return <section className="drawing-editor" aria-labelledby="floor-plan-editor-title" onKeyDown={event => {
    if (event.key === 'Escape' && (drag.current || pending)) {
      event.preventDefault(); finishDrag(true); setPending(null);
    }
  }}>
    <h2 id="floor-plan-editor-title">2D図面を編集</h2>
    <details className="drawing-metadata-panel"><summary>図面情報：{draft.name} / 壁の高さ {draft.h} m</summary><form ref={metadata} key={`${draft.name}:${draft.h}`} className="drawing-metadata" onSubmit={event => {
      event.preventDefault(); commitMetadata();
    }}>
      <label>図面名<input name="name" defaultValue={draft.name} required maxLength={80} /></label>
      <label>壁の高さ (m)<input name="height" type="number" defaultValue={draft.h} min=".5" max="10" step=".1" required /></label>
      <button className="sharing-button" type="submit">図面情報を更新</button>
      <span>{draft.w} m × {draft.d} m</span>
    </form></details>
    <p>グリッドを見ながら「壁を追加」で2点を指定し、「線を消す」で不要な壁の線を押します。ここでの変更はまだ保存されません。</p>
    <div className="floor-edit-toolbar" role="group" aria-label="図面の編集方法">
      {modes.map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { finishDrag(true); setMode(value); setPending(null); setSelected(null); setError(''); }}>{label}</button>)}
      <button type="button" disabled={!history.length} onClick={() => {
        finishDrag(true); const before = current.current; setFuture(values => [...values, before]);
        const previous = history[history.length - 1]; replaceDraft(previous);
        setHistory(values => values.slice(0, -1)); setSelected(null); setPending(null); setError('');
      }}>手直しを元に戻す</button>
      <button type="button" disabled={!future.length} onClick={() => {
        const before = current.current; setHistory(values => [...values, before]); const next = future[future.length - 1];
        replaceDraft(next); setFuture(values => values.slice(0, -1)); setSelected(null); setPending(null); setError('');
      }}>手直しをやり直す</button>
    </div>
    {image ? <div className="floor-underlay-controls"><label><input type="checkbox" checked={showImage} onChange={event => setShowImage(event.target.checked)} />下絵を表示</label>
      <label>下絵の濃さ<input type="range" min="0" max="1" step=".05" value={opacity} onChange={event => setOpacity(Number(event.target.value))} /></label><span>下絵の位置・縮尺は固定</span></div>
      : <p>下絵がありません。「手直し用の下絵」で同じ画像を選び直せます。</p>}
    <div className="floor-underlay-controls"><label><input type="checkbox" checked={showGrid} onChange={event => setShowGrid(event.target.checked)} />グリッドを表示</label>
      <span>1目盛 {planGridStep(draft)} m・太線 {planGridStep(draft) * 4} m</span></div>
    <p role="status">{mode === 'wall' ? pending ? '壁の終点を指定してください。' : '壁の始点を指定してください。' : mode === 'door' || mode === 'window' ? pending ? '同じ壁上で開口の終点を指定してください。' : '壁上で開口の始点を指定してください。' : mode === 'erase' ? '消したい壁の線を押してください。元に戻すこともできます。' : '壁や床、扉・窓を選択してください。白い点はドラッグ・矢印キーで動かせます。'} Escで途中の操作を取り消せます。</p>
    {error && <p role="alert" className="floor-error">{error}</p>}
    <svg ref={drawing} className="floor-edit-drawing" role="group" aria-label="下絵と間取りの編集図" viewBox={`${-draft.w * .02} ${-draft.d * .02} ${draft.w * 1.04} ${draft.d * 1.04}`}
      onPointerDown={pickCanvas} onPointerMove={event => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const p = location(event); if (p) change({ ...active.action, point: p }, true);
      }} onPointerUp={() => finishDrag()} onPointerCancel={() => finishDrag(true)} onLostPointerCapture={() => { if (drag.current) finishDrag(true); }}>
      {image && showImage && <image href={image.preview} width={draft.w} height={draft.d} preserveAspectRatio="none" opacity={opacity} pointerEvents="none" />}
      {showGrid && <PlanGrid plan={draft} />}
      {draft.floors.map((f, i) => <polygon key={f.id} role="button" aria-label={`床${i + 1}を選択`} tabIndex={0} points={f.points.map(p => p.join(',')).join(' ')} fill="#4f9985" fillOpacity=".08" stroke={selected?.floorId === f.id ? '#b85320' : '#488e78'} strokeWidth="2" vectorEffect="non-scaling-stroke"
        onPointerDown={event => { if (mode !== 'select') return; event.stopPropagation(); setSelected({ floorId: f.id }); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected({ floorId: f.id }); } }} />)}
      {draft.walls.map((w, i) => <g key={w.id}>
        <line x1={w.start[0]} y1={w.start[1]} x2={w.end[0]} y2={w.end[1]} stroke={selected?.wallId === w.id ? '#b85320' : '#317bda'} strokeWidth={draft.wallThickness * (w.thicknessRatio ?? 1)} opacity=".7" pointerEvents="none" />
        <rect role="button" aria-label={`壁${i + 1}を選択`} tabIndex={0} width={wallLength(w)} height={draft.wallThickness * (w.thicknessRatio ?? 1)} y={-draft.wallThickness * (w.thicknessRatio ?? 1) / 2}
          transform={`translate(${w.start.join(' ')}) rotate(${Math.atan2(w.end[1] - w.start[1], w.end[0] - w.start[0]) * 180 / Math.PI})`}
          fill="transparent" stroke="transparent" strokeWidth="16" vectorEffect="non-scaling-stroke" onPointerDown={event => pickWall(event, w)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectWall(w); } }} />
        {w.openings.map((o, index) => {
          const a = at(w, o.offset), thickness = draft.wallThickness * (w.thicknessRatio ?? 1);
          return <rect key={o.id} role="button" tabIndex={0} aria-label={`${o.kind === 'door' ? '扉' : '窓'}${index + 1}を選択`} width={o.width} height={thickness} y={-thickness / 2}
            transform={`translate(${a.join(' ')}) rotate(${Math.atan2(w.end[1] - w.start[1], w.end[0] - w.start[0]) * 180 / Math.PI})`}
            fill={o.kind === 'door' ? '#fff' : '#77d8e8'}
            onPointerDown={event => { if (mode !== 'select') { pickWall(event, w); return; } event.stopPropagation(); setSelected({ wallId: w.id, openingId: o.id }); }}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (mode === 'erase') selectWall(w); else setSelected({ wallId: w.id, openingId: o.id }); } }} />;
        })}
      </g>)}
      {mode === 'select' && wall && !opening && ['start', 'end'].map(side => handle(`壁の${side === 'start' ? '始点' : '終点'}`, wall[side], { type: 'move-wall-point', wallId: wall.id, side }))}
      {mode === 'select' && floor && floor.points.map((p, i) => handle(`床の頂点${i + 1}`, p, { type: 'move-floor-point', floorId: floor.id, index: i }))}
      {mode === 'select' && opening && ['start', 'end'].map(side => handle(`開口の${side === 'start' ? '始点' : '終点'}`, at(wall, opening.offset + (side === 'end' ? opening.width : 0)), { type: 'move-opening-point', wallId: wall.id, openingId: opening.id, side }))}
      {pending && <circle cx={pending.point[0]} cy={pending.point[1]} r={draft.w * .012} fill="#b85320" pointerEvents="none" />}
    </svg>
    <div className="floor-edit-toolbar">
      {wall && <button type="button" onClick={() => { if (change(opening ? { type: 'remove-opening', wallId: wall.id, openingId: opening.id } : { type: 'remove-wall', wallId: wall.id })) setSelected(null); }}>{opening ? '選択した開口を削除' : '選択した壁を削除'}</button>}
      {floor && <>
        <span>頂点{(selected.floorPoint ?? 0) + 1}を編集</span>
        <button type="button" onClick={() => {
          const index = selected.floorPoint ?? 0;
          if (change({ type: 'insert-floor-point', floorId: floor.id, index })) setSelected(value => ({ ...value, floorPoint: index + 1 }));
        }}>辺{(selected.floorPoint ?? 0) + 1}に頂点を追加</button>
        <button type="button" disabled={floor.points.length <= 3} onClick={() => {
          if (change({ type: 'remove-floor-point', floorId: floor.id, index: selected.floorPoint ?? 0 })) setSelected(value => ({ ...value, floorPoint: 0 }));
        }}>頂点{(selected.floorPoint ?? 0) + 1}を削除</button>
      </>}
    </div>
    <div className="floor-edit-actions">
      <button type="button" className="sharing-button primary" onClick={() => { finishDrag(); if (commitMetadata()) onApply(current.current); }}>図面を保存</button>
      <button type="button" className="sharing-button" onClick={() => { finishDrag(); if (commitMetadata()) onPreview(current.current); }}>図面から3Dを表示</button>
    </div>
  </section>;
}
