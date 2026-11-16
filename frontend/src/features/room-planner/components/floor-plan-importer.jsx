import React, { useEffect, useRef, useState } from 'react';
import { wallLength } from '../utils/floor-plan';
import { calibrateFloorPlan, calibrateFloorPlanByTatami, calibrateFloorPlanByPolygon, measurementArea, measurementLength, measurementPolygonArea } from '../utils/floor-plan-calibration';
import { readFloorPlanImage, recognizeFloorPlan } from '../utils/floor-plan-image';

export function FloorPlanImporter({ customPlan, sourceImage, generation, onImageRequest, onNewImage, convertToDrawing, disabled }) {
  const [draft, setDraft] = useState(customPlan);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState([]);
  const [target, setTarget] = useState(0);
  const [length, setLength] = useState('');
  const [method, setMethod] = useState('length');
  const [areaMode, setAreaMode] = useState('room');
  const [closed, setClosed] = useState(false);
  const [tatami, setTatami] = useState('');
  const [areaPerTatami, setAreaPerTatami] = useState('1.62');
  const [undo, setUndo] = useState(null);
  const drawingRef = useRef(null);
  const [pointRadius, setPointRadius] = useState(0);
  useEffect(() => {
    const svg = drawingRef.current; if (!svg) return;
    const update = () => {
      const matrix = svg.getScreenCTM();
      const scale = matrix && Math.hypot(matrix.a, matrix.b);
      if (scale > 0) setPointRadius((window.matchMedia('(pointer: coarse)').matches ? 20 : 12) / scale);
    };
    const observer = new ResizeObserver(update); observer.observe(svg); update();
    return () => observer.disconnect();
  }, [draft?.w, draft?.d]);
  const request = useRef(null), dragging = useRef(null), suppressClick = useRef(false);
  const newDocument = useRef(false);
  useEffect(() => {
    // 新しい画像の読み込みで親の旧図面を消しても、その画像の解析は継続する。
    if (!customPlan) return;
    request.current?.abort(); releaseDrag(); setBusy(false);
    setDraft(customPlan); setImage(sourceImage ?? null); setPoints([]); setTarget(0); setLength(''); setTatami(''); setUndo(null);
    setClosed(false);
    setError(''); setMessage('');
    newDocument.current = false;
  }, [customPlan, sourceImage, generation]);
  useEffect(() => () => { request.current?.abort(); releaseDrag(); }, []);
  useEffect(() => { if (disabled) { request.current?.abort(); releaseDrag(); setBusy(false); } }, [disabled]);

  async function analyze(file) {
    releaseDrag(); request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const ticket = file ? onImageRequest?.() : undefined;
    setBusy(true); setError(''); setMessage('OpenCVで壁候補を解析しています…');
    try {
      const nextImage = file ? await readFloorPlanImage(file) : image;
      if (controller.signal.aborted) return;
      if (file) {
        if (onNewImage && !onNewImage(ticket)) { controller.abort(); setBusy(false); setMessage(''); return; }
        newDocument.current = !onNewImage;
        setImage(nextImage); setDraft(null); setPoints([]); setTarget(0); setLength(''); setTatami(''); setUndo(null);
        setClosed(false);
      }
      const result = await recognizeFloorPlan(nextImage, controller.signal);
      if (controller.signal.aborted) return;
      setImage({ ...nextImage, roomCandidates: result.roomCandidates }); setDraft(result.plan); setPoints([]); setTarget(0); setLength(''); setTatami(''); setUndo(null); setClosed(false);
      setMessage(`${result.engine}で壁候補を${result.plan.walls.length}本抽出しました。部屋候補は${result.roomCandidates.length}件です。床は仮の長方形です。実測した一辺、または帖数が分かる部屋を指定してください。`);
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
    if (byPolygon) {
      if (areaMode === 'room' || closed) return;
      const point = location(event);
      if (point) setPoints(previous => previous.length < 64 ? [...previous, point] : previous);
      setError(''); return;
    }
    setPoint(target, location(event)); setTarget(1);
  }
  function releaseDrag() {
    const active = dragging.current; dragging.current = null;
    if (active) suppressClick.current = true;
    if (active?.node.hasPointerCapture(active.pointerId)) active.node.releasePointerCapture(active.pointerId);
  }
  const byArea = method === 'tatami';
  const byPolygon = byArea && areaMode !== 'rectangle';
  const polygonArea = draft && measurementPolygonArea(draft, points);
  const measured = draft && (byPolygon ? closed ? polygonArea : null : byArea ? measurementArea(draft, points) : measurementLength(draft, points));
  const roomCandidates = image?.roomCandidates ?? [];
  const selectRoom = region => { if (disabled || busy) return; releaseDrag(); setPoints(region.map(p => [...p])); setClosed(true); setError(''); };
  return <details className="floor-import">
    <summary>間取り画像を図面へ変換</summary>
    <p>画像は端末内で解析します。自動抽出は概算です。一辺の実測値、または部屋の帖数から縦横比を保って間取り全体のサイズを合わせます。</p>
    {disabled && <p role="status">図面への変換は個人編集中に利用できます。</p>}
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
          <svg ref={drawingRef} className="floor-drawing" viewBox={`0 0 ${draft.w} ${draft.d}`} role="group" aria-label="壁候補と計測区間の図" onPointerDownCapture={() => { if (!dragging.current) suppressClick.current = false; }} onClick={pick}>
            {image && <image href={image.preview} width={draft.w} height={draft.d} preserveAspectRatio="none" />}
            {draft.floors.map(f => <polygon key={f.id} points={f.points.map(p => p.join(',')).join(' ')} fill="#4f99851a" stroke="#488e78" strokeWidth={draft.w * .002} />)}
            {draft.walls.map(w => <line className="floor-wall" key={w.id} x1={w.start[0]} y1={w.start[1]} x2={w.end[0]} y2={w.end[1]} stroke="#317bda" strokeWidth={Math.max(draft.wallThickness * (w.thicknessRatio ?? 1), draft.w * .006)} opacity=".6" />)}
            {draft.walls.flatMap(w => w.openings.map(o => {
              const size = wallLength(w), at = distance => [w.start[0] + (w.end[0] - w.start[0]) * distance / size, w.start[1] + (w.end[1] - w.start[1]) * distance / size];
              const a = at(o.offset), b = at(o.offset + o.width);
              return <line key={o.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={o.kind === 'door' ? '#fff' : '#77d8e8'} strokeWidth={Math.max(draft.wallThickness * (w.thicknessRatio ?? 1), draft.w * .01)} pointerEvents="none" />;
            }))}
            {byPolygon && areaMode === 'room' && roomCandidates.map((region, i) => <polygon key={i} role="button" tabIndex={disabled || busy ? -1 : 0}
              aria-label={`部屋候補${i + 1}`} aria-disabled={disabled || busy} points={region.map(([x, y]) => `${x * draft.w},${y * draft.d}`).join(' ')}
              fill="#2b9b7950" stroke="#227654" strokeWidth={draft.w * .003} className="floor-room-candidate"
              onClick={event => { event.stopPropagation(); selectRoom(region); }}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); selectRoom(region); } }} />)}
            {byPolygon && points.length > 0 && <polyline className="floor-measure-polygon"
              points={[...points, ...(closed ? [points[0]] : [])].map(([x, y]) => `${x * draft.w},${y * draft.d}`).join(' ')}
              fill={closed ? '#d3632526' : 'none'} stroke="#d36325" strokeWidth={draft.w * .006} pointerEvents="none" />}
            {!byPolygon && points.length === 2 && (byArea
              ? <rect className="floor-measure-area" x={Math.min(points[0][0], points[1][0]) * draft.w} y={Math.min(points[0][1], points[1][1]) * draft.d}
                width={Math.abs(points[1][0] - points[0][0]) * draft.w} height={Math.abs(points[1][1] - points[0][1]) * draft.d}
                fill="#d3632526" stroke="#d36325" strokeWidth={draft.w * .006} pointerEvents="none" />
              : <line className="floor-measurement" x1={points[0][0] * draft.w} y1={points[0][1] * draft.d} x2={points[1][0] * draft.w} y2={points[1][1] * draft.d} stroke="#d36325" strokeWidth={draft.w * .006} pointerEvents="none" />)}
            {points.map((p, i) => <g key={i} role="button" tabIndex={disabled || busy ? -1 : 0} aria-label={byPolygon ? `輪郭の頂点${i + 1}` : `計測の${i === 0 ? '始点' : '終点'}`} aria-disabled={disabled || busy}
              transform={`translate(${p[0] * draft.w} ${p[1] * draft.d})`} className="floor-measure-point"
              onClick={event => { suppressClick.current = false; event.stopPropagation(); }}
              onPointerDown={event => {
                if (disabled || busy || event.button !== 0) return;
                const at = location(event); if (!at) return;
                event.stopPropagation(); dragging.current = { index: i, node: event.currentTarget, pointerId: event.pointerId, offset: at.map((n, axis) => n - p[axis]) };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={event => {
                const active = dragging.current, at = location(event);
                if (active?.index === i && at) setPoint(i, at.map((n, axis) => Math.max(0, Math.min(1, n - active.offset[axis]))));
              }}
              onPointerUp={releaseDrag} onPointerCancel={releaseDrag} onLostPointerCapture={event => { if (dragging.current?.node === event.currentTarget) dragging.current = null; }}
              onKeyDown={event => {
                if (event.key === 'Escape') { event.preventDefault(); releaseDrag(); return; }
                const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
                if (!delta || disabled || busy) return;
                event.preventDefault(); setPoint(i, p.map((n, axis) => Math.max(0, Math.min(1, n + delta[axis] * (event.shiftKey ? .02 : .002)))));
              }}>
              <circle r={pointRadius} fill="transparent" stroke="none" strokeWidth="0" pointerEvents="fill" />
              <circle r={draft.w * .01} fill="#d36325" stroke="#fff" strokeWidth={draft.w * .003} pointerEvents="none" />
            </g>)}
          </svg>
          <p>{byPolygon ? '帖数が分かる部屋の候補を選ぶか、輪郭を順に指定してください。L字や斜めの辺にも対応します。広告の帖数なら壁の中心を目安に輪郭を調整します。' : byArea ? '帖数が分かる長方形の部屋を、対角の2点で囲んでください。広告の帖数なら壁の中心を目安にします。余白・廊下・隣の部屋は含めません。' : '測った壁の内側の角から角まで、始点・終点を指定してください。部屋の境界や青い壁の区切りに合わせる必要はありません。'}</p>
          <p>点はドラッグ、または選択して矢印キーで微調整できます。{!image && '元画像は保存されないため、復元後は認識された形状を表示しています。'}</p>
        </div>
        <div className="floor-fields">
          <h3>サイズを合わせる</h3>
          <label>サイズ合わせの方法<select value={method} onChange={event => {
            releaseDrag(); setMethod(event.target.value); setPoints([]); setTarget(0); setClosed(false); setError(''); setMessage('');
          }}>
            <option value="length">一辺の実測値</option>
            <option value="tatami">部屋の帖数（概算）</option>
          </select></label>
          {byArea && <>
            <label>帖数の対象<select value={areaMode} onChange={event => { releaseDrag(); setAreaMode(event.target.value); setPoints([]); setTarget(0); setClosed(false); setError(''); }}>
              <option value="room">自動認識した部屋</option><option value="polygon">輪郭を指定</option><option value="rectangle">長方形を指定</option>
            </select></label>
            <p>認識した輪郭と帖数の範囲が合っているか確認してください。扉や壁の欠落で隣室とつながる場合は、輪郭を手動で指定できます。帖数には地域・表記による差があり、補正は概算です。</p>
          </>}
          {byPolygon ? <div className="floor-toolbar">
            {areaMode === 'room' && <p>{roomCandidates.length ? `図上の部屋候補を選んでください（${roomCandidates.length}件）。点は動かして修正できます。` : '部屋候補が見つかりません。「輪郭を指定」でもサイズを合わせられます。'}</p>}
            {areaMode === 'polygon' && <>
              <button type="button" className="sharing-button" disabled={polygonArea === null || !points.length || closed} onClick={() => setClosed(true)}>輪郭を閉じる</button>
              <button type="button" className="sharing-text-button" disabled={!points.length || closed} onClick={() => setPoints(previous => previous.slice(0, -1))}>最後の点を取り消す</button>
              <button type="button" className="sharing-text-button" onClick={() => { releaseDrag(); setPoints([]); setClosed(false); setError(''); }}>輪郭を選び直す</button>
            </>}
          </div> : <div className="floor-toolbar">
            <button className="sharing-button" aria-pressed={target === 0} onClick={() => setTarget(0)}>始点を指定</button>
            <button className="sharing-button" aria-pressed={target === 1} disabled={!points.length} onClick={() => setTarget(1)}>終点を指定</button>
            <button className="sharing-text-button" onClick={() => { releaseDrag(); setPoints([]); setTarget(0); setError(''); }}>2点を選び直す</button>
          </div>}
          <p role="status">{byPolygon ? measured === null ? '部屋候補を選ぶか、交差しない輪郭を3〜64点で指定して閉じてください。' : '部屋の輪郭を選択しました。この部屋の帖数を入力してください。' : points.length < 2 ? `${points.length === 0 ? '始点' : '終点'}を図面上で指定してください。` : measured === null ? '2点が近すぎます。離れた位置を指定してください。' : byArea ? '対象の長方形を選択しました。この部屋の帖数を入力してください。' : '計測区間を選択しました。実際に測った長さを入力してください。'}</p>
          <form onSubmit={event => {
            event.preventDefault();
            if (measured == null) { setError('有効な計測区間または部屋の輪郭を指定してください。'); return; }
            const next = byArea
              ? (byPolygon ? calibrateFloorPlanByPolygon : calibrateFloorPlanByTatami)(draft, points, Number(tatami), Number(areaPerTatami))
              : calibrateFloorPlan(draft, points, Number(length));
            if (!next) { setError(`${byPolygon ? '有効な輪郭と正の帖数・1帖の面積' : byArea ? '有効な長方形と正の帖数・1帖の面積' : '有効な2点と長さ'}を指定してください。補正後の幅・奥行きは1〜100m、壁厚は0.05〜1mの範囲が必要です。`); return; }
            if (next === draft) { setError(''); setMessage(byArea ? '指定した帖数の面積に合っています（概算）。' : '指定した長さに合っています。'); return; }
            setUndo(draft); setDraft(next); setError(''); setMessage(`${byArea ? '指定した帖数から全体のサイズを概算で補正しました。' : '指定した一辺に合わせて全体のサイズを補正しました。'}「図面へ変換」で編集画面に反映できます。`);
          }}>
            {byArea ? <>
              <label>選択した部屋の帖数<input type="number" min="0" step="any" required value={tatami} onChange={event => setTatami(event.target.value)} /></label>
              <label>1帖の面積 (m²)<input type="number" min="0" step="any" required value={areaPerTatami} onChange={event => setAreaPerTatami(event.target.value)} /></label>
              <p>初期値は1帖＝1.62m²の目安です。地域や図面の換算値が分かる場合は変更してください。</p>
              {Number(tatami) > 0 && Number(areaPerTatami) > 0 && Number.isFinite(Number(tatami) * Number(areaPerTatami)) && <p>指定した部屋の目標面積：{Number((Number(tatami) * Number(areaPerTatami)).toFixed(4))} m²（概算）</p>}
            </> : <label>測った一辺の長さ (m)<input type="number" min="0.02" step="any" required value={length} onChange={event => setLength(event.target.value)} /></label>}
            <button className="sharing-button" disabled={measured == null}>{byArea ? 'この帖数で全体を補正' : 'この長さで全体を補正'}</button>
          </form>
          {undo && <button className="sharing-text-button" onClick={() => { setDraft(undo); setUndo(null); setError(''); setMessage('補正前のサイズに戻しました。「図面へ変換」で編集画面に反映できます。'); }}>サイズ補正を取り消す</button>}
        </div>
      </div>
      <p>自動認識直後の床は仮の長方形です。変換後、図面モードで壁・床・扉・窓を確認・修正し、図面として保存してください。この操作では3D配置を変更しません。</p>
      <button className="sharing-button primary" onClick={event => {
        if (convertToDrawing(draft, image, { newDocument: newDocument.current })) {
          setError(''); setMessage('編集可能な図面へ変換しました。');
          event.currentTarget.closest('details').open = false;
        }
      }}>図面へ変換</button>
    </fieldset>}
  </details>;
}
