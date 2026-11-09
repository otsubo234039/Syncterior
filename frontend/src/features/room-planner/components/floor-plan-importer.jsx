import React, { useEffect, useRef, useState } from 'react';
import { floorPlanBounds, isFloorPlan, resizeFloorPlan, wallLength } from '../utils/floor-plan';
import { floorPlanFromLines } from '../utils/floor-plan-detection';
import { readFloorPlanImage, recognizeFloorPlan } from '../utils/floor-plan-image';

const number = (form, name) => Number(form.get(name));
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const rounded = value => Number(value.toFixed(3));

export function FloorPlanImporter({ customPlan, importFloorPlan, disabled }) {
  const [draft, setDraft] = useState(customPlan);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState('select');
  const [points, setPoints] = useState([]);
  const [floorKind, setFloorKind] = useState('room');
  const request = useRef(null);
  useEffect(() => { if (customPlan) setDraft(customPlan); }, [customPlan]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (disabled) { request.current?.abort(); setBusy(false); }
  }, [disabled]);

  async function analyze(file) {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setMessage('OpenCVで壁候補を解析しています…');
    try {
      const nextImage = file ? await readFloorPlanImage(file) : image;
      if (controller.signal.aborted) return;
      const result = await recognizeFloorPlan(nextImage, controller.signal);
      if (controller.signal.aborted) return;
      setImage(nextImage); setDraft(result.plan); setSelected(''); setPoints([]); setMode('select');
      setMessage(`${result.engine}で壁候補を${result.plan.walls.length}本抽出しました。床は仮の長方形です。壁・床・開口部を確認してください。`);
    } catch (cause) {
      if (!controller.signal.aborted) { setError(cause.message || '画像を読み込めませんでした。'); setMessage(''); }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function replace(next) {
    if (!isFloorPlan(next)) { setError('寸法・座標・開口部を確認してください。床の交差や、開口部の重なり・壁からのはみ出しは適用できません。'); return false; }
    setDraft(next); setError(''); return true;
  }
  function onDrawing(event) {
    if (disabled || busy || mode === 'select' || !draft) return;
    const svg = event.currentTarget, matrix = svg.getScreenCTM();
    if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const point = [Math.max(0, Math.min(draft.w, p.x)), Math.max(0, Math.min(draft.d, p.y))];
    if (mode === 'wall' && points.length) {
      const wall = { id: id('wall'), start: points[0], end: point, openings: [] };
      if (replace({ ...draft, walls: [...draft.walls, wall] })) { setSelected(wall.id); setPoints([]); }
    } else setPoints(previous => [...previous, point]);
  }
  const wall = draft?.walls.find(value => value.id === selected);
  const floor = draft?.floors.find(value => value.id === selected);
  const bounds = draft && floorPlanBounds(draft);

  return <details className="floor-import" open={customPlan ? true : undefined}>
    <summary>間取り画像から3Dの枠を作る</summary>
    <p>画像は端末内で解析します。自動抽出は概算です。寸法と壁・床・ドア・窓を確認してから適用してください。</p>
    {disabled && <p role="status">画像の取り込みは個人編集中に利用できます。</p>}
    <fieldset disabled={disabled || busy} className="floor-import-controls">
      <label>間取り画像<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (file) void analyze(file);
      }} /></label>
      <button className="sharing-button" disabled={!image} onClick={() => analyze()}>画像を再解析</button>
      <button className="sharing-button" onClick={() => {
        setImage(null); setDraft(floorPlanFromLines({ width: 100, height: 100, lines: [] })); setPoints([]); setSelected(''); setMessage('壁と床を手動で指定してください。'); setError('');
      }}>空の枠から編集</button>
    </fieldset>
    {busy && <button className="sharing-button" onClick={() => { request.current?.abort(); setBusy(false); setMessage('解析を中止しました。'); }}>解析を中止</button>}
    <p role="status" aria-live="polite">{message}</p>
    {error && <p role="alert" className="floor-error">{error}</p>}
    {draft && <fieldset disabled={disabled || busy} className="floor-editor">
      <div className="floor-toolbar">
        <button className="sharing-button" onClick={() => {
          const value = { id: id('wall'), start: [draft.w * .25, draft.d * .5], end: [draft.w * .75, draft.d * .5], openings: [] };
          if (replace({ ...draft, walls: [...draft.walls, value] })) setSelected(value.id);
        }}>壁を数値で追加</button>
        <label>図面の操作<select value={mode} onChange={event => { setMode(event.target.value); setPoints([]); }}><option value="select">壁・床を選択</option><option value="wall">壁を追加（2点）</option><option value="floor">床を描く（3点以上）</option></select></label>
        {mode === 'floor' && <><label>床の種類<select value={floorKind} onChange={event => setFloorKind(event.target.value)}><option value="room">室内</option><option value="balcony">バルコニー</option></select></label>
          <button className="sharing-button" disabled={points.length < 3} onClick={() => {
            const value = { id: id('floor'), kind: floorKind, points };
            if (replace({ ...draft, floors: [...draft.floors, value] })) { setSelected(value.id); setPoints([]); setMode('select'); }
          }}>床の描画を確定</button></>}
        {points.length > 0 && <button className="sharing-button" onClick={() => setPoints([])}>描画をやり直す</button>}
      </div>
      <div className="floor-editor-grid">
        <div>
          <svg className="floor-drawing" viewBox={`0 0 ${draft.w} ${draft.d}`} role="img" aria-label="壁候補と床の編集図" onClick={onDrawing}>
            {image && <image href={image.preview} width={draft.w} height={draft.d} preserveAspectRatio="none" />}
            {draft.floors.map(value => <polygon key={value.id} points={value.points.map(p => p.join(',')).join(' ')}
              fill={value.kind === 'balcony' ? '#ad854b33' : '#4f99851a'} stroke={selected === value.id ? '#df822d' : '#488e78'} strokeWidth={draft.w * .003}
              onClick={event => { if (!disabled && !busy && mode === 'select') { event.stopPropagation(); setSelected(value.id); } }} />)}
            {draft.walls.map(value => <line key={value.id} x1={value.start[0]} y1={value.start[1]} x2={value.end[0]} y2={value.end[1]}
              stroke={selected === value.id ? '#df822d' : '#317bda'} strokeWidth={Math.max(draft.wallThickness * (value.thicknessRatio ?? 1), draft.w * .008)} opacity=".75"
              onClick={event => { if (!disabled && !busy && mode === 'select') { event.stopPropagation(); setSelected(value.id); } }} />)}
            {draft.walls.flatMap(value => value.openings.map(opening => {
              const length = wallLength(value), at = distance => [value.start[0] + (value.end[0] - value.start[0]) * distance / length, value.start[1] + (value.end[1] - value.start[1]) * distance / length];
              const start = at(opening.offset), end = at(opening.offset + opening.width);
              return <line key={opening.id} x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} stroke={opening.kind === 'door' ? '#fff' : '#77d8e8'} strokeWidth={Math.max(draft.wallThickness * (value.thicknessRatio ?? 1), draft.w * .01)} pointerEvents="none" />;
            }))}
            {points.length > 0 && <polyline points={points.map(p => p.join(',')).join(' ')} fill="none" stroke="#d36325" strokeWidth={draft.w * .006} />}
            {points.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={draft.w * .009} fill="#d36325" />)}
          </svg>
          <p>青：壁候補／緑：室内床／茶：バルコニー。床の追加後は、不要な仮の床を削除してください。</p>
        </div>
        <div className="floor-fields">
          <form key={`size-${draft.w}-${draft.d}-${draft.h}-${draft.wallThickness}`} onSubmit={event => {
            event.preventDefault(); const form = new FormData(event.currentTarget);
            const next = resizeFloorPlan(draft, draft.w * number(form, 'width') / bounds.w, draft.d * number(form, 'depth') / bounds.d);
            if (next) replace({ ...next, h: number(form, 'height'), wallThickness: number(form, 'thickness') }); else setError('全体寸法は1〜100mの編集範囲内で指定してください。');
          }}>
            <h3>全体の寸法</h3>
            <NumberField label="全体の幅 (m)" name="width" value={bounds.w} min="0.1" max="100" />
            <NumberField label="全体の奥行き (m)" name="depth" value={bounds.d} min="0.1" max="100" />
            <NumberField label="壁の高さ (m)" name="height" value={draft.h} min="0.5" max="10" />
            <NumberField label="壁の基準厚さ (m)" name="thickness" value={draft.wallThickness} min="0.05" max="1" />
            <button className="sharing-button">全体寸法を更新</button>
          </form>
          <label>編集する壁・床<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">選択してください</option>
            {draft.walls.map((value, i) => <option key={value.id} value={value.id}>壁 {i + 1}（{wallLength(value).toFixed(2)}m）</option>)}
            {draft.floors.map((value, i) => <option key={value.id} value={value.id}>{value.kind === 'balcony' ? 'バルコニー' : '室内床'} {i + 1}</option>)}
          </select></label>
          {wall && <WallEditor key={`${draft.wallThickness}-${JSON.stringify(wall)}`} wall={wall} plan={draft} onChange={value => replace({ ...draft, walls: draft.walls.map(w => w.id === wall.id ? value : w) })} onCalibrate={length => {
            const factor = length / wallLength(wall), next = resizeFloorPlan(draft, draft.w * factor, draft.d * factor);
            if (next) replace(next); else setError('基準の長さから有効な寸法を計算できませんでした。');
          }} />}
          {floor && <form key={JSON.stringify(floor)} onSubmit={event => {
            event.preventDefault(); const form = new FormData(event.currentTarget);
            const value = { ...floor, kind: form.get('kind'), points: floor.points.map((_, i) => [number(form, `x-${i}`), number(form, `z-${i}`)]) };
            replace({ ...draft, floors: draft.floors.map(f => f.id === floor.id ? value : f) });
          }}>
            <h3>床の輪郭</h3><label>床の分類<select name="kind" defaultValue={floor.kind}><option value="room">室内</option><option value="balcony">バルコニー</option></select></label>
            {floor.points.map((point, i) => <React.Fragment key={i}>
              <NumberField label={`床の頂点 ${i + 1} X (m)`} name={`x-${i}`} value={point[0]} max={draft.w} />
              <NumberField label={`床の頂点 ${i + 1} Z (m)`} name={`z-${i}`} value={point[1]} max={draft.d} />
            </React.Fragment>)}
            <button className="sharing-button">床を更新</button>
          </form>}
          {selected && <button className="sharing-button" disabled={Boolean(floor && draft.floors.length === 1)} onClick={() => {
            if (replace({ ...draft, walls: draft.walls.filter(w => w.id !== selected), floors: draft.floors.filter(f => f.id !== selected) })) setSelected('');
          }}>選択した壁・床を削除</button>}
        </div>
      </div>
      <p>適用すると現在の間取りと家具を置き換えます。取込間取りは枠の編集・個人保存に対応し、家具配置と共有には未対応です。</p>
      <button className="sharing-button primary" onClick={() => {
        if (importFloorPlan(draft)) { setError(''); setMessage('3Dの枠に適用しました。個人配置として保存します。'); }
        else setError('間取りを適用できませんでした。');
      }}>この枠で3Dを作成</button>
    </fieldset>}
  </details>;
}

