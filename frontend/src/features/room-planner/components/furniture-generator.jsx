import React from 'react';
import { ImagePlus } from 'lucide-react';

export function FurnitureGenerator({ generation, canAdd, importing }) {
  const { state, valid, addImages, removeImage, update, start, cancel, reset } = generation;
  const { images, busy, reading, phase, progress, error, message } = state;
  const locked = busy || reading || importing;
  const status = phase === 'importing' ? '生成したモデルを確認しています…' : phase === 'running' ? '家具のモデルを作成しています…' : 'モデルの作成開始を待っています…';
  return <details className="furniture-import-panel furniture-generator">
    <summary>画像から家具を作成</summary>
    <form onSubmit={event => { event.preventDefault(); void start(); }}>
      <fieldset disabled={locked}>
        <label className="generation-upload"><span><ImagePlus size={17} aria-hidden="true" />家具の写真を選択</span>
          <input aria-label="家具の写真（最大4枚）" aria-describedby="furniture-photo-file-hint" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={images.length >= 4}
            onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) void addImages(files); }} />
        </label>
        <p id="furniture-photo-file-hint" className="generation-image-count">JPEG・PNG・WebP · 1枚10MB以下（{images.length} / 4枚）</p>
        {images.length > 0 && <ol className="generation-images">{images.map((image, index) => <li key={image.url}>
          <img src={image.url} alt={`家具の参考画像${index + 1}`} />
          <span>{index === 0 ? '1枚目・正面' : `${index + 1}枚目・別の角度`}</span>
          <button type="button" className="sharing-text-button" aria-label={`参考画像${index + 1}を削除`} onClick={() => removeImage(index)}>削除</button>
        </li>)}</ol>}
        <label>作成する家具の名前<input value={state.name} required maxLength={80} placeholder="例：リビングのソファ" onChange={event => update({ name: event.target.value })} /></label>
        <button className="sharing-button primary" type="submit" disabled={!valid || !canAdd}>画像からモデルを作成</button>
      </fieldset>
      {reading && <p role="status">写真を確認しています…</p>}
      {busy && <div role="status"><p>{status}</p>{progress !== null && <progress aria-label="モデル作成の進捗" max="100" value={progress}>{progress}%</progress>}</div>}
      {(busy || reading) && <button type="button" className="sharing-text-button" onClick={cancel}>処理を中止</button>}
      {!busy && !reading && images.length > 0 && <button type="button" className="sharing-text-button" onClick={reset}>画像と入力をクリア</button>}
    </form>
    {error && <p role="alert" className="model-import-error">{error}</p>}
    {message && <p role="status">{message}</p>}
  </details>;
}
