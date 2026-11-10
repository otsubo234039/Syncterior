import React, { useEffect, useRef, useState } from 'react';
import { wallLength } from '../utils/floor-plan';
import { calibrateFloorPlan, measurementLength } from '../utils/floor-plan-calibration';
import { readFloorPlanImage, recognizeFloorPlan } from '../utils/floor-plan-image';

export function FloorPlanImporter({ customPlan, importFloorPlan, disabled }) {
  const [draft, setDraft] = useState(customPlan);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState([]);
  const [target, setTarget] = useState(0);
  const [length, setLength] = useState('');
  const [undo, setUndo] = useState(null);
  const replaceFurniture = useRef(false);
  const request = useRef(null), dragging = useRef(null), applied = useRef(false), suppressClick = useRef(false);
  useEffect(() => {
    if (applied.current && customPlan) { applied.current = false; setDraft(customPlan); return; }
    applied.current = false; request.current?.abort(); releaseDrag(); setBusy(false);
    setDraft(customPlan); setImage(null); setPoints([]); setTarget(0); setLength(''); setUndo(null);
  }, [customPlan]);
  useEffect(() => () => { request.current?.abort(); releaseDrag(); }, []);
  useEffect(() => { if (disabled) { request.current?.abort(); releaseDrag(); setBusy(false); } }, [disabled]);

  async function analyze(file) {
    releaseDrag(); request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setMessage('OpenCVで壁候補を解析しています…');
    try {
      const nextImage = file ? await readFloorPlanImage(file) : image;
      if (controller.signal.aborted) return;
      const result = await recognizeFloorPlan(nextImage, controller.signal);
      if (controller.signal.aborted) return;
      replaceFurniture.current = true;
      setImage(nextImage); setDraft(result.plan); setPoints([]); setTarget(0); setLength(''); setUndo(null);
      setMessage(`${result.engine}で壁候補を${result.plan.walls.length}本抽出しました。床は仮の長方形です。測った一辺の両端を指定してください。`);
    } catch (cause) {
      if (!controller.signal.aborted) { setError(cause.message || '画像を読み込めませんでした。'); setMessage(''); }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function location(event) {
    const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget, matrix = svg.getScreenCTM();
    if (!matrix || !draft) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return [Math.max(0, Math.min(1, p.x / draft.w)), Math.max(0, Math.min(1, p.y / draft.d))];
  }
  function setPoint(index, point) {
    if (!point || disabled || busy) return;
    setPoints(previous => { const next = [...previous]; next[Math.min(index, next.length)] = point; return next; });
    setError('');
  }
  function pick(event) {
    if (disabled || busy || dragging.current !== null) return;
    if (suppressClick.current) { suppressClick.current = false; return; }
    setPoint(target, location(event)); setTarget(1);
  }
  function releaseDrag() {
    const active = dragging.current; dragging.current = null;
    if (active) suppressClick.current = true;
    if (active?.node.hasPointerCapture(active.pointerId)) active.node.releasePointerCapture(active.pointerId);
  }
  const measured = draft && measurementLength(draft, points);
  return <details className="floor-import" open={customPlan ? true : undefined}>
    <summary>間取り画像から3Dの枠を作る</summary>
    <p>画像は端末内で解析します。自動抽出は概算です。部屋で測った一辺の両端と実際の長さで、間取り全体のサイズを合わせます。</p>
    {disabled && <p role="status">画像の取り込みは個人編集中に利用できます。</p>}
    <fieldset disabled={disabled || busy} className="floor-import-controls">
      <label>間取り画像<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (file) void analyze(file);
      }} /></label>
      <button className="sharing-button" disabled={!image} onClick={() => analyze()}>画像を再解析</button>
    </fieldset>
    {busy && <button className="sharing-button" onClick={() => { request.current?.abort(); setBusy(false); setMessage('解析を中止しました。'); }}>解析を中止</button>}
    <p role="status" aria-live="polite">{message}</p>
    {error && <p role="alert" className="floor-error">{error}</p>}
    {draft && <fieldset disabled={disabled || busy} className="floor-editor">
      <div className="floor-editor-grid">
        <div>
          <svg className="floor-drawing" viewBox={`0 0 ${draft.w} ${draft.d}`} role="group" aria-label="壁候補と計測区間の図" onPointerDownCapture={() => { if (!dragging.current) suppressClick.current = false; }} onClick={pick}>
            {image && <image href={image.preview} width={draft.w} height={draft.d} preserveAspectRatio="none" />}
            {draft.floors.map(f => <polygon key={f.id} points={f.points.map(p => p.join(',')).join(' ')} fill="#4f99851a" stroke="#488e78" strokeWidth={draft.w * .002} />)}
            {draft.walls.map(w => <line className="floor-wall" key={w.id} x1={w.start[0]} y1={w.start[1]} x2={w.end[0]} y2={w.end[1]} stroke="#317bda" strokeWidth={Math.max(draft.wallThickness * (w.thicknessRatio ?? 1), draft.w * .006)} opacity=".6" />)}
            {draft.walls.flatMap(w => w.openings.map(o => {
              const size = wallLength(w), at = distance => [w.start[0] + (w.end[0] - w.start[0]) * distance / size, w.start[1] + (w.end[1] - w.start[1]) * distance / size];
              const a = at(o.offset), b = at(o.offset + o.width);
              return <line key={o.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={o.kind === 'door' ? '#fff' : '#77d8e8'} strokeWidth={Math.max(draft.wallThickness * (w.thicknessRatio ?? 1), draft.w * .01)} pointerEvents="none" />;
            }))}
            {points.length === 2 && <line className="floor-measurement" x1={points[0][0] * draft.w} y1={points[0][1] * draft.d} x2={points[1][0] * draft.w} y2={points[1][1] * draft.d} stroke="#d36325" strokeWidth={draft.w * .006} pointerEvents="none" />}
            {points.map((p, i) => <g key={i} role="button" tabIndex={disabled || busy ? -1 : 0} aria-label={`計測の${i === 0 ? '始点' : '終点'}`} aria-disabled={disabled || busy}
              transform={`translate(${p[0] * draft.w} ${p[1] * draft.d})`} className="floor-measure-point"
              onClick={event => { suppressClick.current = false; event.stopPropagation(); }}
              onPointerDown={event => { if (disabled || busy) return; event.stopPropagation(); dragging.current = { index: i, node: event.currentTarget, pointerId: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => { if (dragging.current?.index === i) setPoint(i, location(event)); }}
              onPointerUp={releaseDrag} onPointerCancel={releaseDrag} onLostPointerCapture={event => { if (dragging.current?.node === event.currentTarget) dragging.current = null; }}
              onKeyDown={event => {
                if (event.key === 'Escape') { event.preventDefault(); releaseDrag(); return; }
                const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
                if (!delta || disabled || busy) return;
                event.preventDefault(); setPoint(i, p.map((n, axis) => Math.max(0, Math.min(1, n + delta[axis] * (event.shiftKey ? .02 : .002)))));
              }}>
              <circle r={draft.w * .001} fill="transparent" stroke="transparent" strokeWidth="44" vectorEffect="non-scaling-stroke" />
              <circle r={draft.w * .01} fill="#d36325" stroke="#fff" strokeWidth={draft.w * .003} pointerEvents="none" />
            </g>)}
          </svg>
          <p>測った壁の内側の角から角まで、始点・終点を指定してください。部屋の境界や青い壁の区切りに合わせる必要はありません。</p>
          <p>点はドラッグ、または選択して矢印キーで微調整できます。{!image && '元画像は保存されないため、復元後は認識された形状を表示しています。'}</p>
        </div>
        <div className="floor-fields">
          <h3>一辺の長さでサイズを合わせる</h3>
          <div className="floor-toolbar">
            <button className="sharing-button" aria-pressed={target === 0} onClick={() => setTarget(0)}>始点を指定</button>
            <button className="sharing-button" aria-pressed={target === 1} disabled={!points.length} onClick={() => setTarget(1)}>終点を指定</button>
            <button className="sharing-text-button" onClick={() => { releaseDrag(); setPoints([]); setTarget(0); setError(''); }}>2点を選び直す</button>
          </div>
          <p role="status">{points.length < 2 ? `${points.length === 0 ? '始点' : '終点'}を図面上で指定してください。` : measured === null ? '2点が近すぎます。離れた位置を指定してください。' : '計測区間を選択しました。実際に測った長さを入力してください。'}</p>
          <form onSubmit={event => {
            event.preventDefault(); const next = calibrateFloorPlan(draft, points, Number(length));
            if (!next) { setError('有効な2点と長さを指定してください。補正後の幅・奥行きは1〜100m、壁厚は0.05〜1mの範囲が必要です。'); return; }
            if (next === draft) { setError(''); setMessage('指定した長さに合っています。'); return; }
            setUndo(draft); setDraft(next); setError(''); setMessage('指定した一辺に合わせて全体のサイズを補正しました。3Dに適用すると保存されます。');
          }}>
            <label>測った一辺の長さ (m)<input type="number" min="0.02" step="any" required value={length} onChange={event => setLength(event.target.value)} /></label>
            <button className="sharing-button" disabled={measured == null}>この長さで全体を補正</button>
          </form>
          {undo && <button className="sharing-text-button" onClick={() => { setDraft(undo); setUndo(null); setError(''); setMessage('補正前のサイズに戻しました。3Dに適用すると保存されます。'); }}>サイズ補正を取り消す</button>}
        </div>
      </div>
      <p>床は仮の長方形で、壁・扉・窓には認識の誤りが残ります。新しく画像を解析して適用すると現在の間取りと家具を置き換えます。同じ図面のサイズ補正では家具の実寸を維持します。</p>
      <button className="sharing-button primary" onClick={() => {
        applied.current = true;
        if (importFloorPlan(draft, !replaceFurniture.current)) { replaceFurniture.current = false; setError(''); setMessage('3Dの枠に適用しました。個人配置として保存します。'); }
        else { applied.current = false; setError('家具が新しい床や壁に収まりません。家具を移動・削除してから適用してください。'); }
      }}>この枠で3Dを作成</button>
    </fieldset>}
  </details>;
}
