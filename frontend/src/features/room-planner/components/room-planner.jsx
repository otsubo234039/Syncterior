import React from 'react';
import { useRoomPlanner } from '../hooks/use-room-planner';
import { PlannerSidebar } from './planner-sidebar';
import { PlannerCanvas } from './planner-canvas';
import { FurnitureProperties } from './furniture-properties';
import { FloorPlanImporter } from './floor-plan-importer';
import { RoomSharing } from './room-sharing';

export function RoomPlanner() {
  const planner = useRoomPlanner();
  const { plan, items, planKey, changePlan, addItem, active, rotate, update, editable,
    collaboration, shareRoom, shareUrl, reconnect, leaveRoom } = planner;
  const totalArea = (plan.area ?? plan.w * plan.d).toFixed(1);

  return <>
    <PlannerSidebar planKey={planKey} changePlan={changePlan} addItem={addItem}
      editable={editable} canAdd={items.length < 200} custom={Boolean(planner.customPlan)} />
    <section className="workspace">
      <RoomSharing collaboration={collaboration} shareRoom={shareRoom} shareUrl={shareUrl}
        reconnect={reconnect} leaveRoom={leaveRoom} custom={Boolean(planner.customPlan)} />
      {collaboration.status === 'local' && <div className="local-save-bar" role="region" aria-label="個人配置の保存">
        <p role="status">{planner.localSave.error || planner.localSave.message}</p>
        <button className="sharing-text-button" onClick={planner.clearLocalSave}>保存した個人配置を消去</button>
      </div>}
      {!collaboration.loaded ? <div className="shared-room-placeholder" role="status">
        <h1>{collaboration.status === 'error' ? '共有された部屋を開けませんでした' : '共有された部屋を読み込んでいます…'}</h1>
        <p>接続が完了すると、最新の配置が表示されます。</p>
        <button className="sharing-button" onClick={leaveRoom}>個人編集に戻る</button>
      </div> : <>
        <div className="workspace-top">
          <div><div className="eyebrow">YOUR SPACE</div><h1>{plan.name}<span> / 3Dレイアウト</span></h1><p>{plan.desc}</p></div>
          <div className="room-metrics">
            <div><span>ROOM SIZE</span><strong>{totalArea}<small> m²</small></strong></div>
            <div><span>FURNITURE</span><strong>{items.length}<small> 点</small></strong></div>
          </div>
        </div>
        <FloorPlanImporter customPlan={planner.customPlan} importFloorPlan={planner.importFloorPlan} disabled={collaboration.status !== 'local'} />
        {planner.customPlan && <label className="floor-scale">模型の表示倍率<select value={planner.displayScale} onChange={event => planner.setDisplayScale(Number(event.target.value))}>
          {[1, 10, 20, 50, 100].map(value => <option key={value} value={value}>1/{value}</option>)}
        </select><span>実寸データは維持します。画面上の物理的な縮尺ではありません。</span></label>}
        <PlannerCanvas {...planner} />
        <div className="workspace-bottom">
          <div className="hint"><span className="hint-key">TIP</span>{planner.customPlan ? '画像に重ねた候補を修正し、3Dに適用できます' : editable ? '家具をクリックして選択、ドラッグして配置を調整' : '接続が戻るまで配置の編集を一時停止しています'}</div>
          <div className="controls-hint"><span>左ドラッグ：回転</span><span>スクロール：ズーム</span></div>
        </div>
        {!planner.customPlan && <FurnitureProperties active={active} plan={plan} rotate={rotate} update={update} editable={editable} />}
      </>}
    </section>
  </>;
}