function NumberField({ label, name, value, min = '0', max = '100' }) {
  return <label>{label}<input type="number" name={name} defaultValue={Math.max(Number(min), Math.min(Number(max), rounded(value)))} min={min} max={max} step="any" required /></label>;
}
function WallEditor({ wall, plan, onChange, onCalibrate }) {
  return <>
    <form onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      onChange({ ...wall, start: [number(form, 'x1'), number(form, 'z1')], end: [number(form, 'x2'), number(form, 'z2')], thicknessRatio: number(form, 'thickness') / plan.wallThickness });
    }}>
      <h3>壁の端点</h3>
      <NumberField label="壁の始点 X (m)" name="x1" value={wall.start[0]} max={plan.w} />
      <NumberField label="壁の始点 Z (m)" name="z1" value={wall.start[1]} max={plan.d} />
      <NumberField label="壁の終点 X (m)" name="x2" value={wall.end[0]} max={plan.w} />
      <NumberField label="壁の終点 Z (m)" name="z2" value={wall.end[1]} max={plan.d} />
      <NumberField label="この壁の厚さ (m)" name="thickness" value={plan.wallThickness * (wall.thicknessRatio ?? 1)} min={plan.wallThickness * .1} max={plan.wallThickness * 8} />
      <button className="sharing-button">壁を更新</button>
    </form>
    <form onSubmit={event => { event.preventDefault(); onCalibrate(number(new FormData(event.currentTarget), 'length')); }}>
      <NumberField label="この壁の実際の長さ (m)" name="length" value={wallLength(wall)} min="0.1" />
      <button className="sharing-button">この長さで全体を補正</button>
    </form>
    <form onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget), kind = form.get('kind');
      onChange({ ...wall, openings: [...wall.openings, { id: id('opening'), kind, offset: number(form, 'offset'), width: number(form, 'width'),
        bottom: kind === 'door' ? 0 : number(form, 'bottom'), height: number(form, 'height') }] });
    }}>
      <h3>ドア・窓の開口部</h3>
      <label>開口部の種類<select name="kind"><option value="door">ドア</option><option value="window">窓</option></select></label>
      <NumberField label="壁の始点からの距離 (m)" name="offset" value={0} />
      <NumberField label="開口部の幅 (m)" name="width" value={.8} min="0.1" />
      <NumberField label="窓の下端の高さ (m)" name="bottom" value={.9} max="10" />
      <NumberField label="開口部の高さ (m)" name="height" value={2} min="0.1" max="10" />
      <button className="sharing-button">開口部を追加</button>
    </form>
    {wall.openings.map((opening, i) => <div key={opening.id}>{opening.kind === 'door' ? 'ドア' : '窓'} {i + 1}：{opening.width} × {opening.height}m
      <button className="sharing-text-button" aria-label={`開口部 ${i + 1}を削除`} onClick={() => onChange({ ...wall, openings: wall.openings.filter(o => o.id !== opening.id) })}>削除</button>
    </div>)}
  </>;
}
