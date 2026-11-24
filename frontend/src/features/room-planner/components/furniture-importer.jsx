import React, { useEffect, useRef, useState } from 'react';
import { MODEL_UP_AXES, modelDimensionsValid } from '../utils/imported-furniture';

function ModelPreview({ draft }) {
  const [image, setImage] = useState(''), [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    try {
      const value = draft.library.createFurniturePreview(); setPreview(value);
      return () => value.dispose();
    } catch { setError('プレビューを表示できません。取り込んだ後に平面図で配置を確認できます。'); }
  }, [draft.library]);
  useEffect(() => {
    const item = { ...draft, w: Number(draft.w), d: Number(draft.d), h: Number(draft.h), color: '#ffffff' };
    if (!preview || !modelDimensionsValid(item)) return;
    const frame = requestAnimationFrame(() => {
      try { setImage(preview.render(draft.model.scene, item)); setError(''); }
      catch { setError('プレビューを更新できませんでした。'); }
    });
    return () => cancelAnimationFrame(frame);
  }, [preview, draft]);
  return <div className="model-import-preview">{image && <img src={image} alt="取り込む家具のプレビュー" />}{error && <p role="status">{error}</p>}</div>;
}

export function FurnitureImporter({ state, readFile, update, confirm, cancel, canAdd, generationBusy = false }) {
  const { draft, busy, error, message } = state;
  const panel = useRef(null);
  useEffect(() => { if (draft?.source && panel.current) panel.current.open = true; }, [draft?.model]);
  return <details ref={panel} className="furniture-importer furniture-import-panel">
    <summary>家具モデルを取り込む</summary>
    <label>家具モデル（GLB）<input type="file" aria-describedby="furniture-glb-file-hint" disabled={generationBusy} accept=".glb,model/gltf-binary" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (file) void readFile(file);
    }} /></label>
    <p id="furniture-glb-file-hint">GLB · 20MB以下</p>
    {busy && <p role="status">{draft ? '家具モデルを保存しています…' : '家具モデルを読み込んでいます…'}</p>}
    {(busy || draft) && <button type="button" className="sharing-text-button" onClick={cancel}>取り込みを中止</button>}
    {draft && <form onSubmit={event => { event.preventDefault(); void confirm(); }}>
      <ModelPreview draft={draft} />
      <fieldset disabled={busy}>
        <label>家具の名前<input value={draft.name} maxLength={80} required onChange={event => update({ name: event.target.value })} /></label>
        {!draft.source && <div className="model-dimensions">{[['w','幅'],['d','奥行き'],['h','高さ']].map(([key,label]) => <label key={key}>{label} (m)<input type="number" min=".02" max="20" step=".001" required value={draft[key]} onChange={event => update({ [key]: event.target.value })} /></label>)}</div>}
        <label>モデルの上方向<select value={draft.modelUp} onChange={event => update({ modelUp: event.target.value })}>{MODEL_UP_AXES.map(axis => <option key={axis} value={axis}>{axis.toUpperCase()}方向</option>)}</select></label>
        <label>モデルの正面<select value={draft.modelFront} onChange={event => update({ modelFront: Number(event.target.value) })}>{[0,1,2,3].map(value => <option key={value} value={value}>{value * 90}°</option>)}</select></label>
        <button type="submit" className="sharing-button primary" disabled={!canAdd}>この家具を配置</button>
      </fieldset>
    </form>}
    {error && <p className="model-import-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </details>;
}
