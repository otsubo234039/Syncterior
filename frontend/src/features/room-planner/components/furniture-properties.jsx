import React from 'react';
import { RotateCw } from 'lucide-react';
export function FurnitureProperties({
  active,
  plan,
  rotate,
  update,
  editable = true
}) {
  return <div className="properties">
      <div className="property-title"><div><div className="eyebrow">OBJECT SETTINGS</div><h3>{active ? active.name : '家具を選択してください'}</h3></div>{active && <button className="rotate-btn" disabled={!editable} onClick={rotate}><RotateCw size={15} /> 90° 回転</button>}</div>
      {active ? <fieldset className="property-grid" disabled={!editable} aria-label="家具のプロパティ">
        <label>幅 (W)<div className="value-box">{active.w.toFixed(2)} <small>m</small></div></label><label>奥行 (D)<div className="value-box">{active.d.toFixed(2)} <small>m</small></div></label><label>高さ (H)<div className="value-box">{active.h.toFixed(2)} <small>m</small></div></label>
        <label>左右位置 (X)<div className="value-box"><input type="number" step=".1" value={active.x.toFixed(1)} onChange={e => update(active.id, {
            x: Math.max(-plan.w / 2, Math.min(plan.w / 2, Number(e.target.value)))
          })} /><small>m</small></div></label>
        <label>前後位置 (Z)<div className="value-box"><input type="number" step=".1" value={active.z.toFixed(1)} onChange={e => update(active.id, {
            z: Math.max(-plan.d / 2, Math.min(plan.d / 2, Number(e.target.value)))
          })} /><small>m</small></div></label>
        <label>色<div className="value-box color-box"><input aria-label="家具の色" type="color" value={active.color} onChange={e => update(active.id, {
            color: e.target.value
          })} /><span>{active.color.toUpperCase()}</span></div></label>
      </fieldset> : <div className="empty-property">左のカタログから家具を追加するか、3Dビュー内の家具をクリックしてください。</div>}
    </div>;
}
