import React from 'react';
import { useRoomPlanner } from '../hooks/use-room-planner';
import { PlannerSidebar } from './planner-sidebar';
import { PlannerCanvas } from './planner-canvas';
import { FurnitureProperties } from './furniture-properties';
import { DrawingWorkspace } from './drawing-workspace';
import { RoomSharing } from './room-sharing';

export function RoomPlanner() {
  const planner = useRoomPlanner();
  const { plan, items, planKey, changePlan, addItem, active, rotate, update, editable,
    collaboration, shareRoom, shareUrl, reconnect, leaveRoom } = planner;
  const totalArea = (plan.area ?? plan.w * plan.d).toFixed(1);

  const drawingMode = planner.workspaceMode === 'drawing' && collaboration.status === 'local';
  return <>
    <nav className="workspace-modes" aria-label="作業モード">
      <button aria-pressed={drawingMode} disabled={collaboration.status !== 'local'} onClick={() => planner.setWorkspaceMode('drawing')}>図面モード</button>
      <button aria-pressed={!drawingMode} onClick={() => planner.setWorkspaceMode('layout')}>3D・家具配置</button>
    </nav>
    {drawingMode ? <DrawingWorkspace planner={planner} /> : <>
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
        <button className="sharing-button" onClick={leaveRoom}>個人編集に戻る</button>
      </div> : <>
        <div className="workspace-top">
          <div><h1>{plan.name}</h1>{plan.desc && <p>{plan.desc}</p>}</div>
          <div className="room-metrics">
            <div><span>面積</span><strong>{totalArea}<small> m²</small></strong></div>
            <div><span>家具数</span><strong>{items.length}<small> 点</small></strong></div>
          </div>
        </div>
        {collaboration.status === 'local' && <p className="drawing-layout-entry"><button className="sharing-text-button" onClick={() => planner.setWorkspaceMode('drawing')}>図面の編集へ</button></p>}
        {planner.placementError && <p role="alert">{planner.placementError}</p>}
        <PlannerCanvas {...planner} />
        <div className="workspace-bottom">
          <div className="hint">{planner.customPlan ? null : editable ? '家具をクリックして選択、ドラッグして配置を調整' : '接続が戻るまで配置の編集を一時停止しています'}</div>
          <div className="controls-hint"><span>左ドラッグ：回転</span><span>ホイール押し込み：移動</span><span>スクロール：ズーム</span></div>
        </div>
        <FurnitureProperties active={active} plan={plan} rotate={rotate} update={update} editable={editable} />
      </>}
    </section>
    </>}
  </>;
}
