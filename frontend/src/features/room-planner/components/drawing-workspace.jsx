import React, { useEffect, useRef, useState } from 'react';
import { FloorPlanEditor } from './floor-plan-editor';
import { FloorPlanImporter } from './floor-plan-importer';
import { decodeDrawingDocument, encodeDrawing, newDrawing } from '../utils/drawing-document';
import { readFloorPlanImage } from '../utils/floor-plan-image';

export function DrawingWorkspace({ planner }) {
  const { drawing, drawingDirty, savedDrawing, savedDrawingId, drawingNotice, replaceDrawing, saveDrawing, generateFromDrawing } = planner;
  const [error, setError] = useState('');
  const fileRequest = useRef(0), tools = useRef(null);
  useEffect(() => () => { fileRequest.current++; }, []);
  const mayReplace = () => !drawingDirty || !drawing.modified || window.confirm('保存していない図面があります。現在の編集内容を置き換えますか？');
  const replace = (plan, image = null, options) => {
    if (!mayReplace()) return false;
    fileRequest.current++;
    setError(''); tools.current.open = false; return replaceDrawing(plan, image, options);
  };
  const exportFile = () => {
    try {
      const blob = new Blob([encodeDrawing(drawing.plan, drawing.drawingId)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'room-plan.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) { setError(cause.message); }
  };
  return <section className="drawing-workspace" aria-label="図面モード">
    <div className="workspace-top"><div><div className="eyebrow">DRAW YOUR SPACE</div>
      <h1>図面モード</h1><p>2D図面を作成・保存し、同じ図面から3Dを表示します。</p></div>
      <span className="drawing-state" role="status">{drawingDirty ? '未保存の変更があります' : '図面は保存済みです'}</span>
    </div>
    <details className="drawing-source-tools" ref={tools}><summary>図面の新規作成・読込・画像変換</summary>
    <div className="drawing-file-actions">
      <button className="sharing-button" disabled={!savedDrawing} onClick={() => replace(savedDrawing, null, { drawingId: savedDrawingId })}>保存した図面を開く</button>
      <label className="drawing-file-label">図面ファイルを開く<input type="file" accept="application/json,.json" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        const ticket = ++fileRequest.current;
        try {
          if (file.size > 1_000_000) throw new Error('図面ファイルは1MB以下を選択してください。');
          const { plan, drawingId } = decodeDrawingDocument(await file.text());
          if (ticket === fileRequest.current) replace(plan, null, { drawingId });
        } catch (cause) { if (ticket === fileRequest.current) setError(cause.message); }
      }} /></label>
      <button className="sharing-button" onClick={exportFile}>図面ファイルを書き出す</button>
    </div>
    <details className="drawing-new"><summary>新しい図面を作成</summary>
      <form className="drawing-metadata" onSubmit={event => {
        event.preventDefault(); const fields = new FormData(event.currentTarget);
        const plan = newDrawing({ name: String(fields.get('name')).trim(), w: Number(fields.get('w')), d: Number(fields.get('d')), h: Number(fields.get('h')) });
        if (!plan) { setError('図面名と有効な寸法を指定してください。幅・奥行きは1〜100m、高さは0.5〜10mです。'); return; }
        if (replace(plan)) event.currentTarget.closest('details').open = false;
      }}>
        <label>新しい図面名<input name="name" defaultValue="新しい図面" maxLength={80} required /></label>
        <label>図面の幅 (m)<input name="w" type="number" defaultValue="8" min="1" max="100" step="any" required /></label>
        <label>図面の奥行き (m)<input name="d" type="number" defaultValue="6" min="1" max="100" step="any" required /></label>
        <label>新しい壁の高さ (m)<input name="h" type="number" defaultValue="2.5" min=".5" max="10" step="any" required /></label>
        <button type="submit" className="sharing-button">新規作成</button>
      </form>
    </details>
    <FloorPlanImporter customPlan={drawing.plan} sourceImage={drawing.image} convertToDrawing={replace} />
    <label className="drawing-file-label">手直し用の下絵<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      const ticket = ++fileRequest.current;
      try {
        const image = await readFloorPlanImage(file);
        if (ticket !== fileRequest.current) return;
        if (Math.abs(image.pixels.width / image.pixels.height / (drawing.plan.w / drawing.plan.d) - 1) > .01) {
          throw new Error('元の図面と縦横比が異なります。同じ画像を選択してください。');
        }
        planner.setDrawingImage(image); setError('');
      } catch (cause) { if (ticket === fileRequest.current) setError(cause.message); }
    }} /></label>
    </details>
    <div className="drawing-notice" aria-live="polite">
      {error || drawingNotice.error ? <p role="alert" className="floor-error">{error || drawingNotice.error}</p> : <p role="status">{drawingNotice.message}</p>}
    </div>
    <p className="drawing-footnote" role="status">{planner.preserveDrawingItems
      ? '同じ図面の修正として3Dへ反映します。現在の家具を維持します。'
      : '新しい図面から家具なしの3Dを作成します。現在の間取り・家具配置は3D表示時に置き換わります。'}</p>
    <FloorPlanEditor key={drawing.generation} plan={drawing.plan} image={drawing.image}
      onChange={value => planner.updateDrawing(value, drawing.generation)} onApply={saveDrawing} onPreview={generateFromDrawing} />
    <p className="drawing-footnote">図面の保存はこのブラウザ内です。図面ファイルで別のブラウザにも持ち出せます。下絵・編集履歴は保存しません。同じ図面の修正では家具の位置・寸法を維持し、収まらない変更は拒否します。新規作成・別の画像や図面ファイルの取り込みでは家具なしの3Dを作成します。</p>
  </section>;
}
